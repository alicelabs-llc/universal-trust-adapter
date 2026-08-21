"use strict";
/**
 * @marketnow/trust-core
 * BLOQUE D: Updated index — exports crypto + pipeline + UTS v2
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrustEngine = exports.verifyCredential = exports.verify = exports.sign = exports.DOMAINS = exports.computeArtifactBinding = exports.verifyPoP = exports.createPoPResponse = exports.generatePoPChallenge = exports.generateEd25519KeyPair = exports.ed25519Verify = exports.ed25519Sign = exports.canonicalHash = exports.canonicalize = void 0;
var crypto_js_1 = require("./crypto.js");
Object.defineProperty(exports, "canonicalize", { enumerable: true, get: function () { return crypto_js_1.canonicalize; } });
Object.defineProperty(exports, "canonicalHash", { enumerable: true, get: function () { return crypto_js_1.canonicalHash; } });
Object.defineProperty(exports, "ed25519Sign", { enumerable: true, get: function () { return crypto_js_1.sign; } });
Object.defineProperty(exports, "ed25519Verify", { enumerable: true, get: function () { return crypto_js_1.verify; } });
Object.defineProperty(exports, "generateEd25519KeyPair", { enumerable: true, get: function () { return crypto_js_1.generateEd25519KeyPair; } });
Object.defineProperty(exports, "generatePoPChallenge", { enumerable: true, get: function () { return crypto_js_1.generatePoPChallenge; } });
Object.defineProperty(exports, "createPoPResponse", { enumerable: true, get: function () { return crypto_js_1.createPoPResponse; } });
Object.defineProperty(exports, "verifyPoP", { enumerable: true, get: function () { return crypto_js_1.verifyPoP; } });
Object.defineProperty(exports, "computeArtifactBinding", { enumerable: true, get: function () { return crypto_js_1.computeArtifactBinding; } });
Object.defineProperty(exports, "DOMAINS", { enumerable: true, get: function () { return crypto_js_1.DOMAINS; } });
// Backwards-compat aliases — old callers imported `sign` / `verify`.
var crypto_js_2 = require("./crypto.js");
Object.defineProperty(exports, "sign", { enumerable: true, get: function () { return crypto_js_2.sign; } });
Object.defineProperty(exports, "verify", { enumerable: true, get: function () { return crypto_js_2.verify; } });
var verification_pipeline_js_1 = require("./verification-pipeline.js");
Object.defineProperty(exports, "verifyCredential", { enumerable: true, get: function () { return verification_pipeline_js_1.verifyCredential; } });
var trust_engine_js_1 = require("./trust-engine.js");
Object.defineProperty(exports, "TrustEngine", { enumerable: true, get: function () { return trust_engine_js_1.TrustEngine; } });
__exportStar(require("./types.js"), exports);
