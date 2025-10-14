/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright FINOS FDC3 contributors - see NOTICE file
 */

// Basic Context interface to avoid dependency on @finos/fdc3-context
export interface Context {
  type: string;
  id?: { [key: string]: any };
  name?: string;
  [key: string]: any;
}

/**
 * Configuration for AWS KMS signing
 */
export interface AWSKMSSignerConfig {
  /** AWS KMS Key ID or ARN */
  keyId: string;
  /** AWS region where the KMS key is located */
  region?: string;
  /** AWS credentials (optional - can use default credential chain) */
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
  };
}

/**
 * A signed FDC3 context with cryptographic signature
 */
export interface SignedContext {
  /** The original FDC3 context data */
  context: Context;
  /** Base64-encoded signature */
  signature: string;
  /** Key ID used for signing */
  keyId: string;
  /** Timestamp when the signature was created */
  timestamp: number;
  /** Signing algorithm used */
  algorithm: 'RSASSA_PKCS1_V1_5_SHA_256' | 'ECDSA_SHA_256';
}

/**
 * Result of signature verification
 */
export interface VerificationResult {
  /** Whether the signature is valid */
  isValid: boolean;
  /** Error message if verification failed */
  error?: string;
  /** The verified context data */
  context?: Context;
}