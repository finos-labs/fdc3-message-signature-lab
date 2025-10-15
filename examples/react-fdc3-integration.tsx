/**
 * React FDC3 KMS Integration Example
 * 
 * This shows how to integrate FDC3 KMS signing into a React application
 */

import React, { useState, useEffect, useCallback } from 'react';

// Types (adjust imports based on your setup)
interface Context {
  type: string;
  id?: any;
  name?: string;
  [key: string]: any;
}

interface SignedContext {
  context: Context;
  signature: string;
  keyId: string;
  timestamp: number;
  algorithm: string;
}

interface FDC3Agent {
  broadcast: (context: Context) => Promise<void>;
  addContextListener: (type: string | null, handler: (context: any, metadata?: any) => void) => Promise<any>;
  raiseIntent: (intent: string, context: any) => Promise<any>;
}

// Hook for FDC3 KMS integration
export function useFDC3WithKMS(appKeyId: string) {
  const [fdc3, setFdc3] = useState<FDC3Agent | null>(null);
  const [kmsSigner, setKmsSigner] = useState<any>(null);
  const [isSigningEnabled, setIsSigningEnabled] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize FDC3 and KMS
  useEffect(() => {
    async function initialize() {
      try {
        // Initialize FDC3
        const agent = await getFDC3Agent();
        setFdc3(agent);

        // Initialize KMS signing
        const { FDC3KMSSigner } = await import('../packages/fdc3-kms-signer/dist/index.js');
        const signer = new FDC3KMSSigner({
          keyId: appKeyId,
          region: process.env.REACT_APP_AWS_REGION || 'us-east-1'
        });

        // Test signing
        const testContext = { type: 'fdc3.instrument', id: { ticker: 'TEST' } };
        const signed = await signer.sign(testContext);
        const verified = await signer.verify(signed);
        
        if (verified.isValid) {
          setKmsSigner(signer);
          setIsSigningEnabled(true);
        }

        setIsReady(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setIsReady(true); // Still ready, just without signing
      }
    }

    initialize();
  }, [appKeyId]);

  // Helper to get FDC3 agent
  async function getFDC3Agent(): Promise<FDC3Agent> {
    if ((window as any).fdc3) {
      return (window as any).fdc3;
    }
    
    if ((window as any).fdc3Ready) {
      return await (window as any).fdc3Ready();
    }
    
    throw new Error('FDC3 not available');
  }

  // Sign and broadcast context
  const signAndBroadcast = useCallback(async (context: Context) => {
    if (!fdc3) throw new Error('FDC3 not ready');

    if (isSigningEnabled && kmsSigner) {
      console.log('🔐 Signing context with KMS...');
      const signedContext = await kmsSigner.sign(context);
      await fdc3.broadcast(signedContext.context);
      return signedContext;
    } else {
      console.log('📝 Broadcasting unsigned context');
      await fdc3.broadcast(context);
      return context;
    }
  }, [fdc3, kmsSigner, isSigningEnabled]);

  // Verify signed context
  const verifyContext = useCallback(async (signedContext: SignedContext) => {
    if (!isSigningEnabled || !kmsSigner) {
      return { isValid: false, error: 'KMS signing not available' };
    }

    try {
      return await kmsSigner.verify(signedContext);
    } catch (error) {
      return { 
        isValid: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }, [kmsSigner, isSigningEnabled]);

  // Check if context is signed
  const isSignedContext = useCallback((context: any): context is SignedContext => {
    return context && 
           typeof context.signature === 'string' &&
           typeof context.keyId === 'string' &&
           typeof context.timestamp === 'number' &&
           context.context &&
           typeof context.context.type === 'string';
  }, []);

  return {
    fdc3,
    isReady,
    isSigningEnabled,
    error,
    signAndBroadcast,
    verifyContext,
    isSignedContext
  };
}

// Example React component using the hook
export function TradingDashboard() {
  const appKeyId = process.env.REACT_APP_TRADING_KMS_KEY || 
                   'arn-kms-region-account:key025a714f-7218-4c6d-8699-11c45bd839da';
  
  const { 
    fdc3, 
    isReady, 
    isSigningEnabled, 
    error, 
    signAndBroadcast, 
    verifyContext, 
    isSignedContext 
  } = useFDC3WithKMS(appKeyId);

  const [receivedContexts, setReceivedContexts] = useState<any[]>([]);
  const [selectedInstrument, setSelectedInstrument] = useState('AAPL');

  // Set up context listeners
  useEffect(() => {
    if (!fdc3 || !isReady) return;

    const setupListeners = async () => {
      // Listen for all contexts
      await fdc3.addContextListener(null, async (context, metadata) => {
        console.log(`📨 Received context: ${context.type}`);
        
        let verificationStatus = 'unsigned';
        // Always derive a display context: if it's a signed wrapper, use the inner payload
        const displayContext = isSignedContext(context) ? context.context : context;
        let trustedContext = displayContext;

        if (isSignedContext(context)) {
          console.log('🔐 Verifying signed context...');
          const verification = await verifyContext(context);
          
          if (verification.isValid) {
            verificationStatus = 'verified';
            trustedContext = verification.context!;
            console.log('✅ Context verified successfully');
          } else {
            verificationStatus = 'invalid';
            console.warn('❌ Invalid signature:', verification.error);
            // Keep the inner payload for display so fields like name/id render
            trustedContext = displayContext;
          }
        }

        // Add to received contexts list
        setReceivedContexts((prev: any[]) => [...prev, {
          id: Date.now(),
          context: trustedContext,
          source: metadata?.source || 'unknown',
          timestamp: new Date().toISOString(),
          verificationStatus,
          originalSigned: isSignedContext(context)
        }]);
      });
    };

    setupListeners().catch(console.error);
  }, [fdc3, isReady, isSignedContext, verifyContext]);

  // Broadcast instrument
  const broadcastInstrument = async () => {
    if (!fdc3) return;

    const instrumentContext: Context = {
      type: 'fdc3.instrument',
      id: {
        ticker: selectedInstrument,
        ISIN: selectedInstrument === 'AAPL' ? 'US0378331005' : undefined
      },
      name: selectedInstrument === 'AAPL' ? 'Apple Inc.' : `${selectedInstrument} Corp`,
      market: {
        MIC: 'XNAS',
        name: 'NASDAQ'
      }
    };

    try {
      await signAndBroadcast(instrumentContext);
      console.log(`✅ Broadcasted ${selectedInstrument} instrument`);
    } catch (error) {
      console.error('❌ Failed to broadcast:', error);
    }
  };

  // Create and broadcast order
  const createOrder = async () => {
    if (!fdc3) return;

    const orderContext: Context = {
      type: 'fdc3.order',
      id: {
        orderId: `ORD-${Date.now()}`
      },
      name: `BUY 100 ${selectedInstrument}`,
      instrument: {
        type: 'fdc3.instrument',
        id: { ticker: selectedInstrument }
      },
      side: 'buy',
      quantity: 100,
      price: 150.25,
      orderType: 'limit'
    };

    try {
      await signAndBroadcast(orderContext);
      console.log('✅ Order created and broadcasted');
    } catch (error) {
      console.error('❌ Failed to create order:', error);
    }
  };

  if (!isReady) {
    return <div>🔄 Initializing FDC3 and KMS signing...</div>;
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>🏦 Trading Dashboard with FDC3 KMS Signing</h1>
      
      {/* Status */}
      <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '5px' }}>
        <h3>📊 Status</h3>
        <p>FDC3: {fdc3 ? '✅ Ready' : '❌ Not Available'}</p>
        <p>KMS Signing: {isSigningEnabled ? '✅ Enabled' : '❌ Disabled'}</p>
        {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      </div>

      {/* Controls */}
      <div style={{ marginBottom: '20px' }}>
        <h3>🎛️ Controls</h3>
        <div style={{ marginBottom: '10px' }}>
          <label>
            Instrument: 
            <select 
              value={selectedInstrument} 
              onChange={(e) => setSelectedInstrument(e.target.value)}
              style={{ marginLeft: '10px' }}
            >
              <option value="AAPL">AAPL</option>
              <option value="GOOGL">GOOGL</option>
              <option value="MSFT">MSFT</option>
              <option value="TSLA">TSLA</option>
            </select>
          </label>
        </div>
        
        <button 
          onClick={broadcastInstrument}
          disabled={!fdc3}
          style={{ marginRight: '10px', padding: '10px 20px' }}
        >
          📈 Broadcast Instrument
        </button>
        
        <button 
          onClick={createOrder}
          disabled={!fdc3}
          style={{ padding: '10px 20px' }}
        >
          📋 Create Order
        </button>
      </div>

      {/* Received Contexts */}
      <div>
        <h3>📨 Received Contexts ({receivedContexts.length})</h3>
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {receivedContexts.map((item) => (
            <div 
              key={item.id} 
              style={{ 
                margin: '10px 0', 
                padding: '10px', 
                border: '1px solid #ccc', 
                borderRadius: '5px',
                backgroundColor: item.verificationStatus === 'verified' ? '#e8f5e8' : 
                                item.verificationStatus === 'invalid' ? '#ffe8e8' : '#f8f8f8'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>{item.context.type || item.context?.context?.type || 'unknown'}</strong>
                <div>
                  {item.verificationStatus === 'verified' && <span style={{ color: 'green' }}>✅ Verified</span>}
                  {item.verificationStatus === 'invalid' && <span style={{ color: 'red' }}>❌ Invalid</span>}
                  {item.verificationStatus === 'unsigned' && <span style={{ color: 'orange' }}>📝 Unsigned</span>}
                </div>
              </div>
              <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                From: {item.source} | Time: {new Date(item.timestamp).toLocaleTimeString()}
                {item.originalSigned && <span> | 🔐 Originally Signed</span>}
              </div>
              <div style={{ marginTop: '5px', fontSize: '14px' }}>
                {(item.context.name ?? item.context?.context?.name) ||
                  JSON.stringify((item.context.id ?? item.context?.context?.id) || {})}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default TradingDashboard;