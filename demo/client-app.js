/**
 * FDC3 Demo Client Script
 * Uses real AWS KMS signing via API
 */

class FDC3DemoApp {
  constructor() {
    this.contexts = [];
    this.isKmsReady = false;
    this.fdc3Listeners = [];
    this.fdc3Agent = null;
    this.initialize();
  }

  async initializeFDC3() {
    try {
      // Try to dynamically import and use the standard @finos/fdc3 getAgent API
      console.log('📡 Attempting to load @finos/fdc3 module...');
      
      try {
        const fdc3Module = await import('https://cdn.jsdelivr.net/npm/@finos/fdc3@latest/+esm');
        
        if (fdc3Module && fdc3Module.getAgent) {
          console.log('📡 Using @finos/fdc3 getAgent API...');
          this.fdc3Agent = await fdc3Module.getAgent();
          console.log('✅ FDC3 Agent initialized via @finos/fdc3 getAgent()');
          return;
        }
      } catch (importError) {
        console.log('   @finos/fdc3 module not available via CDN, trying window fallback...');
      }
      
      // Fallback to window-based detection for desktop agents
      if (window.fdc3) {
        // Modern FDC3 2.0+ with getAgent on window
        if (typeof window.fdc3.getAgent === 'function') {
          console.log('📡 Using FDC3 2.0+ window.fdc3.getAgent API...');
          this.fdc3Agent = await window.fdc3.getAgent();
          console.log('✅ FDC3 Agent initialized via window.fdc3.getAgent()');
          return;
        }
        
        // Legacy FDC3 1.x - agent is directly on window
        console.log('📡 Using legacy FDC3 1.x window.fdc3...');
        this.fdc3Agent = window.fdc3;
        console.log('✅ FDC3 Agent initialized (legacy mode)');
        return;
      }
      
      // Wait for fdc3Ready promise
      if (window.fdc3Ready) {
        console.log('📡 Waiting for fdc3Ready()...');
        this.fdc3Agent = await window.fdc3Ready();
        console.log('✅ FDC3 Agent initialized via fdc3Ready()');
        return;
      }
      
      console.warn('⚠️  FDC3 not available - running in demo-only mode');
    } catch (error) {
      console.warn('⚠️  FDC3 initialization failed:', error.message);
      console.log('   Running in demo-only mode without real FDC3 broadcast');
    }
  }

  async initialize() {
    console.log('🚀 Initializing FDC3 Demo...');
    
    // Try to initialize FDC3 agent using standard API
    await this.initializeFDC3();
    
    // Check KMS status from server
    try {
      const response = await fetch('/api/status');
      const status = await response.json();
      this.isKmsReady = status.kmsReady;
      
      if (this.isKmsReady) {
        document.getElementById('kms-status').textContent = 'Ready ✅';
        document.getElementById('sign-instrument').disabled = false;
        document.getElementById('sign-order').disabled = false;
        console.log('✅ KMS Signer ready');
      } else {
        document.getElementById('kms-status').textContent = 'Not Available ⚠️';
        document.getElementById('kms-status').parentElement.className = 'status-card status-error';
        console.warn('⚠️  KMS signing not available');
      }
    } catch (error) {
      console.error('Failed to check KMS status:', error);
      document.getElementById('kms-status').textContent = 'Error ❌';
      document.getElementById('kms-status').parentElement.className = 'status-card status-error';
    }

    // Set up simulated context listeners
    this.setupContextListeners();
  }

  setupContextListeners() {
    // Simulate receiving contexts from other apps
    setInterval(() => {
      if (Math.random() < 0.05) { // 5% chance every second
        this.simulateIncomingContext();
      }
    }, 1000);
  }

  simulateIncomingContext() {
    const contexts = [
      { type: 'fdc3.instrument', id: { ticker: 'AMZN' }, name: 'Amazon.com Inc.' },
      { type: 'fdc3.instrument', id: { ticker: 'NFLX' }, name: 'Netflix Inc.' },
      { type: 'fdc3.order', id: { orderId: 'SIM-' + Date.now() }, side: 'buy', quantity: 50 }
    ];
    
    const context = contexts[Math.floor(Math.random() * contexts.length)];
    const signed = Math.random() < 0.3; // 30% chance of being signed
    
    this.receiveContext(context, {
      source: 'External App',
      signed,
      verified: signed ? Math.random() < 0.9 : null // 90% of signed contexts are valid
    });
  }

  async broadcastContext(context, shouldSign = false) {
    let finalContext = context;
    let signed = false;
    let verified = null;
    let serverSource = null;

    if (shouldSign && this.isKmsReady) {
      try {
        // Call the server API to sign with real AWS KMS
        console.log('🔐 Requesting signature from AWS KMS...');
        const signResponse = await fetch('/api/sign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ context })
        });

        const signResult = await signResponse.json();
        console.log('Sign response:', signResult);
        
        if (signResult.success && signResult.signedContext) {
          finalContext = signResult.signedContext;
          signed = true;
          verified = true; // We just signed it, so it's valid
          console.log('✅ Context signed with AWS KMS');
          
          // Check if signature exists before trying to display it
          if (finalContext.__signature__ && finalContext.__signature__.signature) {
            console.log('   Signature:', finalContext.__signature__.signature.substring(0, 40) + '...');
          } else {
            console.log('   Signed context structure:', JSON.stringify(finalContext, null, 2));
          }

          // Capture server-provided source for later display
          if (signResult && signResult.metadata && typeof signResult.metadata.source === 'string') {
            serverSource = signResult.metadata.source;
          }
        } else {
          console.error('❌ Failed to sign context:', signResult.error);
          alert('Failed to sign context: ' + signResult.error);
          return; // Don't broadcast if signing failed
        }
      } catch (error) {
        console.error('❌ Error signing context:', error);
        alert('Error signing context: ' + error.message);
        return;
      }
    }

