/**
 * FDC3 Application Integration Example
 * 
 * This shows how to integrate KMS signing into your existing FDC3 application
 */

// Import the FDC3 KMS Signer (adjust path based on your setup)
const { FDC3KMSSigner } = require('../packages/fdc3-kms-signer/dist/index.js');

/**
 * Example: Trading Application with KMS Signing
 */
class TradingApp {
  constructor() {
    this.fdc3 = null;
    this.kmsSigner = null;
    this.isSigningEnabled = false;
  }

  /**
   * Initialize the app with FDC3 and KMS signing
   */
  async initialize() {
    console.log('🚀 Initializing Trading App with FDC3 KMS Signing...');

    try {
      // 1. Initialize FDC3 (your existing code)
      this.fdc3 = await this.getFDC3Agent();
      console.log('✅ FDC3 agent ready');

      // 2. Initialize KMS signing with your app's key
      await this.initializeKMSSigning();
      console.log('✅ KMS signing ready');

      // 3. Set up FDC3 listeners with signature verification
      await this.setupFDC3Listeners();
      console.log('✅ FDC3 listeners configured');

      console.log('🎉 Trading app fully initialized with secure signing!');

    } catch (error) {
      console.error('❌ Failed to initialize app:', error.message);
      // Fallback: continue without signing
      this.isSigningEnabled = false;
      console.log('⚠️  Continuing without KMS signing');
    }
  }

  /**
   * Get FDC3 agent (your existing implementation)
   */
  async getFDC3Agent() {
    // Your existing FDC3 initialization code
    if (window.fdc3) {
      return window.fdc3;
    }
    
    // Or use fdc3Ready if available
    if (window.fdc3Ready) {
      return await window.fdc3Ready();
    }
    
    throw new Error('FDC3 not available');
  }

  /**
   * Initialize KMS signing for this app
   */
  async initializeKMSSigning() {
    // Each app uses its own pre-authorized KMS key
    const appKeyId = process.env.TRADING_APP_KMS_KEY || 
                     'arn-kms-region-account:key025a714f-7218-4c6d-8699-11c45bd839da';

    this.kmsSigner = new FDC3KMSSigner({
      keyId: appKeyId,
      region: process.env.AWS_REGION || 'us-east-1'
      // AWS credentials picked up automatically from environment
    });

    // Test signing to ensure it works
    const testContext = { type: 'fdc3.instrument', id: { ticker: 'TEST' } };
    const signed = await this.kmsSigner.sign(testContext);
    const verified = await this.kmsSigner.verify(signed);
    
    if (!verified.isValid) {
      throw new Error('KMS signing test failed');
    }

    this.isSigningEnabled = true;
  }

  /**
   * Set up FDC3 listeners with signature verification
   */
  async setupFDC3Listeners() {
    // Listen for all contexts and verify signatures
    await this.fdc3.addContextListener(null, async (context, metadata) => {
      console.log(`📨 Received context from ${metadata?.source || 'unknown'}`);
      
      // Check if this is a signed context
      if (this.isSignedContext(context)) {
        console.log('🔐 Context is signed, verifying...');
        
        const verification = await this.verifySignedContext(context);
        if (verification.isValid) {
          console.log('✅ Signature verified - processing trusted context');
          await this.handleVerifiedContext(verification.context, metadata);
        } else {
          console.warn('❌ Invalid signature - rejecting context');
          await this.handleUntrustedContext(context, metadata);
        }
      } else {
        console.log('📝 Context is unsigned - processing with standard trust');
        await this.handleUnsignedContext(context, metadata);
      }
    });

    // Listen for specific intents
    await this.fdc3.addIntentListener('PlaceOrder', async (context, metadata) => {
      console.log('📋 Received PlaceOrder intent');
      
      if (this.isSignedContext(context)) {
        const verification = await this.verifySignedContext(context);
        if (verification.isValid) {
          await this.processOrder(verification.context, metadata);
        } else {
          throw new Error('Invalid signature on order - security violation');
        }
      } else {
        // Handle unsigned orders based on your security policy
        console.warn('⚠️  Received unsigned order');
        await this.processOrder(context, metadata);
      }
    });
  }

  /**
   * Check if a context is signed
   */
  isSignedContext(context) {
    return context && 
           typeof context.signature === 'string' &&
           typeof context.keyId === 'string' &&
           typeof context.timestamp === 'number' &&
           context.context &&
           typeof context.context.type === 'string';
  }

  /**
   * Verify a signed context
   */
  async verifySignedContext(signedContext) {
    if (!this.isSigningEnabled) {
      return { isValid: false, error: 'KMS signing not available' };
    }

    try {
      return await this.kmsSigner.verify(signedContext);
    } catch (error) {
      console.error('Signature verification error:', error.message);
      return { isValid: false, error: error.message };
    }
  }

