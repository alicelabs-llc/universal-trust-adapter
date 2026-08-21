# P8-3: Docker image for UTA Trust Server
# Multi-stage build: build TypeScript → runtime image with only dist/
#
# Build: docker build -t uta-trust-server:latest .
# Run:   docker run -p 3000:3000 \
#          -e CA_PRIVATE_KEY_PEM=/keys/ca.pem \
#          -e ADMIN_API_KEY=secret \
#          -v /path/to/keys:/keys:ro \
#          uta-trust-server:latest

# ── Stage 1: Build ──
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/adapters/package.json packages/adapters/
COPY packages/gateway/package.json packages/gateway/
COPY packages/conformance/package.json packages/conformance/
COPY packages/uts/package.json packages/uts/

# Install dependencies
RUN npm ci

# Copy source
COPY . .

# Build TypeScript
RUN npx tsc

# Generate SBOMs
RUN node scripts/generate-sbom.js

# ── Stage 2: Runtime ──
FROM node:20-slim AS runtime

WORKDIR /app

# Install only production dependencies
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/adapters/package.json packages/adapters/
COPY packages/gateway/package.json packages/gateway/
COPY packages/uts/package.json packages/uts/

RUN npm ci --omit=dev

# Copy built artifacts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/dashboard/public ./packages/dashboard/public

# Copy the server entry point
COPY packages/server/package.json packages/server/

# Create a non-root user
RUN useradd -m -u 1001 uta && chown -R uta:uta /app
USER uta

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"

EXPOSE 3000

# Start the server
CMD ["node", "packages/server/dist/index.js"]
