/**
 * Demo App: FDC3 with AWS KMS Signing
 * 
 * This demonstrates how to use the standalone AWS KMS signer
 * with standard FDC3 in your application
 */

const { FDC3AWSKMSSigner } = require('fdc3-aws-kms-signer');

class DemoFDC3App {
  constructor() {
    this.awsKmsSigner = null;
    this.isSigningEnabled = false;
    this.fdc3 = null;
    this.receivedContexts = [];
  }

  async initialize() {
    console.log('🚀 Initializing Demo FDC3 App with AWS KMS Signing...');

    try {
      // Initialize FDC3 (simulate or use real FDC3)
      await this.initializeFDC3();

      // Initialize AWS KMS signer
      const awsConfig = {
        keyId: process.env.AWS_KMS_KEY_ID || 'arn-kms-region-account:key025a714f-7218-4c6d-8699-11c45bd839da',
        region: process.env.AWS_REGION || 'us-east-1'
      };

      // Add credentials if provided
      if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
        awsConfig.credentials = {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        };
      }

      this.awsKmsSigner = new FDC3AWSKMSSigner(awsConfig);

      // Test the signer
      const testContext = {
        type: 'fdc3.instrument',
        id: { ticker: 'DEMO' },
        name: 'Demo Instrument'
      };

      const signed = await this.awsKmsSigner.sign(testContext);
      const verified = await this.awsKmsSigner.verify(signed);

      if (verified.isValid) {
        this.isSigningEnabled = true;
        console.log('✅ AWS KMS signing initialized successfully');
      } else {
        throw new Error('AWS KMS signing test failed');
      }

      // Setup FDC3 listeners
      await this.setupFDC3Listeners();

    } catch (error) {
      console.warn('⚠️  AWS KMS signing not available:', error.message);
      console.log('   Continuing without signing...');
    }

