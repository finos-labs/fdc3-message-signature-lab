# Simple FDC3 KMS Signing Setup Guide

This guide shows how to set up FDC3 KMS signing where each application uses its own pre-authorized KMS key, and AWS IAM handles all access control.

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Trading App   │    │  Analytics App  │    │    Risk App     │
│                 │    │                 │    │                 │
│ Key: trading-   │    │ Key: analytics- │    │ Key: risk-      │
│      key-123    │    │      key-456    │    │      key-789    │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                         ┌───────▼───────┐
                         │   AWS KMS     │
                         │               │
                         │ • Key Storage │
                         │ • IAM Control │
                         │ • Signing Ops │
                         └───────────────┘
```

## Step 1: Create KMS Keys

Create separate KMS keys for each application:

```bash
# Trading application key
aws kms create-key \
  --description "FDC3 Trading Application Signing Key" \
  --key-usage SIGN_VERIFY \
  --key-spec RSA_2048 \
  --tags TagKey=Application,TagValue=Trading TagKey=Environment,TagValue=Production

# Analytics application key  
aws kms create-key \
  --description "FDC3 Analytics Application Signing Key" \
  --key-usage SIGN_VERIFY \
  --key-spec RSA_2048 \
  --tags TagKey=Application,TagValue=Analytics TagKey=Environment,TagValue=Production

# Risk management application key
aws kms create-key \
  --description "FDC3 Risk Management Application Signing Key" \
  --key-usage SIGN_VERIFY \
  --key-spec RSA_2048 \
  --tags TagKey=Application,TagValue=Risk TagKey=Environment,TagValue=Production
```

## Step 2: Create IAM Roles

Create separate IAM roles for each application:

### Trading Application Role

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "TradingAppKMSAccess",
      "Effect": "Allow",
      "Action": [
        "kms:Sign",
        "kms:GetPublicKey",
        "kms:DescribeKey"
      ],
      "Resource": "arn-kms-region-account:key/trading-key-id"
    },
    {
      "Sid": "VerifyOtherAppSignatures",
      "Effect": "Allow", 
      "Action": [
        "kms:GetPublicKey"
      ],
      "Resource": [
        "arn-kms-region-account:key/analytics-key-id",
        "arn-kms-region-account:key/risk-key-id"
      ]
    }
  ]
}
```

### Analytics Application Role

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AnalyticsAppKMSAccess",
      "Effect": "Allow",
      "Action": [
        "kms:Sign",
        "kms:GetPublicKey", 
        "kms:DescribeKey"
      ],
      "Resource": "arn-kms-region-account:key/analytics-key-id"
    },
    {
      "Sid": "VerifyOtherAppSignatures",
      "Effect": "Allow",
      "Action": [
        "kms:GetPublicKey"
      ],
      "Resource": [
        "arn-kms-region-account:key/trading-key-id",
        "arn-kms-region-account:key/risk-key-id"
      ]
    }
  ]
}
```

## Step 3: Application Implementation

### Trading Application

```typescript
import { FDC3KMSSigner } from '@finos/fdc3-kms-signer';

// Trading app configuration
const tradingSigner = new FDC3KMSSigner({
  keyId: 'arn-kms-region-account:key/trading-key-id',
  region: 'us-east-1'
  // Credentials automatically picked up from IAM role
});

// Sign trading contexts
const tradeOrder = {
  type: 'fdc3.order',
  id: { orderId: 'TRD-001' },
  instrument: { type: 'fdc3.instrument', id: { ticker: 'AAPL' } },
  side: 'buy',
  quantity: 100
};

const signedOrder = await tradingSigner.sign(tradeOrder);
```

### Analytics Application

```typescript
import { FDC3KMSSigner } from '@finos/fdc3-kms-signer';

// Analytics app configuration
const analyticsSigner = new FDC3KMSSigner({
  keyId: 'arn-kms-region-account:key/analytics-key-id',
  region: 'us-east-1'
});

// Sign analytics contexts
const portfolio = {
  type: 'fdc3.portfolio',
  id: { portfolioId: 'PORT-001' },
  name: 'Tech Portfolio'
};

const signedPortfolio = await analyticsSigner.sign(portfolio);
```

## Step 4: Cross-Application Verification

Any application can verify signatures from other applications:

```typescript
// Trading app verifying analytics signature
const verificationResult = await tradingSigner.verify(signedPortfolio);

if (verificationResult.isValid) {
  console.log('✅ Analytics portfolio signature is valid');
  // Process the verified portfolio data
} else {
  console.log('❌ Invalid signature from analytics app');
}
```

## Step 5: Environment-Specific Keys

Use different keys for different environments:

```typescript
const getEnvironmentKey = () => {
  const env = process.env.NODE_ENV || 'development';
  
  const keyMappings = {
    development: 'arn-kms-region-account:key/dev-trading-key',
    staging: 'arn-kms-region-account:key/staging-trading-key',
    production: 'arn-kms-region-account:key/prod-trading-key'
  };
  
  return keyMappings[env] || keyMappings.development;
};

const signer = new FDC3KMSSigner({
  keyId: getEnvironmentKey(),
  region: 'us-east-1'
});
```

## Benefits of This Approach

### ✅ **Simplicity**
- No FDC3-level access control to manage
- Each app just uses its own key
- AWS IAM handles all permissions

### ✅ **Security**
- Each app can only sign with its authorized key
- AWS-level access control and auditing
- Clear separation of concerns

### ✅ **Scalability**
- Easy to add new applications
- No central permission registry to maintain
- Standard AWS security patterns

### ✅ **Flexibility**
- Different keys per environment
- Easy key rotation via AWS
- Standard AWS monitoring and alerting

## Troubleshooting

### Common Issues

1. **"AccessDenied" Error**
   - Check IAM role has correct KMS permissions
   - Verify key ID is correct
   - Ensure application is using the right IAM role

2. **"KeyUnavailable" Error**
   - Check key exists in the specified region
   - Verify key is enabled
   - Check key policy allows the IAM role

3. **Verification Fails**
   - Ensure verifying app has `kms:GetPublicKey` permission
   - Check the signed context hasn't been modified
   - Verify using the correct key ID

### Debugging Commands

```bash
# Check key details
aws kms describe-key --key-id your-key-id

# Test key access
aws kms get-public-key --key-id your-key-id

# Check IAM role permissions
aws iam get-role-policy --role-name YourRoleName --policy-name YourPolicyName
```

## Next Steps

1. **Monitoring**: Set up CloudWatch alarms for KMS operations
2. **Rotation**: Implement automated key rotation
3. **Compliance**: Enable CloudTrail logging for audit
4. **Testing**: Create integration tests for signature verification
5. **Documentation**: Document key assignments for your team

This simple approach leverages AWS's robust IAM system while keeping the FDC3 implementation clean and straightforward.