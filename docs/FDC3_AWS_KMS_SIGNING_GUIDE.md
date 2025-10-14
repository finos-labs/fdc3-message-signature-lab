# FDC3 AWS KMS Signing and Verification Guide

This guide provides complete code samples for signing and verifying FDC3 messages using AWS KMS, enabling secure inter-application communication in financial workflows.

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [Installation](#installation)
3. [Basic Signing and Verification](#basic-signing-and-verification)
4. [FDC3 Integration Examples](#fdc3-integration-examples)
5. [Cross-App Verification](#cross-app-verification)
6. [Production Patterns](#production-patterns)
7. [Error Handling](#error-handling)
8. [Security Best Practices](#security-best-practices)

## 🚀 Quick Start

### Installation

```bash
# Install the standalone AWS KMS signer
npm install ./fdc3-aws-kms-signer-1.0.0.tgz

# Keep your existing FDC3
npm install @finos/fdc3

# AWS SDK dependency
npm install @aws-sdk/client-kms
```

### Basic Usage

```typescript
import { FDC3AWSKMSSigner } from 'fdc3-aws-kms-signer';
import { getAgent } from '@finos/fdc3';

// Initialize signer with your AWS KMS key
const signer = new FDC3AWSKMSSigner({
  keyId: 'arn-kms-region-account:key/your-key-id',
  region: 'us-east-1'
});

// Sign a context
const context = { type: 'fdc3.instrument', id: { ticker: 'AAPL' } };
const signedContext = await signer.sign(context);

// Verify a signed context
const verification = await signer.verify(signedContext);
console.log('Valid:', verification.isValid);
```

## 🔐 Basic Signing and Verification

### Signing FDC3 Contexts

```typescript
import { FDC3AWSKMSSigner } from 'fdc3-aws-kms-signer';

class FDC3Signer {
  private signer: FDC3AWSKMSSigner;

  constructor(keyId: string, region: string = 'us-east-1') {
    this.signer = new FDC3AWSKMSSigner({
      keyId,
      region
      // AWS credentials picked up from environment/IAM role
    });
  }

  /**
   * Sign any FDC3 context
   */
  async signContext(context: any) {
    try {
      console.log(`🔐 Signing ${context.type} context...`);
      
      const startTime = Date.now();
      const signedContext = await this.signer.sign(context);
      const signingTime = Date.now() - startTime;

      console.log(`✅ Context signed in ${signingTime}ms`);
      console.log(`   Key: ${signedContext.keyId}`);
      console.log(`   Algorithm: ${signedContext.algorithm}`);
      console.log(`   Signature: ${signedContext.signature.substring(0, 20)}...`);

      return signedContext;
    } catch (error) {
      console.error('❌ Signing failed:', error.message);
      throw error;
    }
  }

  /**
   * Verify a signed context
   */
  async verifyContext(signedContext: any) {
    try {
      console.log(`🔍 Verifying signature from key: ${signedContext.keyId}`);
      
      const startTime = Date.now();
      const verification = await this.signer.verify(signedContext);
      const verifyTime = Date.now() - startTime;

      if (verification.isValid) {
        console.log(`✅ Signature verified in ${verifyTime}ms`);
        console.log(`   Context type: ${verification.context?.type}`);
        return verification;
      } else {
        console.log(`❌ Signature verification failed: ${verification.error}`);
        return verification;
      }
    } catch (error) {
      console.error('💥 Verification error:', error.message);
      return { isValid: false, error: error.message };
    }
  }
}

// Example usage
async function basicSigningExample() {
  const signer = new FDC3Signer('arn-kms-region-account:key/your-key-id');

  // Sign different types of contexts
  const contexts = [
    {
      type: 'fdc3.instrument',
      id: { ticker: 'AAPL', ISIN: 'US0378331005' },
      name: 'Apple Inc.'
    },
    {
      type: 'fdc3.order',
      id: { orderId: 'ORD-12345' },
      instrument: { type: 'fdc3.instrument', id: { ticker: 'AAPL' } },
      side: 'buy',
      quantity: 100,
      price: 150.25
    }
  ];

  for (const context of contexts) {
    const signed = await signer.signContext(context);
    const verification = await signer.verifyContext(signed);
    
    console.log(`${context.type}: ${verification.isValid ? 'VERIFIED' : 'FAILED'}\n`);
  }
}
```

## 📡 FDC3 Integration Examples

### Complete FDC3 App with Signing

```typescript
import { getAgent } from '@finos/fdc3';
import { FDC3AWSKMSSigner } from 'fdc3-aws-kms-signer';

class SecureFDC3App {
  private fdc3: any;
  private signer: FDC3AWSKMSSigner;
  private isSigningEnabled: boolean = false;

  constructor(private appName: string, private keyId: string) {}

  /**
   * Initialize FDC3 with AWS KMS signing
   */
  async initialize() {
    console.log(`🚀 Initializing ${this.appName} with AWS KMS signing...`);

    try {
      // Initialize FDC3
      this.fdc3 = await getAgent();
      console.log('✅ FDC3 agent ready');

      // Initialize AWS KMS signer
      this.signer = new FDC3AWSKMSSigner({
        keyId: this.keyId,
        region: process.env.AWS_REGION || 'us-east-1'
      });

      // Test signing capability
      await this.testSigning();
      this.isSigningEnabled = true;

      // Setup secure listeners
      await this.setupSecureListeners();

      console.log(`✅ ${this.appName} initialized with secure messaging`);
    } catch (error) {
      console.error('❌ Initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * Test AWS KMS signing capability
   */
  private async testSigning() {
    const testContext = { type: 'fdc3.instrument', id: { ticker: 'TEST' } };
    const signed = await this.signer.sign(testContext);
    const verified = await this.signer.verify(signed);
    
    if (!verified.isValid) {
      throw new Error('AWS KMS signing test failed');
    }
    
    console.log('✅ AWS KMS signing test passed');
  }

  /**
   * Setup FDC3 listeners with automatic signature verification
   */
  private async setupSecureListeners() {
    // Universal context listener with verification
    await this.fdc3.addContextListener(null, async (context, metadata) => {
      await this.handleIncomingContext(context, metadata);
    });

    // Intent listener with verification
    await this.fdc3.addIntentListener('PlaceOrder', async (context, metadata) => {
      console.log('📋 Received PlaceOrder intent');
      await this.handleIncomingContext(context, metadata, { isIntent: true });
    });

    console.log('👂 Secure FDC3 listeners configured');
  }

  /**
   * Handle incoming contexts with signature verification
   */
  private async handleIncomingContext(context: any, metadata: any, options: any = {}) {
    const source = metadata?.source || 'unknown';
    const isIntent = options.isIntent || false;
    
    console.log(`📨 ${this.appName}: Received ${context.type} from ${source}${isIntent ? ' (intent)' : ''}`);

    if (this.isSignedContext(context)) {
      console.log('🔐 Context is signed, verifying...');
      
      const verification = await this.signer.verify(context);
      
      if (verification.isValid) {
        console.log('✅ Signature verified - processing with HIGH TRUST');
        await this.processVerifiedContext(verification.context, metadata, options);
      } else {
        console.log('❌ Invalid signature - SECURITY INCIDENT');
        await this.handleSecurityIncident(context, verification.error, metadata);
      }
    } else {
      console.log('📝 Context is unsigned - processing with STANDARD TRUST');
      await this.processUnsignedContext(context, metadata, options);
    }
  }

  /**
   * Sign and broadcast a context
   */
  async signAndBroadcast(context: any) {
    console.log(`🔐 ${this.appName}: Signing and broadcasting ${context.type}...`);

    try {
      if (this.isSigningEnabled) {
        const signedContext = await this.signer.sign(context);
        console.log(`✅ Context signed with key: ${this.keyId.split('/').pop()}`);
        
        // Broadcast the signed context
        await this.fdc3.broadcast(signedContext.context);
        
        return signedContext;
      } else {
        console.log('⚠️  Signing not available, broadcasting unsigned');
        await this.fdc3.broadcast(context);
        return context;
      }
    } catch (error) {
      console.error('❌ Failed to sign and broadcast:', error.message);
      throw error;
    }
  }

  /**
   * Sign and raise an intent
   */
  async signAndRaiseIntent(intent: string, context: any, target?: any) {
    console.log(`🎯 ${this.appName}: Signing and raising intent ${intent}...`);

    try {
      if (this.isSigningEnabled) {
        const signedContext = await this.signer.sign(context);
        console.log(`✅ Intent context signed`);
        
        return await this.fdc3.raiseIntent(intent, signedContext, target);
      } else {
        console.log('⚠️  Signing not available, raising unsigned intent');
        return await this.fdc3.raiseIntent(intent, context, target);
      }
    } catch (error) {
      console.error('❌ Failed to sign and raise intent:', error.message);
      throw error;
    }
  }

  /**
   * Check if context is signed
   */
  private isSignedContext(context: any): boolean {
    return context && 
           typeof context.signature === 'string' &&
           typeof context.keyId === 'string' &&
           typeof context.timestamp === 'number' &&
           context.context &&
           typeof context.context.type === 'string';
  }

  /**
   * Process verified (trusted) contexts
   */
  private async processVerifiedContext(context: any, metadata: any, options: any) {
    console.log(`🛡️  Processing VERIFIED ${context.type} with HIGH TRUST`);
    
    switch (context.type) {
      case 'fdc3.instrument':
        await this.handleVerifiedInstrument(context);
        break;
      case 'fdc3.order':
        await this.handleVerifiedOrder(context, options.isIntent);
        break;
      case 'fdc3.portfolio':
        await this.handleVerifiedPortfolio(context);
        break;
      default:
        console.log(`   Processing verified ${context.type}`);
    }
  }

  /**
   * Process unsigned contexts
   */
  private async processUnsignedContext(context: any, metadata: any, options: any) {
    console.log(`📝 Processing UNSIGNED ${context.type} with STANDARD TRUST`);
    
    // Apply security policies for unsigned contexts
    switch (context.type) {
      case 'fdc3.order':
        if (options.isIntent) {
          console.log('⚠️  Unsigned order intent - requires additional approval');
        }
        await this.handleUnsignedOrder(context);
        break;
      default:
        console.log(`   Processing unsigned ${context.type}`);
    }
  }

  /**
   * Handle security incidents
   */
  private async handleSecurityIncident(context: any, error: string, metadata: any) {
    console.error(`🚨 SECURITY INCIDENT in ${this.appName}`);
    console.error(`   Context: ${context.context?.type}`);
    console.error(`   Source: ${metadata?.source}`);
    console.error(`   Error: ${error}`);
    
    // Log to security monitoring system
    this.logSecurityEvent('invalid_signature', {
      app: this.appName,
      contextType: context.context?.type,
      source: metadata?.source,
      error: error,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Example handlers for different context types
   */
  private async handleVerifiedInstrument(instrument: any) {
    console.log(`   📈 Verified instrument: ${instrument.id?.ticker}`);
    // Your instrument handling logic with high trust
  }

  private async handleVerifiedOrder(order: any, isIntent: boolean = false) {
    console.log(`   📋 Verified order: ${order.id?.orderId} (${isIntent ? 'intent' : 'broadcast'})`);
    console.log(`      ${order.side} ${order.quantity} ${order.instrument?.id?.ticker}`);
    // Your order handling logic with high trust - can auto-approve
  }

  private async handleVerifiedPortfolio(portfolio: any) {
    console.log(`   💼 Verified portfolio: ${portfolio.id?.portfolioId || portfolio.name}`);
    // Your portfolio handling logic with high trust
  }

  private async handleUnsignedOrder(order: any) {
    console.log(`   ⚠️  Unsigned order: ${order.id?.orderId} - applying strict validation`);
    // Your order handling logic with standard trust - requires approval
  }

  private logSecurityEvent(type: string, details: any) {
    console.error(`🚨 SECURITY LOG: ${type}`, JSON.stringify(details, null, 2));
    // In production: send to your security monitoring system
  }
}

// Example usage
async function fdc3IntegrationExample() {
  // Initialize different apps with their own keys
  const tradingApp = new SecureFDC3App(
    'TradingApp',
    'arn-kms-region-account:key/trading-key-id'
  );

  const riskApp = new SecureFDC3App(
    'RiskApp', 
    'arn-kms-region-account:key/risk-key-id'
  );

  // Initialize both apps
  await tradingApp.initialize();
  await riskApp.initialize();

  // Trading app creates and broadcasts signed order
  const orderContext = {
    type: 'fdc3.order',
    id: { orderId: 'SECURE-001' },
    instrument: { type: 'fdc3.instrument', id: { ticker: 'AAPL' } },
    side: 'buy',
    quantity: 100,
    price: 150.25,
    timestamp: new Date().toISOString()
  };

  await tradingApp.signAndBroadcast(orderContext);

  // Trading app raises signed intent
  await tradingApp.signAndRaiseIntent('PlaceOrder', orderContext);
}
```