"use strict";
/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright FINOS FDC3 contributors - see NOTICE file
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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.FDC3AWSKMSSigner = void 0;
const client_kms_1 = require("@aws-sdk/client-kms");
const crypto = __importStar(require("crypto"));
/**
 * FDC3 AWS KMS Signer - provides cryptographic signing of FDC3 context data using AWS KMS
 */
class FDC3AWSKMSSigner {
    constructor(config) {
        this.config = config;
        this.kmsClient = new client_kms_1.KMSClient({
            region: config.region || 'us-east-1',
            credentials: config.credentials
        });
    }
    /**
     * Signs an FDC3 context object using AWS KMS
     * @param context The FDC3 context to sign
     * @param algorithm The signing algorithm to use (defaults to RSASSA_PKCS1_V1_5_SHA_256)
     * @returns Promise resolving to a signed context
     */
    async sign(context, algorithm = client_kms_1.SigningAlgorithmSpec.RSASSA_PKCS1_V1_5_SHA_256) {
        try {
            // Serialize the context to a canonical JSON string
            const contextString = this.canonicalizeContext(context);
            const message = Buffer.from(contextString, 'utf8');
            // Sign using AWS KMS
            const signCommand = new client_kms_1.SignCommand({
                KeyId: this.config.keyId,
                Message: message,
                MessageType: client_kms_1.MessageType.RAW,
                SigningAlgorithm: algorithm
            });
            const signResult = await this.kmsClient.send(signCommand);
            if (!signResult.Signature) {
                throw new Error('KMS signing failed: No signature returned');
            }
            // Convert signature to base64
            const signature = Buffer.from(signResult.Signature).toString('base64');
            return {
                context,
                signature,
                keyId: this.config.keyId,
                timestamp: Date.now(),
                algorithm: algorithm
            };
        }
        catch (error) {
            throw new Error(`Failed to sign FDC3 context: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Verifies a signed FDC3 context using the public key from AWS KMS
     * @param signedContext The signed context to verify
     * @returns Promise resolving to verification result
     */
    async verify(signedContext) {
        try {
            // Get the public key from KMS
            const getPublicKeyCommand = new client_kms_1.GetPublicKeyCommand({
                KeyId: signedContext.keyId
            });
            const publicKeyResult = await this.kmsClient.send(getPublicKeyCommand);
            if (!publicKeyResult.PublicKey) {
                return {
                    isValid: false,
                    error: 'Could not retrieve public key from KMS'
                };
            }
            // Canonicalize the context for verification
            const contextString = this.canonicalizeContext(signedContext.context);
            const message = Buffer.from(contextString, 'utf8');
            const signature = Buffer.from(signedContext.signature, 'base64');
            // Verify signature using Node.js crypto
            const publicKeyPem = this.derToPem(Buffer.from(publicKeyResult.PublicKey));
            const verifier = crypto.createVerify(this.getNodeAlgorithm(signedContext.algorithm));
            verifier.update(message);
            const isValid = verifier.verify(publicKeyPem, signature);
            return {
                isValid,
                context: isValid ? signedContext.context : undefined,
                error: isValid ? undefined : 'Signature verification failed'
            };
        }
        catch (error) {
            return {
                isValid: false,
                error: `Verification error: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }
    /**
     * Creates a canonical JSON representation of the context for consistent signing
     * @param context The FDC3 context to canonicalize
     * @returns Canonical JSON string
     */
    canonicalizeContext(context) {
        // Sort keys recursively to ensure consistent serialization
        const sortKeys = (obj) => {
            if (obj === null || typeof obj !== 'object') {
                return obj;
            }
            if (Array.isArray(obj)) {
                return obj.map(sortKeys);
            }
            const sorted = {};
            Object.keys(obj).sort().forEach(key => {
                sorted[key] = sortKeys(obj[key]);
            });
            return sorted;
        };
        return JSON.stringify(sortKeys(context));
    }
    /**
     * Converts DER-encoded public key to PEM format
     * @param derBuffer DER-encoded public key
     * @returns PEM-formatted public key
     */
    derToPem(derBuffer) {
        const base64 = derBuffer.toString('base64');
        const pem = base64.match(/.{1,64}/g)?.join('\n') || base64;
        return `-----BEGIN PUBLIC KEY-----\n${pem}\n-----END PUBLIC KEY-----`;
    }
    /**
     * Maps KMS signing algorithm to Node.js crypto algorithm
     * @param kmsAlgorithm KMS signing algorithm
     * @returns Node.js crypto algorithm name
     */
    getNodeAlgorithm(kmsAlgorithm) {
        switch (kmsAlgorithm) {
            case 'RSASSA_PKCS1_V1_5_SHA_256':
                return 'RSA-SHA256';
            case 'ECDSA_SHA_256':
                return 'sha256';
            default:
                throw new Error(`Unsupported algorithm: ${kmsAlgorithm}`);
        }
    }
}
exports.FDC3AWSKMSSigner = FDC3AWSKMSSigner;
//# sourceMappingURL=aws-kms-signer.js.map