  /**
   * Create and broadcast a signed order
   */
  async createAndBroadcastOrder(orderData) {
    console.log('📊 Creating new order...');

    const orderContext = {
      type: 'fdc3.order',
      id: {
        orderId: `ORD-${Date.now()}`
      },
      name: `${orderData.side.toUpperCase()} ${orderData.quantity} ${orderData.symbol}`,
      instrument: {
        type: 'fdc3.instrument',
        id: { ticker: orderData.symbol },
        name: orderData.instrumentName
      },
      side: orderData.side,
      quantity: orderData.quantity,
      price: orderData.price,
      orderType: orderData.orderType || 'market',
      timestamp: new Date().toISOString()
    };

    try {
      if (this.isSigningEnabled) {
        console.log('🔐 Signing order with KMS...');
        const signedOrder = await this.kmsSigner.sign(orderContext);
        
        console.log('✅ Order signed successfully');
        console.log(`   Key: ${signedOrder.keyId}`);
        console.log(`   Signature: ${signedOrder.signature.substring(0, 20)}...`);
        
        // Broadcast the signed context (not the wrapper)
        await this.fdc3.broadcast(signedOrder.context);
        
        // Also raise intent if needed
        await this.fdc3.raiseIntent('PlaceOrder', signedOrder);
        
        return signedOrder;
      } else {
        console.log('📝 Broadcasting unsigned order');
        await this.fdc3.broadcast(orderContext);
        return orderContext;
      }
    } catch (error) {
      console.error('❌ Failed to create/broadcast order:', error.message);
      throw error;
    }
  }

  /**
   * Handle verified (trusted) contexts
   */
  async handleVerifiedContext(context, metadata) {
    console.log(`🛡️  Processing verified ${context.type} from ${metadata?.source}`);
    
    switch (context.type) {
      case 'fdc3.instrument':
        await this.loadInstrumentData(context);
        break;
      case 'fdc3.order':
        await this.processVerifiedOrder(context);
        break;
      case 'fdc3.portfolio':
        await this.loadPortfolioData(context);
        break;
      default:
        console.log(`   Handling verified ${context.type}`);
    }
  }

  /**
   * Handle unsigned contexts (apply appropriate security policies)
   */
  async handleUnsignedContext(context, metadata) {
    console.log(`📝 Processing unsigned ${context.type} from ${metadata?.source}`);
    
    // Apply your security policies for unsigned contexts
    switch (context.type) {
      case 'fdc3.instrument':
        // Instruments might be OK unsigned for display purposes
        await this.loadInstrumentData(context);
        break;
      case 'fdc3.order':
        // Orders might require signatures in production
        console.warn('⚠️  Received unsigned order - review security policy');
        await this.processUnsignedOrder(context);
        break;
      default:
        console.log(`   Handling unsigned ${context.type}`);
    }
  }

  /**
   * Handle contexts with invalid signatures
   */
  async handleUntrustedContext(context, metadata) {
    console.error(`🚨 Rejecting context with invalid signature from ${metadata?.source}`);
    
    // Log security incident
    this.logSecurityIncident('invalid_signature', {
      contextType: context.type,
      source: metadata?.source,
      timestamp: new Date().toISOString()
    });
    
    // Optionally notify user
    this.showSecurityAlert('Received data with invalid signature - ignoring for security');
  }

  /**
   * Example: Load instrument data
   */
  async loadInstrumentData(instrument) {
    console.log(`📈 Loading data for ${instrument.id?.ticker || 'unknown instrument'}`);
    // Your existing instrument loading logic
  }

  /**
   * Example: Process verified order
   */
  async processVerifiedOrder(order) {
    console.log(`✅ Processing verified order: ${order.id?.orderId}`);
    // Your existing order processing logic with high trust
  }

  /**
   * Example: Process unsigned order
   */
  async processUnsignedOrder(order) {
    console.log(`⚠️  Processing unsigned order: ${order.id?.orderId}`);
    // Your existing order processing logic with standard trust
    // Maybe require additional confirmation
  }

  /**
   * Log security incidents
   */
  logSecurityIncident(type, details) {
    console.error(`🚨 SECURITY INCIDENT: ${type}`, details);
    // Send to your logging/monitoring system
  }

  /**
   * Show security alert to user
   */
  showSecurityAlert(message) {
    console.warn(`🔒 SECURITY ALERT: ${message}`);
    // Show user notification
  }
}

/**
 * Example usage in your app
 */
async function startTradingApp() {
  const app = new TradingApp();
  await app.initialize();

  // Example: Create and broadcast a signed order
  const orderData = {
    symbol: 'AAPL',
    instrumentName: 'Apple Inc.',
    side: 'buy',
    quantity: 100,
    price: 150.25,
    orderType: 'limit'
  };

  await app.createAndBroadcastOrder(orderData);
}

// Export for use in your application
module.exports = { TradingApp, startTradingApp };

// Run example if this file is executed directly
if (require.main === module) {
  startTradingApp().catch(console.error);
}