# FDC3 KMS Security Guide

This guide provides comprehensive security recommendations for implementing FDC3 KMS signing in production environments.

## 🔐 Multi-Layer Security Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │   Trading App   │  │  Analytics App  │  │ Compliance   │ │
│  │   (Key A only)  │  │   (Key B only)  │  │ (Keys A,B,C) │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                 FDC3 Access Control Layer                   │
│  • App Registration & Permissions                           │
│  • Context Type Restrictions                                │
│  • Time-based Access Control                                │
│  • Custom Business Logic Validation                         │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    AWS IAM Layer                            │
│  • Role-based Access Control                                │
│  • Conditional Policies                                     │
│  • Cross-account Permissions                                │
│  • MFA Requirements                                         │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    AWS KMS Layer                            │
│  • Hardware Security Modules                                │
│  • Key Policies                                             │
│  • Automatic Key Rotation                                   │
│  • CloudTrail Logging                                       │
└─────────────────────────────────────────────────────────────┘
```

## 🛡️ Security Implementation Strategies

### 1. **Application-Level Access Control**

```typescript
// Secure app registration with comprehensive permissions
const secureAppRegistration = {
  // Principle of least privilege
  registerTradingApp: () => {
    globalAppRegistry.registerApp({
      appId: 'trading-app-v2.1.0',
      displayName: 'Trading Application',
      allowedKeys: [
        'arn-kms-region-account:key/trading-orders-key',
        // Only specific keys, not wildcard access
      ],
      allowedContextTypes: [
        'fdc3.order',
        'fdc3.trade',
        'fdc3.position'
        // Restricted to trading-related contexts only
      ],
      permissionLevel: 'sign',
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
      metadata: {
        approvedBy: 'security-team@company.com',
        businessJustification: 'Production trading operations',
        securityReview: 'SEC-2024-001',
        ipWhitelist: ['10.0.1.0/24', '10.0.2.0/24']
      }
    });
  },

  // High-privilege compliance app with additional restrictions
  registerComplianceApp: () => {
    globalAppRegistry.registerApp({
      appId: 'compliance-monitor-v1.0.0',
      displayName: 'Compliance Monitoring System',
      allowedKeys: [
        'arn-kms-region-account:key/compliance-audit-key'
      ],
      allowedContextTypes: [], // Can sign any context for audit purposes
      permissionLevel: 'admin',
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      metadata: {
        requiresMFA: true,
        auditLevel: 'high',
        approvedBy: 'ciso@company.com'
      }
    });
  }
};
```

### 2. **Context-Sensitive Security**

```typescript
// Different security levels for different context types
const contextSecurityLevels = {
  'fdc3.order': {
    requiresSignature: true,
    maxValue: 1000000, // $1M limit
    requiresApproval: (context) => context.quantity > 10000,
    auditLevel: 'high'
  },
  'fdc3.trade': {
    requiresSignature: true,
    maxValue: 10000000, // $10M limit
    requiresApproval: (context) => context.notional > 5000000,
    auditLevel: 'critical'
  },
  'fdc3.instrument': {
    requiresSignature: false, // Reference data, lower risk
    auditLevel: 'medium'
  },
  'fdc3.portfolio': {
    requiresSignature: true,
    requiresApproval: () => true, // Always requires approval
    auditLevel: 'high'
  }
};

// Security validator based on context sensitivity
const contextSecurityValidator = async (
  appId: string, 
  keyId: string, 
  context: Context
): Promise<boolean> => {
  const securityLevel = contextSecurityLevels[context.type];
  
  if (!securityLevel) {
    console.warn(`Unknown context type ${context.type} - denying access`);
    return false;
  }

  // Check if signature is required
  if (securityLevel.requiresSignature) {
    const appPermission = globalAppRegistry.getAppPermission(appId);
    if (!appPermission || appPermission.permissionLevel === 'read') {
      return false;
    }
  }

  // Check value limits for financial contexts
  if (securityLevel.maxValue && context.notional > securityLevel.maxValue) {
    console.warn(`Context value ${context.notional} exceeds limit ${securityLevel.maxValue}`);
    return false;
  }

  // Check if approval is required
  if (securityLevel.requiresApproval && securityLevel.requiresApproval(context)) {
    // In production, check approval system
    const hasApproval = await checkApprovalSystem(appId, context);
    if (!hasApproval) {
      console.warn(`Context requires approval but none found for ${appId}`);
      return false;
    }
  }

  return true;
};
```

### 3. **Network Security**

```typescript
// IP-based access control
const networkSecurityValidator = async (
  appId: string,
  sourceIP: string
): Promise<boolean> => {
  const appPermission = globalAppRegistry.getAppPermission(appId);
  
  if (!appPermission?.metadata?.ipWhitelist) {
    return true; // No IP restrictions
  }

  const allowedNetworks = appPermission.metadata.ipWhitelist;
  
  for (const network of allowedNetworks) {
    if (isIPInNetwork(sourceIP, network)) {
      return true;
    }
  }

  console.warn(`IP ${sourceIP} not in whitelist for ${appId}`);
  return false;
};

