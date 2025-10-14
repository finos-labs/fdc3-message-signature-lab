/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright FINOS FDC3 contributors - see NOTICE file
 */
import { SigningAlgorithmSpec } from '@aws-sdk/client-kms';
import { AWSKMSSignerConfig, SignedContext, VerificationResult, Context } from './types';
/**
 * FDC3 AWS KMS Signer - provides cryptographic signing of FDC3 context data using AWS KMS
 */
export declare class FDC3AWSKMSSigner {
    private kmsClient;
    config: AWSKMSSignerConfig;
    constructor(config: AWSKMSSignerConfig);
    /**
     * Signs an FDC3 context object using AWS KMS
     * @param context The FDC3 context to sign
     * @param algorithm The signing algorithm to use (defaults to RSASSA_PKCS1_V1_5_SHA_256)
     * @returns Promise resolving to a signed context
     */
    sign(context: Context, algorithm?: SigningAlgorithmSpec): Promise<SignedContext>;
    /**
     * Verifies a signed FDC3 context using the public key from AWS KMS
     * @param signedContext The signed context to verify
     * @returns Promise resolving to verification result
     */
    verify(signedContext: SignedContext): Promise<VerificationResult>;
    /**
     * Creates a canonical JSON representation of the context for consistent signing
     * @param context The FDC3 context to canonicalize
     * @returns Canonical JSON string
     */
    private canonicalizeContext;
    /**
     * Converts DER-encoded public key to PEM format
     * @param derBuffer DER-encoded public key
     * @returns PEM-formatted public key
     */
    private derToPem;
    /**
     * Maps KMS signing algorithm to Node.js crypto algorithm
     * @param kmsAlgorithm KMS signing algorithm
     * @returns Node.js crypto algorithm name
     */
    private getNodeAlgorithm;
}
//# sourceMappingURL=aws-kms-signer.d.ts.map