    console.log('🎉 Demo app initialized!');
  }

  async initializeFDC3() {
    // Try to get real FDC3 agent, fallback to simulation
    try {
      // In a real browser environment, you'd use:
      // const { getAgent } = await import('@finos/fdc3');
      // this.fdc3 = await getAgent();
      
      // For demo purposes, create a simulated FDC3 agent
      this.fdc3 = this.createSimulatedFDC3();
      console.log('📡 FDC3 agent ready (simulated)');
    } catch (error) {
      console.log('📡 Using simulated FDC3 for demo');
      this.fdc3 = this.createSimulatedFDC3();
    }
  }

  createSimulatedFDC3() {
    const listeners = [];
    const intentListeners = [];
    
    return {
      // Broadcast function
      broadcast: async (context) => {
        console.log(`📡 Broadcasting ${context.type}...`);
        
        // Simulate delay
        await new Promise(resolve => setTimeout(resolve, 10));
        
        // Notify all listeners
        for (const listener of listeners) {
          try {
            await listener.handler(context, { source: 'demo-app' });
          } catch (error) {
            console.error('Listener error:', error.message);
          }
        }
      },

      // Add context listener
      addContextListener: async (contextType, handler) => {
        const listener = {
          contextType,
          handler,
          id: `listener-${Date.now()}-${Math.random()}`
        };
        listeners.push(listener);
        console.log(`👂 Added context listener for ${contextType || 'all contexts'}`);
        return listener;
      },

      // Add intent listener
      addIntentListener: async (intent, handler) => {
        const listener = {
          intent,
          handler,
          id: `intent-${Date.now()}-${Math.random()}`
        };
        intentListeners.push(listener);
        console.log(`🎯 Added intent listener for ${intent}`);
        return listener;
      },

      // Raise intent
      raiseIntent: async (intent, context) => {
        console.log(`🎯 Raising intent ${intent}...`);
        
        for (const listener of intentListeners) {
          if (listener.intent === intent) {
            try {
              await listener.handler(context, { source: 'demo-app' });
            } catch (error) {
              console.error('Intent listener error:', error.message);
            }
          }
        }
      }
    };
  }

  async setupFDC3Listeners() {
    console.log('👂 Setting up FDC3 listeners...');

    // Universal context listener (receives all contexts)
    await this.fdc3.addContextListener(null, async (context, metadata) => {
      await this.handleIncomingContext(context, metadata);
    });

    // Specific order intent listener
    await this.fdc3.addIntentListener('PlaceOrder', async (context, metadata) => {
      await this.handleOrderIntent(context, metadata);
    });

    console.log('✅ FDC3 listeners configured');
  }

  async handleIncomingContext(context, metadata) {
    const timestamp = new Date().toISOString();
    const source = metadata?.source || 'unknown';
    
    console.log(`\n📨 [${timestamp}] Received context from ${source}`);
    console.log(`   Type: ${context.type}`);
    
    // Check if this is a signed context
    if (this.isSignedContext(context)) {
      console.log('🔐 Detected signed context - verifying...');
      await this.handleSignedContext(context, metadata);
    } else {
      console.log('📝 Processing unsigned context');
      await this.handleUnsignedContext(context, metadata);
    }

    // Store for tracking
    this.receivedContexts.push({
      context,
      metadata,
      timestamp,
      signed: this.isSignedContext(context)
    });
  }

  async handleSignedContext(signedContext, metadata) {
    if (!this.isSigningEnabled) {
      console.log('⚠️  Cannot verify - AWS KMS signing not available');
      return;
    }

    try {
      const verification = await this.awsKmsSigner.verify(signedContext);
      
      if (verification.isValid) {
        console.log('✅ Signature verified - context is authentic');
        console.log(`   Original context: ${verification.context.type}`);
        
        // Process the verified context
        await this.processVerifiedContext(verification.context, metadata);
      } else {
        console.log('❌ Signature verification failed:', verification.error);
        console.log('🚨 Security alert: Potentially tampered context detected');
      }
    } catch (error) {
      console.error('💥 Error verifying signature:', error.message);
    }
  }

  async handleUnsignedContext(context, metadata) {
    console.log('📋 Processing unsigned context:');
    
    switch (context.type) {
      case 'fdc3.instrument':
        console.log(`   📈 Instrument: ${context.id?.ticker || context.name}`);
        break;
      case 'fdc3.order':
        console.log(`   📋 Order: ${context.side} ${context.quantity} ${context.instrument?.id?.ticker}`);
        break;
      default:
        console.log(`   📄 Context: ${JSON.stringify(context, null, 2)}`);
    }
  }

  async processVerifiedContext(context, metadata) {
    console.log('🛡️  Processing VERIFIED context with high trust:');
    
    switch (context.type) {
      case 'fdc3.instrument':
        console.log(`   📈 Verified instrument: ${context.id?.ticker || context.name}`);
        break;
      case 'fdc3.order':
        console.log(`   📋 Verified order: ${context.side} ${context.quantity} ${context.instrument?.id?.ticker}`);
        console.log('   ✅ Auto-approved due to verified signature');
        break;
      default:
        console.log(`   📄 Verified context: ${JSON.stringify(context, null, 2)}`);
    }
  }

  async handleOrderIntent(context, metadata) {
    console.log(`\n🎯 Order intent received from ${metadata?.source || 'unknown'}`);
    
    if (this.isSignedContext(context)) {
      console.log('🔐 Signed order intent - high priority processing');
      await this.handleSignedContext(context, metadata);
    } else {
      console.log('📝 Unsigned order intent - standard processing');
      await this.handleUnsignedContext(context, metadata);
    }
  }

  isSignedContext(context) {
    return context && 
           typeof context.signature === 'string' &&
           typeof context.keyId === 'string' &&
           typeof context.timestamp === 'number' &&
           context.context &&
           context.algorithm;
  }

  async demonstrateSigningAndVerification() {
    console.log('\n🔐 Demonstrating AWS KMS Signing and Verification');
    console.log('=================================================');

    if (!this.isSigningEnabled) {
      console.log('❌ AWS KMS signing not available');
      return;
    }

    // Create sample contexts
    const contexts = [
      {
        type: 'fdc3.instrument',
        id: { ticker: 'AAPL', ISIN: 'US0378331005' },
        name: 'Apple Inc.'
      },
      {
        type: 'fdc3.order',
        id: { orderId: 'DEMO-001' },
        instrument: { type: 'fdc3.instrument', id: { ticker: 'AAPL' } },
        side: 'buy',
        quantity: 100,
        price: 150.25
      }
    ];

    for (const context of contexts) {
      console.log(`\n📝 Processing ${context.type}...`);
      
      try {
        // Sign the context
        const startTime = Date.now();
        const signedContext = await this.awsKmsSigner.sign(context);
        const signingTime = Date.now() - startTime;

        console.log(`   ✅ Signed in ${signingTime}ms`);
        console.log(`   📊 Signature: ${signedContext.signature.substring(0, 20)}...`);

        // Verify the signature
        const verifyStartTime = Date.now();
        const verification = await this.awsKmsSigner.verify(signedContext);
        const verifyTime = Date.now() - verifyStartTime;

        if (verification.isValid) {
          console.log(`   ✅ Verified in ${verifyTime}ms`);
          console.log(`   🛡️  Context is authentic and trusted`);
        } else {
          console.log(`   ❌ Verification failed: ${verification.error}`);
        }

        // Demonstrate tamper detection
        console.log(`   🧪 Testing tamper detection...`);
        const tamperedContext = {
          ...signedContext,
          signature: signedContext.signature.replace(/[A-Za-z]/, 'X')
        };

        const tamperedVerification = await this.awsKmsSigner.verify(tamperedContext);
        if (!tamperedVerification.isValid) {
          console.log(`   ✅ Tamper detection working: ${tamperedVerification.error}`);
        } else {
          console.log(`   ❌ Tamper detection failed!`);
        }

      } catch (error) {
        console.error(`   ❌ Error processing ${context.type}:`, error.message);
      }
    }
  }

  async simulateFDC3Workflow() {
    console.log('\n📡 Simulating FDC3 Workflow with AWS KMS');
    console.log('========================================');

    if (!this.isSigningEnabled) {
      console.log('❌ AWS KMS signing not available for workflow');
      return;
    }

    // Simulate App1 sending signed context to App2
    console.log('🏦 App1 (Trading): Creating signed order...');
    
    const orderContext = {
      type: 'fdc3.order',
      id: { orderId: `WORKFLOW-${Date.now()}` },
      instrument: { type: 'fdc3.instrument', id: { ticker: 'MSFT' } },
      side: 'buy',
      quantity: 200,
      price: 300.50,
      timestamp: new Date().toISOString()
    };

    const signedOrder = await this.awsKmsSigner.sign(orderContext);
    console.log('   ✅ Order signed by App1');

    // Simulate App2 receiving and verifying
    console.log('\n🛡️  App2 (Risk): Receiving and verifying order...');
    
    const verification = await this.awsKmsSigner.verify(signedOrder);
    
    if (verification.isValid) {
      console.log('   ✅ App2: Order signature verified');
      console.log('   📋 Order details:');
      console.log(`      Order ID: ${verification.context.id.orderId}`);
      console.log(`      Instrument: ${verification.context.instrument.id.ticker}`);
      console.log(`      Side: ${verification.context.side}`);
      console.log(`      Quantity: ${verification.context.quantity}`);
      console.log('   🎯 Risk check: APPROVED (verified signature)');
    } else {
      console.log('   ❌ App2: Invalid signature - order rejected');
    }
  }

  getStatus() {
    return {
      signingEnabled: this.isSigningEnabled,
      keyId: this.awsKmsSigner?.config?.keyId || 'N/A',
      region: this.awsKmsSigner?.config?.region || 'N/A'
    };
  }
}

// Run the demo
async function runDemo() {
  console.log('🎬 FDC3 AWS KMS Demo Application');
  console.log('================================\n');

  const app = new DemoFDC3App();
  
  try {
    await app.initialize();
    
    console.log('\n📊 App Status:', app.getStatus());
    
    await app.demonstrateSigningAndVerification();
    await app.simulateFDC3Workflow();
    
    console.log('\n🎉 Demo completed successfully!');
    console.log('\n💡 This shows how to integrate AWS KMS signing');
    console.log('   with your existing FDC3 application using the');
    console.log('   standalone package approach.');
    
  } catch (error) {
    console.error('❌ Demo failed:', error.message);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  runDemo();
}

module.exports = { DemoFDC3App };