// Helper function to check IP in CIDR network
function isIPInNetwork(ip: string, cidr: string): boolean {
  // Implementation would use a proper IP library
  // This is a simplified example
  const [network, prefixLength] = cidr.split('/');
  // ... IP validation logic
  return true; // Placeholder
}
```

### 4. **Time-Based Security Controls**

```typescript
// Business hours and trading session controls
const timeBasedSecurityValidator = async (
  appId: string,
  context: Context
): Promise<boolean> => {
  const now = new Date();
  const hour = now.getHours();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday

  // Trading contexts only during market hours
  if (context.type === 'fdc3.order' || context.type === 'fdc3.trade') {
    // Check if it's a weekday
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      console.warn('Trading operations not allowed on weekends');
      return false;
    }

    // Check market hours (9 AM - 4 PM ET)
    if (hour < 9 || hour >= 16) {
      // Allow emergency trading with special approval
      const hasEmergencyApproval = await checkEmergencyApproval(appId);
      if (!hasEmergencyApproval) {
        console.warn('Trading operations outside market hours require emergency approval');
        return false;
      }
    }
  }

  // Compliance operations allowed 24/7
  if (appId.includes('compliance')) {
    return true;
  }

  return true;
};
```

### 5. **Audit and Monitoring**

```typescript
// Comprehensive audit logging
class SecurityAuditLogger {
  private static instance: SecurityAuditLogger;
  
  static getInstance(): SecurityAuditLogger {
    if (!SecurityAuditLogger.instance) {
      SecurityAuditLogger.instance = new SecurityAuditLogger();
    }
    return SecurityAuditLogger.instance;
  }

  async logSecurityEvent(event: {
    eventType: 'access_granted' | 'access_denied' | 'suspicious_activity' | 'policy_violation';
    appId: string;
    keyId?: string;
    contextType?: string;
    sourceIP?: string;
    userAgent?: string;
    reason?: string;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    metadata?: Record<string, any>;
  }) {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      eventId: this.generateEventId(),
      ...event
    };

    // Log to multiple destinations
    await Promise.all([
      this.logToCloudWatch(auditEntry),
      this.logToSIEM(auditEntry),
      this.logToDatabase(auditEntry)
    ]);