    // Add to our own contexts (simulate receiving our own broadcast)
    const sourceForDisplay = signed && typeof serverSource === 'string'
      ? serverSource
      : 'Self';
    this.receiveContext(signed ? finalContext : context, {
      source: sourceForDisplay,
      signed,
      verified
    });

    console.log(`📡 Broadcasted ${signed ? 'signed' : 'unsigned'} context: ${context.type}`);
  }

  receiveContext(context, metadata) {
    // Ensure metadata is an object and provide a friendly default for source
    const safeMeta = metadata || {};
    const sourceLabel = typeof safeMeta.source === 'string' && safeMeta.source.trim().length > 0
      ? safeMeta.source
      : 'Unknown';

    const contextItem = {
      id: Date.now() + Math.random(),
      context,
      source: sourceLabel,
      timestamp: new Date().toISOString(),
      signed: safeMeta.signed ?? false,
      verified: safeMeta.verified ?? null
    };

    this.contexts.unshift(contextItem); // Add to beginning
    this.updateContextsDisplay();
    this.updateContextCount();
  }

  updateContextsDisplay() {
    const container = document.getElementById('contexts-list');
    
    if (this.contexts.length === 0) {
      container.innerHTML = `
        <p style="color: #6c757d; text-align: center; font-style: italic;">
          No contexts received yet. Try broadcasting an instrument or order above.
        </p>
      `;
      return;
    }

    container.innerHTML = this.contexts.slice(0, 10).map(item => {
      let badgeClass = 'badge-unsigned';
      let badgeText = 'Unsigned';
      let itemClass = 'context-item';

      if (item.signed) {
        if (item.verified) {
          badgeClass = 'badge-verified';
          badgeText = '✅ Verified';
          itemClass += ' context-verified';
        } else {
          badgeClass = 'badge-invalid';
          badgeText = '❌ Invalid';
          itemClass += ' context-invalid';
        }
      }
      const typeText = (item.context && (item.context.type || (item.context.context && item.context.context.type))) || 'unknown';
      return `
        <div class="${itemClass}">
          <div class="context-header">
            <strong>${typeText}</strong>
            <span class="verification-badge ${badgeClass}">${badgeText}</span>
          </div>
          <div style="font-size: 12px; color: #666; margin-bottom: 8px;">
            From: ${item.source} • ${new Date(item.timestamp).toLocaleTimeString()}
          </div>
          <pre>${JSON.stringify(item.context, null, 2)}</pre>
        </div>
      `;
    }).join('');
  }

  updateContextCount() {
    document.getElementById('context-count').textContent = this.contexts.length;
  }
}

// Global demo instance
let demoApp;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
  demoApp = new FDC3DemoApp();
});

// Global functions for button clicks
async function broadcastInstrument(shouldSign) {
  const ticker = document.getElementById('instrument-select').value;
  const instruments = {
    'AAPL': { type: 'fdc3.instrument', id: { ticker: 'AAPL' }, name: 'Apple Inc.' },
    'MSFT': { type: 'fdc3.instrument', id: { ticker: 'MSFT' }, name: 'Microsoft Corporation' },
    'GOOGL': { type: 'fdc3.instrument', id: { ticker: 'GOOGL' }, name: 'Alphabet Inc.' },
    'TSLA': { type: 'fdc3.instrument', id: { ticker: 'TSLA' }, name: 'Tesla, Inc.' }
  };

  await demoApp.broadcastContext(instruments[ticker], shouldSign);
}

async function createOrder(shouldSign) {
  const side = document.getElementById('order-side').value;
  const quantity = parseInt(document.getElementById('order-quantity').value) || 100;
  const price = parseFloat(document.getElementById('order-price').value) || 150.25;
  const ticker = document.getElementById('instrument-select').value;

  const order = {
    type: 'fdc3.order',
    id: { orderId: 'DEMO-' + Date.now() },
    instrument: { type: 'fdc3.instrument', id: { ticker } },
    side,
    quantity,
    price
  };

  await demoApp.broadcastContext(order, shouldSign);
}

async function sendTamperedContext() {
  const tamperedContext = {
    type: 'fdc3.instrument',
    id: { ticker: 'HACK' },
    name: 'Tampered Instrument',
    __signature__: {
      signature: 'INVALID_SIGNATURE_123',
      keyId: 'arn:aws:kms:us-east-1:123456789012:key/demo-key',
      timestamp: Date.now(),
      algorithm: 'RSASSA_PKCS1_V1_5_SHA_256'
    }
  };

  demoApp.receiveContext(
    { type: 'fdc3.instrument', id: { ticker: 'HACK' }, name: 'Tampered Instrument' },
    { source: 'Malicious App', signed: true, verified: false }
  );
}

function clearLog() {
  demoApp.contexts = [];
  demoApp.updateContextsDisplay();
  demoApp.updateContextCount();
}
