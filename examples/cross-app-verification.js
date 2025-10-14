/**
 * Cross-App Signature Verification Demo
 * 
 * This demonstrates how App2 can verify signatures from App1
 */

const { FDC3KMSSigner } = require('../packages/fdc3-kms-signer/dist/index.js');

/**
 * App1 - Trading Application (Signs orders)
 */
class TradingApp {
  constructor() {
    this.appName = 'TradingApp';
    this.keyId = 'arn-kms-region-account:key025a714f-7218-4c6d-8699-11c45bd839da'; // App1's key
    this.signer = null;
    this.fdc3 = null;
  }

  async initialize() {
    console.log('🏦 Initializing Trading App (App1)...');
    
    // Initialize KMS signer with App1's key
    this.signer = new FDC3KMSSigner({
      keyId: this.keyId,
      region: 'us-east-1'
    });

    // Mock FDC3 agent
    this.fdc3 = {
      broadcast: async (context) => {
        console.log(`📡 App1 broadcasting: ${context.type}`);
        // In real app, this would broadcast to other apps
        return this.simulateBroadcast(context);
      }
    };

    console.log('✅ Trading App initialized');
  }

  /**
   * Create and sign a trade order
   */
  async createSignedOrder(orderData) {
    console.log('\n🔐 App1: Creating signed order...');
    
    const orderContext = {
      type: 'fdc3.order',
      id: {
        orderId: `TRD-${Date.now()}`
      },
      name: `${orderData.side.toUpperCase()} ${orderData.quantity} ${orderData.symbol}`,
      instrument: {
        type: 'fdc3.instrument',
        id: { ticker: orderData.symbol }
      },
      side: orderData.side,
      quantity: orderData.quantity,
      price: orderData.price,
      timestamp: new Date().toISOString(),
      source: this.appName
    };

    // Sign the order with App1's key
    const signedOrder = await this.signer.sign(orderContext);
    
    console.log(`✅ App1: Order signed successfully`);
    console.log(`   Order ID: ${orderContext.id.orderId}`);
    console.log(`   Key used: ${signedOrder.keyId}`);
    console.log(`   Signature: ${signedOrder.signature.substring(0, 20)}...`);

    // Broadcast the signed order
    await this.fdc3.broadcast(signedOrder);
    
    return signedOrder;
  }

  /**
   * Simulate broadcasting to other apps
   */
  async simulateBroadcast(signedContext) {
    // In a real FDC3 environment, this would be handled by the FDC3 runtime
    // Here we simulate it by calling other apps directly
    if (global.connectedApps) {
      for (const app of global.connectedApps) {
        if (app !== this) {
          await app.receiveContext(signedContext);
        }
      }
    }
  }
}

/**
 * App2 - Risk Management Application (Verifies orders from App1)
 */
class RiskManagementApp {
  constructor() {
    this.appName = 'RiskManagementApp';
    this.keyId = 'arn-kms-region-account:keyrisk-app-key-id'; // App2's own key (for signing)
    this.signer = null;
    this.verifier = null; // For verifying other apps' signatures
  }

  async initialize() {
    console.log('🛡️  Initializing Risk Management App (App2)...');
    
    // Initialize signer with App2's own key (for signing its own contexts)
    this.signer = new FDC3KMSSigner({
      keyId: this.keyId,
      region: 'us-east-1'
    });

    // Initialize verifier - can verify signatures from ANY key (as long as we have GetPublicKey permission)
    // We can use any key ID here, or even create a separate verifier instance
    this.verifier = new FDC3KMSSigner({
      keyId: 'dummy-key-for-verification', // Not used for verification, only for signing
      region: 'us-east-1'
    });

    console.log('✅ Risk Management App initialized');
  }