    // Trigger alerts for high-risk events
    if (event.riskLevel === 'high' || event.riskLevel === 'critical') {
      await this.triggerSecurityAlert(auditEntry);
    }
  }

  private generateEventId(): string {
    return `fdc3-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async logToCloudWatch(entry: any) {
    // CloudWatch Logs implementation
    console.log('CloudWatch:', JSON.stringify(entry));
  }

  private async logToSIEM(entry: any) {
    // SIEM integration (Splunk, QRadar, etc.)
    console.log('SIEM:', JSON.stringify(entry));
  }

  private async logToDatabase(entry: any) {
    // Database logging for compliance
    console.log('Database:', JSON.stringify(entry));
  }

  private async triggerSecurityAlert(entry: any) {
    // Security team notification
    console.log('SECURITY ALERT:', JSON.stringify(entry));
    // Send to PagerDuty, Slack, email, etc.
  }
}
```

### 6. **Key Rotation and Management**

```typescript
// Automated key rotation strategy
class KMSKeyRotationManager {
  private rotationSchedule = new Map<string, Date>();

  scheduleKeyRotation(keyId: string, rotationInterval: number = 90) {
    const nextRotation = new Date(Date.now() + rotationInterval * 24 * 60 * 60 * 1000);
    this.rotationSchedule.set(keyId, nextRotation);
    
    console.log(`Scheduled rotation for key ${keyId} on ${nextRotation.toISOString()}`);
  }

  async rotateKey(keyId: string): Promise<string> {
    try {
      // Create new key version
      const newKeyId = await this.createNewKeyVersion(keyId);
      
      // Update application configurations
      await this.updateApplicationConfigs(keyId, newKeyId);
      
      // Verify all applications can use new key
      await this.verifyKeyAccess(newKeyId);
      
      // Schedule old key for deletion (after grace period)
      await this.scheduleKeyDeletion(keyId, 30); // 30 days
      
      console.log(`Successfully rotated key ${keyId} to ${newKeyId}`);
      return newKeyId;
      
    } catch (error) {
      console.error(`Key rotation failed for ${keyId}:`, error);
      throw error;
    }
  }

  private async createNewKeyVersion(oldKeyId: string): Promise<string> {
    // AWS KMS key creation logic
    return 'new-key-id';
  }

  private async updateApplicationConfigs(oldKeyId: string, newKeyId: string) {
    // Update all registered applications
    const apps = globalAppRegistry.listApps();
    
    for (const app of apps) {
      if (app.allowedKeys.includes(oldKeyId)) {
        const updatedKeys = app.allowedKeys.map(key => 
          key === oldKeyId ? newKeyId : key
        );
        
        globalAppRegistry.updatePermissions(app.appId, {
          allowedKeys: updatedKeys
        });
      }
    }
  }

  private async verifyKeyAccess(keyId: string): Promise<void> {
    // Test key access for all applications
    const apps = globalAppRegistry.getKeyUsers(keyId);
    
    for (const appId of apps) {
      const canAccess = globalAppRegistry.canUseKey(appId, keyId);
      if (!canAccess) {
        throw new Error(`Key access verification failed for ${appId}`);
      }
    }
  }

  private async scheduleKeyDeletion(keyId: string, gracePeriodDays: number) {
    // Schedule key for deletion after grace period
    console.log(`Scheduled deletion for key ${keyId} in ${gracePeriodDays} days`);
  }
}
```

## 🚨 Security Incident Response

### 1. **Suspicious Activity Detection**

```typescript
// Anomaly detection for signing patterns
class SecurityAnomalyDetector {
  private baselineMetrics = new Map<string, any>();

  detectAnomalies(appId: string, signingActivity: any): boolean {
    const baseline = this.baselineMetrics.get(appId);
    
    if (!baseline) {
      // Establish baseline for new applications
      this.establishBaseline(appId, signingActivity);
      return false;
    }

    // Check for unusual patterns
    const anomalies = [
      this.checkVolumeAnomaly(signingActivity, baseline),
      this.checkTimeAnomaly(signingActivity, baseline),
      this.checkContextTypeAnomaly(signingActivity, baseline),
      this.checkGeographicAnomaly(signingActivity, baseline)
    ];

    return anomalies.some(anomaly => anomaly);
  }

  private checkVolumeAnomaly(current: any, baseline: any): boolean {
    // Check if signing volume is significantly higher than normal
    const volumeIncrease = current.signingCount / baseline.averageSigningCount;
    return volumeIncrease > 5; // 5x normal volume
  }

  private checkTimeAnomaly(current: any, baseline: any): boolean {
    // Check for signing outside normal hours
    const hour = new Date().getHours();
    return !baseline.normalHours.includes(hour);
  }

  private checkContextTypeAnomaly(current: any, baseline: any): boolean {
    // Check for unusual context types
    return !baseline.normalContextTypes.includes(current.contextType);
  }

  private checkGeographicAnomaly(current: any, baseline: any): boolean {
    // Check for signing from unusual locations
    return !baseline.normalLocations.includes(current.sourceIP);
  }

  private establishBaseline(appId: string, activity: any) {
    // Collect baseline metrics over time
    this.baselineMetrics.set(appId, {
      averageSigningCount: activity.signingCount,
      normalHours: [9, 10, 11, 12, 13, 14, 15, 16], // Business hours
      normalContextTypes: activity.contextTypes,
      normalLocations: [activity.sourceIP]
    });
  }
}
```

### 2. **Incident Response Procedures**

```typescript
// Automated incident response
class SecurityIncidentResponse {
  async handleSecurityIncident(incident: {
    type: 'unauthorized_access' | 'anomalous_behavior' | 'policy_violation';
    severity: 'low' | 'medium' | 'high' | 'critical';
    appId: string;
    keyId?: string;
    details: any;
  }) {
    const auditLogger = SecurityAuditLogger.getInstance();
    
    // Log the incident
    await auditLogger.logSecurityEvent({
      eventType: 'suspicious_activity',
      appId: incident.appId,
      keyId: incident.keyId,
      riskLevel: incident.severity,
      reason: `Security incident: ${incident.type}`,
      metadata: incident.details
    });

    // Take immediate action based on severity
    switch (incident.severity) {
      case 'critical':
        await this.handleCriticalIncident(incident);
        break;
      case 'high':
        await this.handleHighSeverityIncident(incident);
        break;
      case 'medium':
        await this.handleMediumSeverityIncident(incident);
        break;
      case 'low':
        await this.handleLowSeverityIncident(incident);
        break;
    }
  }

  private async handleCriticalIncident(incident: any) {
    // Immediate lockdown
    console.log('🚨 CRITICAL INCIDENT - Initiating lockdown');
    
    // Revoke application access immediately
    globalAppRegistry.revokeApp(incident.appId);
    
    // Disable KMS key if compromised
    if (incident.keyId) {
      await this.disableKMSKey(incident.keyId);
    }
    
    // Alert security team immediately
    await this.alertSecurityTeam(incident, 'CRITICAL');
    
    // Initiate forensic investigation
    await this.initiateForensics(incident);
  }

  private async handleHighSeverityIncident(incident: any) {
    console.log('⚠️ HIGH SEVERITY INCIDENT');
    
    // Temporarily suspend application
    await this.suspendApplication(incident.appId, '1 hour');
    
    // Require re-authentication
    await this.requireReAuthentication(incident.appId);
    
    // Alert security team
    await this.alertSecurityTeam(incident, 'HIGH');
  }

  private async handleMediumSeverityIncident(incident: any) {
    console.log('⚠️ MEDIUM SEVERITY INCIDENT');
    
    // Increase monitoring
    await this.increaseMonitoring(incident.appId);
    
    // Require additional approval for sensitive operations
    await this.requireAdditionalApproval(incident.appId);
    
    // Notify security team
    await this.notifySecurityTeam(incident);
  }

  private async handleLowSeverityIncident(incident: any) {
    console.log('ℹ️ LOW SEVERITY INCIDENT');
    
    // Log for review
    await this.logForReview(incident);
    
    // Continue monitoring
    await this.continueMonitoring(incident.appId);
  }

  private async disableKMSKey(keyId: string) {
    console.log(`Disabling KMS key: ${keyId}`);
    // AWS KMS disable key operation
  }

  private async alertSecurityTeam(incident: any, priority: string) {
    console.log(`Alerting security team - Priority: ${priority}`);
    // Send to PagerDuty, Slack, email, etc.
  }

  private async suspendApplication(appId: string, duration: string) {
    console.log(`Suspending application ${appId} for ${duration}`);
    // Temporary suspension logic
  }

  private async requireReAuthentication(appId: string) {
    console.log(`Requiring re-authentication for ${appId}`);
    // Force re-auth logic
  }

  private async increaseMonitoring(appId: string) {
    console.log(`Increasing monitoring for ${appId}`);
    // Enhanced monitoring logic
  }

  private async requireAdditionalApproval(appId: string) {
    console.log(`Requiring additional approval for ${appId}`);
    // Additional approval workflow
  }

  private async notifySecurityTeam(incident: any) {
    console.log('Notifying security team');
    // Notification logic
  }

  private async logForReview(incident: any) {
    console.log('Logging incident for review');
    // Review queue logic
  }

  private async continueMonitoring(appId: string) {
    console.log(`Continuing monitoring for ${appId}`);
    // Monitoring logic
  }

  private async initiateForensics(incident: any) {
    console.log('Initiating forensic investigation');
    // Forensics workflow
  }
}
```

## 📋 Security Checklist

### Pre-Production Checklist

- [ ] **Key Management**
  - [ ] Separate keys for each environment (dev/staging/prod)
  - [ ] Key rotation schedule established
  - [ ] Key backup and recovery procedures
  - [ ] Key deletion policies defined

- [ ] **Access Control**
  - [ ] Application registry configured
  - [ ] Principle of least privilege applied
  - [ ] Context type restrictions implemented
  - [ ] Time-based access controls configured

- [ ] **AWS IAM**
  - [ ] Role-based access control implemented
  - [ ] Conditional policies configured
  - [ ] Cross-account access secured
  - [ ] MFA requirements enforced

- [ ] **Monitoring**
  - [ ] CloudTrail logging enabled
  - [ ] CloudWatch alarms configured
  - [ ] SIEM integration completed
  - [ ] Anomaly detection implemented

- [ ] **Incident Response**
  - [ ] Security incident procedures documented
  - [ ] Automated response workflows configured
  - [ ] Security team contact information updated
  - [ ] Forensic investigation procedures established

### Production Monitoring Checklist

- [ ] **Daily Checks**
  - [ ] Review security alerts
  - [ ] Check anomaly detection reports
  - [ ] Verify key rotation status
  - [ ] Monitor application access patterns

- [ ] **Weekly Reviews**
  - [ ] Review access control changes
  - [ ] Analyze security metrics
  - [ ] Update threat intelligence
  - [ ] Test incident response procedures

- [ ] **Monthly Audits**
  - [ ] Comprehensive security audit
  - [ ] Access control review
  - [ ] Key usage analysis
  - [ ] Compliance reporting

This comprehensive security guide ensures that your FDC3 KMS signing implementation follows security best practices and provides multiple layers of protection against unauthorized access and misuse.