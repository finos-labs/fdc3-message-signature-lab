/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright FINOS FDC3 contributors - see NOTICE file
 */

import { KMSClient, SignCommand, GetPublicKeyCommand, MessageType, SigningAlgorithmSpec } from '@aws-sdk/client-kms';
import { AWSKMSSignerConfig, SignedContext, VerificationResult, Context } from './types';
import * as crypto from 'crypto';

/**
 * FDC3 AWS KMS Signer - provides cryptographic signing of FDC3 context data using AWS KMS
 */
export class FDC3AWSKMSSigner {
  private kmsClient: KMSClient;
  public config: AWSKMSSignerConfig;

  constructor(config: AWSKMSSignerConfig) {
    this.config = config;
    this.kmsClient = new KMSClient({
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
  async sign(
    context: Context, 
    algorithm: SigningAlgorithmSpec = SigningAlgorithmSpec.RSASSA_PKCS1_V1_5_SHA_256
  ): Promise<SignedContext> {
    try {
      // Serialize the context to a canonical JSON string
      const contextString = this.canonicalizeContext(context);
      const message = Buffer.from(contextString, 'utf8');

      // Sign using AWS KMS
      const signCommand = new SignCommand({
        KeyId: this.config.keyId,
        Message: message,
        MessageType: MessageType.RAW,
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
        algorithm: algorithm as 'RSASSA_PKCS1_V1_5_SHA_256' | 'ECDSA_SHA_256'
      };
    } catch (error) {
      throw new Error(`Failed to sign FDC3 context: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Verifies a signed FDC3 context using the public key from AWS KMS
   * @param signedContext The signed context to verify
   * @returns Promise resolving to verification result
   */
  async verify(signedContext: SignedContext): Promise<VerificationResult> {
    try {
      // Get the public key from KMS
      const getPublicKeyCommand = new GetPublicKeyCommand({
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
    } catch (error) {
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
  private canonicalizeContext(context: Context): string {
    // Sort keys recursively to ensure consistent serialization
    const sortKeys = (obj: any): any => {
      if (obj === null || typeof obj !== 'object') {
        return obj;
      }
      
      if (Array.isArray(obj)) {
        return obj.map(sortKeys);
      }
      
      const sorted: any = {};
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
  private derToPem(derBuffer: Buffer): string {
    const base64 = derBuffer.toString('base64');
    const pem = base64.match(/.{1,64}/g)?.join('\n') || base64;
    return `-----BEGIN PUBLIC KEY-----\n${pem}\n-----END PUBLIC KEY-----`;
  }

  /**
   * Maps KMS signing algorithm to Node.js crypto algorithm
   * @param kmsAlgorithm KMS signing algorithm
   * @returns Node.js crypto algorithm name
   */
  private getNodeAlgorithm(kmsAlgorithm: string): string {
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