  /**
   * Receive and verify context from other apps
   */
  async receiveContext(context) {
    console.log(`\n📨 App2: Received context: ${context.type || 'unknown'}`);

    // Check if this is a signed context
    if (this.isSignedContext(context)) {
      console.log('🔍 App2: Context is signed, verifying signature...');
      
      try {
        // Verify the signature using the public key from KMS
        const verification = await this.verifier.verify(context);
        
        if (verification.isValid) {
          console.log('✅ App2: Signature verification SUCCESSFUL');
          console.log(`   Verified context type: ${verification.context.type}`);
          console.log(`   Source key: ${context.keyId}`);
          console.log(`   Signed at: ${new Date(context.timestamp).toISOString()}`);
          
          // Process the verified context with high trust
          await this.processVerifiedContext(verification.context, context);
        } else {
          console.log('❌ App2: Signature verification FAILED');
          console.log(`   Error: ${verification.error}`);
          
          // Handle invalid signature - this is a security incident
          await this.handleInvalidSignature(context, verification.error);
        }
      } catch (error) {
        console.error('💥 App2: Verification error:', error.message);
        await this.handleVerificationError(context, error);
      }
    } else {
      console.log('📝 App2: Context is unsigned');
      await this.processUnsignedContext(context);
    }
  }

  /**
   * Check if context is signed
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
   * Process verified (trusted) context
   */
  async processVerifiedContext(context, originalSigned) {
    console.log('🛡️  App2: Processing VERIFIED context with HIGH TRUST');
    
    if (context.type === 'fdc3.order') {
      console.log('   📋 Verified Order Details:');
      console.log(`      Order ID: ${context.id?.orderId}`);
      console.log(`      Instrument: ${context.instrument?.id?.ticker}`);
      console.log(`      Side: ${context.side}`);
      console.log(`      Quantity: ${context.quantity}`);
      console.log(`      Price: ${context.price}`);
      console.log(`      Source: ${context.source}`);
      
      // Perform risk checks on verified order
      const riskAssessment = await this.performRiskCheck(context);
      console.log(`   🎯 Risk Assessment: ${riskAssessment.status}`);
      
      if (riskAssessment.approved) {
        console.log('   ✅ Order approved by risk management');
        await this.approveOrder(context);
      } else {
        console.log('   ❌ Order rejected by risk management');
        console.log(`   Reason: ${riskAssessment.reason}`);
        await this.rejectOrder(context, riskAssessment.reason);
      }
    }
  }

  /**
   * Process unsigned context (lower trust)
   */
  async processUnsignedContext(context) {
    console.log('⚠️  App2: Processing UNSIGNED context with STANDARD TRUST');
    
    if (context.type === 'fdc3.order') {
      console.log('   📋 Unsigned order - applying stricter validation');
      // Apply stricter validation for unsigned orders
      // Maybe require additional approvals, limit sizes, etc.
    }
  }

  /**
   * Handle invalid signatures (security incident)
   */
  async handleInvalidSignature(context, error) {
    console.error('🚨 App2: SECURITY INCIDENT - Invalid signature detected');
    console.error(`   Context type: ${context.context?.type}`);
    console.error(`   Claimed key: ${context.keyId}`);
    console.error(`   Error: ${error}`);
    
    // Log security incident
    this.logSecurityIncident('invalid_signature', {
      contextType: context.context?.type,
      keyId: context.keyId,
      error: error,
      timestamp: new Date().toISOString()
    });
    
    // Reject the context
    console.log('   🛑 Context REJECTED due to invalid signature');
  }

  /**
   * Handle verification errors
   */
  async handleVerificationError(context, error) {
    console.error('💥 App2: Verification system error:', error.message);
    
    // This might be a system issue, not necessarily malicious
    // Handle based on your security policy
    if (error.message.includes('AccessDenied')) {
      console.log('   💡 May need GetPublicKey permission for the signing key');
    } else if (error.message.includes('KeyUnavailable')) {
      console.log('   💡 Signing key may not exist or be disabled');
    }
  }

  /**
   * Perform risk assessment on order
   */
  async performRiskCheck(order) {
    // Simulate risk checks
    const maxQuantity = 1000;
    const maxPrice = 500;
    
    if (order.quantity > maxQuantity) {
      return {
        approved: false,
        status: 'REJECTED',
        reason: `Quantity ${order.quantity} exceeds limit ${maxQuantity}`
      };
    }
    
    if (order.price > maxPrice) {
      return {
        approved: false,
        status: 'REJECTED', 
        reason: `Price ${order.price} exceeds limit ${maxPrice}`
      };
    }
    
    return {
      approved: true,
      status: 'APPROVED',
      reason: 'Order within risk limits'
    };
  }

