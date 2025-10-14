# FDC3 AWS KMS Signer

🔐 **Enterprise-grade cryptographic security for FDC3 contexts using AWS KMS**

Add cryptographic signing and verification to your FDC3 applications with AWS Key Management Service (KMS). This standalone package enables secure inter-application communication in financial desktop environments.

## ✨ Features

- 🔐 **Cryptographic Signing**: Sign FDC3 contexts with AWS KMS keys
- ✅ **Signature Verification**: Verify context authenticity and integrity  
- 🛡️ **Tamper Detection**: Detect modified or corrupted contexts
- 🏢 **Enterprise Ready**: Production-grade security with AWS KMS
- 📦 **Standalone Package**: Works with any FDC3 implementation
- 🚀 **Easy Integration**: Drop-in solution for existing FDC3 apps

## 🚀 Quick Start

### Installation

```bash
npm install fdc3-aws-kms-signer
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

// Get FDC3 agent
const fdc3 = await getAgent();

// Sign and broadcast a context
const context = {
  type: 'fdc3.instrument',
  id: { ticker: 'AAPL' },
  name: 'Apple Inc.'
};

const signedContext = await signer.sign(context);
await fdc3.broadcast(signedContext.context);

// Listen for and verify signed contexts
fdc3.addContextListener(null, async (context, metadata) => {
  if (isSignedContext(context)) {
    const verification = await signer.verify(context);
    if (verification.isValid) {
      console.log('✅ Verified context from trusted source');
      // Process with high trust
    } else {
      console.log('❌ Invalid signature - potential security issue');
    }
  }
});

function isSignedContext(context) {
  return context.signature && context.keyId && context.timestamp;
}
```

## 📚 Documentation

- **[Complete Guide](docs/FDC3_AWS_KMS_SIGNING_GUIDE.md)** - Comprehensive documentation with examples
- **[Quick Setup](docs/simple-setup-guide.md)** - Get started in 5 minutes
- **[Security Guide](docs/security-guide.md)** - Security best practices

## 🎯 Examples

- **[Basic Example](examples/simple-kms-example.js)** - Simple signing and verification
- **[FDC3 Integration](examples/fdc3-app-integration.js)** - Complete FDC3 app integration
- **[Cross-App Verification](examples/cross-app-verification.js)** - App1 signs, App2 verifies
- **[React Integration](examples/react-fdc3-integration.tsx)** - React component example

## 🏃‍♂️ Demo

Run the included demo to see it in action:

```bash
cd demo
npm install
npm start
```

## 🔧 Configuration

### AWS Setup

1. **Create KMS Key**: Create an AWS KMS key for signing
2. **Set Permissions**: Grant your application access to the key
3. **Configure Credentials**: Set up AWS credentials (IAM role, profile, or environment variables)

### Environment Variables

```bash
AWS_KMS_KEY_ID=arn-kms-region-account:key/your-key-id
AWS_REGION=us-east-1
```

## 🛡️ Security Benefits

- **Cryptographic Integrity**: Detect any tampering with FDC3 contexts
- **Authentication**: Verify the source of contexts using digital signatures
- **Non-Repudiation**: Prove the origin of signed contexts
- **Enterprise Key Management**: Leverage AWS KMS for secure key storage
- **Compliance**: Meet regulatory requirements for data integrity

## 🏗️ Architecture

```
┌─────────────────┐    Sign     ┌─────────────────┐
│   FDC3 App A    │ ──────────► │   AWS KMS Key   │
│  (Trading App)  │             │                 │
└─────────────────┘             └─────────────────┘
         │                               │
         │ Broadcast                     │
         │ Signed Context               │ Verify
         ▼                               ▼
┌─────────────────┐             ┌─────────────────┐
│   FDC3 Desktop  │             │   FDC3 App B    │
│   Environment   │ ──────────► │  (Risk App)     │
│                 │   Receive   │                 │
└─────────────────┘             └─────────────────┘
```

## 🤝 Use Cases

- **Trading Applications**: Secure order and trade context sharing
- **Risk Management**: Verify authenticity of risk-related contexts
- **Compliance**: Ensure data integrity for regulatory reporting
- **Multi-Vendor Environments**: Trust contexts from different application vendors
- **Audit Trails**: Maintain cryptographic proof of context origins

## 📋 Requirements

- Node.js 16+
- AWS KMS access
- FDC3 implementation (optional - works standalone too)

## 🔗 Related Projects

- [FDC3 Standard](https://fdc3.finos.org/) - Financial Desktop Connectivity and Collaboration Consortium
- [AWS KMS](https://aws.amazon.com/kms/) - AWS Key Management Service

## 📄 License

 [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions welcome! Please read our contributing guidelines and submit pull requests.

## 🆘 Support

- 📖 Check the [documentation](docs/)
- 🐛 Report issues on GitHub
- 💬 Join the FDC3 community discussions

---

**Made with ❤️  by RRLL**
