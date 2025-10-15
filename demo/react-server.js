/**
 * Simple React Demo Server
 * Serves a rendered version of the React FDC3 integration example
 */

const express = require('express');
const path = require('path');
const fs = require('fs');

// Load environment variables from .env if it exists
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  console.log('📄 Loading environment from .env file...');
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  envContent.split('\n').forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      const value = valueParts.join('=').trim();
      if (key && value) {
        process.env[key.trim()] = value;
      }
    }
  });
}

// Try to import the FDC3 AWS KMS Signer from built dist; if unavailable, run in simulation mode
let FDC3AWSKMSSigner = null;
try {
  const distPath = path.join(__dirname, '..', 'dist', 'index.js');
  if (fs.existsSync(distPath)) {
    ({ FDC3AWSKMSSigner } = require(distPath));
  } else {
    console.warn('⚠️  dist/index.js not found. Run "npm run build" to enable real KMS signing. Running in simulation mode.');
  }
} catch (e) {
  console.warn('⚠️  Failed to load KMS signer from dist:', e.message);
  console.warn('   Running demo without real signing. Run "npm run build" to enable.');
}

const app = express();
const port = process.env.PORT || 3000;

// Initialize KMS signer
let kmsSigner = null;
let isKmsReady = false;

async function initializeKMS() {
  try {
    if (!FDC3AWSKMSSigner) {
      // No signer available; keep simulation mode
      isKmsReady = false;
      return;
    }
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

    kmsSigner = new FDC3AWSKMSSigner(awsConfig);

    // Test the signer
    const testContext = {
      type: 'fdc3.instrument',
      id: { ticker: 'TEST' },
      name: 'Test Instrument'
    };

    const signed = await kmsSigner.sign(testContext);
    const verification = await kmsSigner.verify(signed);

    if (verification.isValid) {
      isKmsReady = true;
      console.log('✅ AWS KMS Signer initialized successfully');
    } else {
      console.warn('⚠️  KMS test verification failed');
    }
  } catch (error) {
    console.warn('⚠️  AWS KMS signing not available:', error.message);
    console.log('   Demo will run in simulation mode without real signatures');
  }
}

// Serve static files
app.use('/static', express.static(path.join(__dirname, 'static')));

// Serve the client application script
app.get('/client-app.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'client-app.js'));
});