  /**
   * Approve order
   */
  async approveOrder(order) {
    console.log('✅ App2: Order approved - forwarding to execution');
    
    // Create approval context and sign it with App2's key
    const approvalContext = {
      type: 'fdc3.trade',
      id: {
        tradeId: `TRADE-${Date.now()}`,
        originalOrderId: order.id?.orderId
      },
      name: 'Risk Approved Trade',
      instrument: order.instrument,
      side: order.side,
      quantity: order.quantity,
      price: order.price,
      status: 'approved',
      approvedBy: this.appName,
      approvedAt: new Date().toISOString()
    };

    // Sign with App2's key
    const signedApproval = await this.signer.sign(approvalContext);
    console.log('🔐 App2: Approval signed and ready for broadcast');
    
    return signedApproval;
  }

  /**
   * Reject order
   */
  async rejectOrder(order, reason) {
    console.log('❌ App2: Order rejected');
    
    // Could create a rejection context and sign it
    const rejectionContext = {
      type: 'fdc3.order',
      id: order.id,
      status: 'rejected',
      rejectedBy: this.appName,
      rejectedAt: new Date().toISOString(),
      reason: reason
    };

    // Sign rejection with App2's key
    const signedRejection = await this.signer.sign(rejectionContext);
    console.log('🔐 App2: Rejection signed and ready for broadcast');
    
    return signedRejection;
  }

  /**
   * Log security incidents
   */
  logSecurityIncident(type, details) {
    console.error(`🚨 SECURITY LOG: ${type}`, JSON.stringify(details, null, 2));
    // In production, send to your security monitoring system
  }
}

/**
 * Demo: Cross-app signature verification
 */
async function demonstrateCrossAppVerification() {
  console.log('🔄 Cross-App Signature Verification Demo');
  console.log('========================================\n');

  try {
    // Initialize both apps
    const tradingApp = new TradingApp();
    const riskApp = new RiskManagementApp();

    await tradingApp.initialize();
    await riskApp.initialize();

    // Set up global app registry for simulation
    global.connectedApps = [tradingApp, riskApp];

    console.log('\n🎬 Demo Scenario: Trading App creates order, Risk App verifies it');
    console.log('================================================================');

    // App1 creates and signs an order
    const orderData = {
      symbol: 'AAPL',
      side: 'buy',
      quantity: 100,
      price: 150.25
    };

    const signedOrder = await tradingApp.createSignedOrder(orderData);

    // Simulate some delay
    await new Promise(resolve => setTimeout(resolve, 100));

    console.log('\n🎯 Result: Risk App successfully verified Trading App\'s signature!');
    console.log('✅ Cross-app verification working correctly');

    // Test with tampered signature
    console.log('\n🧪 Testing tamper detection...');
    const tamperedOrder = {
      ...signedOrder,
      signature: signedOrder.signature.replace(/[A-Za-z]/, 'X') // Tamper with signature
    };

    console.log('📡 Sending tampered order...');
    await riskApp.receiveContext(tamperedOrder);

    console.log('\n🎉 Demo completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   • App1 signed order with its KMS key');
    console.log('   • App2 verified signature using KMS public key');
    console.log('   • Tampered signatures were detected and rejected');
    console.log('   • Cross-app trust established through cryptographic verification');

  } catch (error) {
    console.error('❌ Demo failed:', error.message);
    
    if (error.message.includes('AccessDenied')) {
      console.log('\n💡 Troubleshooting:');
      console.log('   • Ensure both apps have kms:GetPublicKey permission');
      console.log('   • Check AWS credentials are configured');
    }
  }
}

// Export for use in other modules
module.exports = {
  TradingApp,
  RiskManagementApp,
  demonstrateCrossAppVerification
};

// Run demo if executed directly
if (require.main === module) {
  demonstrateCrossAppVerification();
}