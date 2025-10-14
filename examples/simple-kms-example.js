/**
 * Simple FDC3 KMS Signing Example
 * 
 * This example shows the basic usage of FDC3 KMS signing functionality.
 * Run with: node examples/simple-kms-example.js
 */

// Note: In a real application, you would import from the installed packages
// import { getAgent, withKMSSigning } from '@finos/fdc3';

async function demonstrateKMSSigning() {
  console.log('🔐 FDC3 KMS Signing Demo');
  console.log('========================\n');

  try {
    // Step 1: Get FDC3 agent and add KMS signing capabilities
    console.log('1. Setting up FDC3 with KMS signing...');
    
    // In a real app, you would do:
    // const agent = await getAgent();
    // const signingAgent = withKMSSigning(agent);
    
    // For demo purposes, we'll simulate this
    const signingAgent = {
      configureKMSSigner: async (config) => {
        console.log(`   ✓ Configured KMS signer with key: ${config.keyId}`);
        console.log(`   ✓ Region: ${config.region}`);
      },
      
      sign: async (context) => {
        console.log(`   ✓ Signing ${context.type} context...`);
        return {
          context: context,
          signature: 'base64-encoded-signature-would-be-here',
          keyId: 'your-kms-key-id',
          timestamp: Date.now(),
          algorithm: 'RSASSA_PKCS1_V1_5_SHA_256'
        };
      },
      
      verify: async (signedContext) => {
        console.log(`   ✓ Verifying signature for ${signedContext.context.type}...`);
        return {
          isValid: true,
          context: signedContext.context
        };
      },
      
      broadcast: async (context) => {
        console.log(`   ✓ Broadcasting ${context.type} to other applications`);
      }
    };

    // Step 2: Configure KMS signing
    console.log('\n2. Configuring AWS KMS...');
    await signingAgent.configureKMSSigner({
      keyId: 'arn-kms-region-account:key/12345678-1234-1234-1234-123456789012',
      region: 'us-east-1'
    });

    // Step 3: Create and sign an FDC3 context
    console.log('\n3. Creating and signing FDC3 context...');
    
    const instrumentContext = {
      type: 'fdc3.instrument',
      id: {
        ticker: 'AAPL',
        ISIN: 'US0378331005'
      },
      name: 'Apple Inc.',
      market: {
        MIC: 'XNAS',
        name: 'NASDAQ'
      }
    };

    console.log('   Original context:', JSON.stringify(instrumentContext, null, 2));
    
    const signedInstrument = await signingAgent.sign(instrumentContext);
    console.log('\n   Signed context created:');
    console.log(`   - Signature: ${signedInstrument.signature.substring(0, 20)}...`);
    console.log(`   - Key ID: ${signedInstrument.keyId}`);
    console.log(`   - Timestamp: ${new Date(signedInstrument.timestamp).toISOString()}`);
    console.log(`   - Algorithm: ${signedInstrument.algorithm}`);

    // Step 4: Verify the signature
    console.log('\n4. Verifying signature...');
    
    const verificationResult = await signingAgent.verify(signedInstrument);
    
    if (verificationResult.isValid) {
      console.log('   ✅ Signature verification successful!');
      console.log('   ✅ Context data is authentic and untampered');
    } else {
      console.log('   ❌ Signature verification failed');
      console.log(`   Error: ${verificationResult.error}`);
    }

    // Step 5: Broadcast the signed context
    console.log('\n5. Broadcasting signed context...');
    await signingAgent.broadcast(signedInstrument.context);

    // Step 6: Demonstrate use cases
    console.log('\n6. Use Cases:');
    console.log('   📊 Trading: Sign order contexts for audit trails');
    console.log('   🏦 Compliance: Verify data integrity for regulatory reporting');
    console.log('   🔒 Security: Authenticate inter-app communications');
    console.log('   📈 Analytics: Ensure data provenance in financial models');

    console.log('\n✨ Demo completed successfully!');
    
  } catch (error) {
    console.error('❌ Demo failed:', error.message);
  }
}

// Integration example with FDC3 context listeners
function demonstrateContextListener() {
  console.log('\n🎯 Context Listener Integration');
  console.log('==============================\n');

  // Simulate receiving contexts from other applications
  const mockContexts = [
    {
      type: 'fdc3.instrument',
      id: { ticker: 'GOOGL' },
      name: 'Alphabet Inc.',
      // This would be a signed context in reality
      signature: 'mock-signature',
      keyId: 'mock-key-id',
      timestamp: Date.now(),
      algorithm: 'RSASSA_PKCS1_V1_5_SHA_256'
    },
    {
      type: 'fdc3.contact',
      id: { email: 'trader@example.com' },
      name: 'John Trader'
      // This is an unsigned context
    }
  ];

  console.log('Setting up context listener that handles both signed and unsigned contexts...\n');

  mockContexts.forEach((context, index) => {
    console.log(`Received context ${index + 1}:`);
    console.log(`  Type: ${context.type}`);
    
    if (context.signature) {
      console.log('  🔐 This context is signed');
      console.log('  ✓ Verifying signature...');
      console.log('  ✅ Signature valid - processing with high trust');
    } else {
      console.log('  📝 This context is unsigned');
      console.log('  ⚠️  Processing with standard trust level');
    }
    console.log('');
  });
}

// Run the demonstrations
if (require.main === module) {
  demonstrateKMSSigning()
    .then(() => demonstrateContextListener())
    .catch(console.error);
}

module.exports = {
  demonstrateKMSSigning,
  demonstrateContextListener
};