"use strict";
/**
 * @marketnow/trust-core
 * Package entrypoint — exports all adapters + createEngineWithAllAdapters helper
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 * Copyright (c) 2026 AliceLabs LLC. All rights reserved.
 * https://github.com/eddyflores100-lang/universal-trust-adapter/blob/main/LICENSE-AL-1.0
 *
 * COMMERCIAL USE REQUIRES A SEPARATE COMMERCIAL LICENSE.
 * Contact: legal@alicelabs.site
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SPIFFEAdapter = exports.OAuthAdapter = exports.VCAdapter = exports.MCPAdapter = exports.A2AAdapter = exports.ZTAAdapter = exports.EATAdapter = exports.ATCAdapter = exports.TrustEngine = void 0;
exports.createEngineWithAllAdapters = createEngineWithAllAdapters;
var trust_engine_js_1 = require("../core/trust-engine.js");
Object.defineProperty(exports, "TrustEngine", { enumerable: true, get: function () { return trust_engine_js_1.TrustEngine; } });
// All adapters
var atc_adapter_1 = require("./atc-adapter");
Object.defineProperty(exports, "ATCAdapter", { enumerable: true, get: function () { return atc_adapter_1.ATCAdapter; } });
var eat_adapter_1 = require("./eat-adapter");
Object.defineProperty(exports, "EATAdapter", { enumerable: true, get: function () { return eat_adapter_1.EATAdapter; } });
var zta_adapter_1 = require("./zta-adapter");
Object.defineProperty(exports, "ZTAAdapter", { enumerable: true, get: function () { return zta_adapter_1.ZTAAdapter; } });
var a2a_adapter_1 = require("./a2a-adapter");
Object.defineProperty(exports, "A2AAdapter", { enumerable: true, get: function () { return a2a_adapter_1.A2AAdapter; } });
var mcp_adapter_1 = require("./mcp-adapter");
Object.defineProperty(exports, "MCPAdapter", { enumerable: true, get: function () { return mcp_adapter_1.MCPAdapter; } });
var vc_adapter_1 = require("./vc-adapter");
Object.defineProperty(exports, "VCAdapter", { enumerable: true, get: function () { return vc_adapter_1.VCAdapter; } });
var oauth_adapter_1 = require("./oauth-adapter");
Object.defineProperty(exports, "OAuthAdapter", { enumerable: true, get: function () { return oauth_adapter_1.OAuthAdapter; } });
var spiffe_adapter_1 = require("./spiffe-adapter");
Object.defineProperty(exports, "SPIFFEAdapter", { enumerable: true, get: function () { return spiffe_adapter_1.SPIFFEAdapter; } });
// Convenience: register all adapters at once
const trust_engine_js_2 = require("../core/trust-engine.js");
const atc_adapter_2 = require("./atc-adapter");
const eat_adapter_2 = require("./eat-adapter");
const zta_adapter_2 = require("./zta-adapter");
const a2a_adapter_2 = require("./a2a-adapter");
const mcp_adapter_2 = require("./mcp-adapter");
const vc_adapter_2 = require("./vc-adapter");
const oauth_adapter_2 = require("./oauth-adapter");
const spiffe_adapter_2 = require("./spiffe-adapter");
function createEngineWithAllAdapters(config) {
    return new trust_engine_js_2.TrustEngine({
        adapters: [
            new atc_adapter_2.ATCAdapter(),
            new eat_adapter_2.EATAdapter(),
            new zta_adapter_2.ZTAAdapter(),
            new a2a_adapter_2.A2AAdapter(),
            new mcp_adapter_2.MCPAdapter(),
            new vc_adapter_2.VCAdapter(),
            new oauth_adapter_2.OAuthAdapter(),
            new spiffe_adapter_2.SPIFFEAdapter(),
        ],
        issuer_keys: config?.issuer_keys,
    });
}