// Main demo page
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FDC3 AWS KMS React Demo</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            padding: 30px;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #e0e0e0;
        }
        .status {
            display: flex;
            gap: 20px;
            margin-bottom: 30px;
            flex-wrap: wrap;
        }
        .status-card {
            flex: 1;
            min-width: 200px;
            padding: 15px;
            border-radius: 6px;
            text-align: center;
        }
        .status-ready { background-color: #d4edda; color: #155724; }
        .status-signing { background-color: #d1ecf1; color: #0c5460; }
        .status-error { background-color: #f8d7da; color: #721c24; }
        .controls {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .control-group {
            padding: 20px;
            border: 1px solid #ddd;
            border-radius: 6px;
        }
        .control-group h3 {
            margin-top: 0;
            color: #333;
        }
        button {
            background-color: #007bff;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            margin: 5px;
        }
        button:hover {
            background-color: #0056b3;
        }
        button:disabled {
            background-color: #6c757d;
            cursor: not-allowed;
        }
        select, input {
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            margin: 5px;
        }
        .contexts-log {
            background-color: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 6px;
            padding: 20px;
            max-height: 400px;
            overflow-y: auto;
        }
        .context-item {
            margin-bottom: 15px;
            padding: 10px;
            border-left: 4px solid #007bff;
            background-color: white;
            border-radius: 0 4px 4px 0;
        }
        .context-verified {
            border-left-color: #28a745;
        }
        .context-invalid {
            border-left-color: #dc3545;
        }
        .context-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }
        .verification-badge {
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: bold;
        }
        .badge-verified {
            background-color: #d4edda;
            color: #155724;
        }
        .badge-unsigned {
            background-color: #e2e3e5;
            color: #495057;
        }
        .badge-invalid {
            background-color: #f8d7da;
            color: #721c24;
        }
        pre {
            background-color: #f8f9fa;
            padding: 10px;
            border-radius: 4px;
            font-size: 12px;
            overflow-x: auto;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔐 FDC3 AWS KMS React Demo</h1>
            <p>Interactive demonstration of FDC3 context signing and verification with AWS KMS</p>
        </div>

        <div class="status">
            <div class="status-card status-ready">
                <h3>📡 FDC3 Status</h3>
                <div id="fdc3-status">Ready (Simulated)</div>
            </div>
            <div class="status-card status-signing">
                <h3>🔐 KMS Signing</h3>
                <div id="kms-status">Initializing...</div>
            </div>
            <div class="status-card status-ready">
                <h3>📊 Contexts Received</h3>
                <div id="context-count">0</div>
            </div>
        </div>

        <div class="controls">
            <div class="control-group">
                <h3>📈 Broadcast Instrument</h3>
                <select id="instrument-select">
                    <option value="AAPL">Apple Inc. (AAPL)</option>
                    <option value="MSFT">Microsoft (MSFT)</option>
                    <option value="GOOGL">Google (GOOGL)</option>
                    <option value="TSLA">Tesla (TSLA)</option>
                </select>
                <br>
                <button onclick="broadcastInstrument(false)">📝 Send Unsigned</button>
                <button onclick="broadcastInstrument(true)" id="sign-instrument">🔐 Sign & Send</button>
            </div>

            <div class="control-group">
                <h3>📋 Create Order</h3>
                <select id="order-side">
                    <option value="buy">Buy</option>
                    <option value="sell">Sell</option>
                </select>
                <input type="number" id="order-quantity" placeholder="Quantity" value="100">
                <input type="number" id="order-price" placeholder="Price" value="150.25" step="0.01">
                <br>
                <button onclick="createOrder(false)">📝 Send Unsigned</button>
                <button onclick="createOrder(true)" id="sign-order">🔐 Sign & Send</button>
            </div>

            <div class="control-group">
                <h3>🧪 Security Testing</h3>
                <button onclick="sendTamperedContext()">🚨 Send Tampered Context</button>
                <button onclick="clearLog()">🗑️ Clear Log</button>
                <br>
                <small>Test signature verification with invalid data</small>
            </div>
        </div>

        <div class="contexts-log">
            <h3>📨 Received Contexts</h3>
            <div id="contexts-list">
                <p style="color: #6c757d; text-align: center; font-style: italic;">
                    No contexts received yet. Try broadcasting an instrument or order above.
                </p>
            </div>
        </div>
    </div>

    <script src="/client-app.js"></script>
</body>
</html>
  `);
});

// Middleware
app.use(express.json());

// API endpoints for the demo
app.get('/api/status', (req, res) => {
  res.json({
    fdc3Ready: true,
    kmsReady: isKmsReady,
    timestamp: new Date().toISOString()
  });
});

app.post('/api/sign', async (req, res) => {
  try {
    const { context } = req.body;
    
    if (!isKmsReady || !kmsSigner) {
      return res.status(503).json({ 
        error: 'KMS signing not available',
        signedContext: null 
      });
    }

    console.log(`🔐 Signing context: ${context.type}`);
    const signedContext = await kmsSigner.sign(context);
    
    console.log('✅ Signed context structure:', JSON.stringify(signedContext, null, 2));
    
    res.json({ 
      success: true, 
        signedContext,
        metadata: { source: 'React Demo Server' },
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    console.error('Signing error:', error);
    res.status(500).json({ 
      error: error.message,
      signedContext: null 
    });
  }
});

app.post('/api/verify', async (req, res) => {
  try {
    const { signedContext } = req.body;
    
    if (!isKmsReady || !kmsSigner) {
      return res.status(503).json({ 
        error: 'KMS verification not available',
        isValid: false 
      });
    }

    console.log(`🔍 Verifying context: ${signedContext.type}`);
    const verification = await kmsSigner.verify(signedContext);
    
    res.json({ 
      success: true, 
      verification,
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ 
      error: error.message,
      isValid: false 
    });
  }
});

// Create static directory if it doesn't exist
const staticDir = path.join(__dirname, 'static');
if (!fs.existsSync(staticDir)) {
  fs.mkdirSync(staticDir, { recursive: true });
}

// Start server with KMS initialization
async function startServer() {
  await initializeKMS();
  
  app.listen(port, () => {
    console.log(`\n🌐 FDC3 React Demo Server running at http://localhost:${port}`);
    console.log(`📊 Open your browser to see the interactive demo`);
    if (isKmsReady) {
      console.log(`🔐 Real AWS KMS signing is ENABLED`);
      console.log(`   Key ID: ${process.env.AWS_KMS_KEY_ID || 'using default'}`);
      console.log(`   Region: ${process.env.AWS_REGION || 'us-east-1'}`);
    } else {
      console.log(`⚠️  AWS KMS signing is NOT available - check your configuration`);
      console.log(`   Set up .env file with AWS credentials to enable real signing`);
    }
    console.log(``);
  });
}

startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});