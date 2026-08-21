# Generate test keys for Docker Compose
# Run: bash scripts/generate-docker-keys.sh

mkdir -p keys

# CA Ed25519 keypair
if [ ! -f keys/ca-private.pem ]; then
  echo "Generating CA keypair..."
  openssl genpkey -algorithm Ed25519 -out keys/ca-private.pem
  openssl pkey -in keys/ca-private.pem -pubout -out keys/ca-public.pem
fi

# Gateway Ed25519 keypair (for receipt signing)
if [ ! -f keys/gateway-private.pem ]; then
  echo "Generating Gateway keypair..."
  openssl genpkey -algorithm Ed25519 -out keys/gateway-private.pem
  openssl pkey -in keys/gateway-private.pem -pubout -out keys/gateway-public.pem
fi

echo "✅ Keys generated in keys/"
echo "   CA public key: $(cat keys/ca-public.pem | head -1)"
echo "   Gateway public key: $(cat keys/gateway-public.pem | head -1)"
echo ""
echo "Now run: docker-compose up -d"
