# Security Architecture

This document describes authentication and authorization mechanisms, data encryption, API security, network security, and compliance considerations.

## Security Overview

The system implements multiple layers of security to protect user data, prevent unauthorized access, and ensure data integrity.

## Authentication & Authorization

### Authentication Flow

#### User Authentication
```
1. User submits credentials (email/password)
   ↓
2. Frontend → Backend API (POST /api/auth/login)
   ↓
3. Backend → Supabase Auth (verify credentials)
   ↓
4. Supabase validates credentials
   ↓
5. Supabase generates JWT token
   ↓
6. Backend → Frontend (return token)
   ↓
7. Frontend stores token securely
   ↓
8. Frontend includes token in subsequent requests
```

#### Token Structure
- **Type**: JWT (JSON Web Token)
- **Issuer**: Supabase
- **Expiration**: Configurable (default: 1 hour)
- **Refresh**: Refresh token available

#### Token Storage
- **Web App**: HTTP-only cookies (recommended) or localStorage
- **Mobile App**: Secure keychain storage
- **Never**: URL parameters or client-side JavaScript variables

### Authorization Mechanisms

#### Role-Based Access Control (RBAC)

**User Roles**:
- **Admin**: Full system access
- **User**: Standard user access
- **Guest**: Limited access (future)

**Role Assignment**:
- Stored in `users.is_admin` field
- Set during user creation or update
- Validated on each request

#### Resource-Level Authorization

**Project Access**:
- Users can only access their own projects
- Enforced via Row-Level Security (RLS)
- Validated in API middleware

**Document Access**:
- Users can only access documents in their projects
- Enforced via RLS policies
- Validated in API endpoints

#### Row-Level Security (RLS)

**Implementation**: Supabase RLS policies
**Scope**: Database-level access control
**Policies**: User-based access rules

**Example Policy**:
```sql
CREATE POLICY "Users can view own projects" ON projects
  FOR SELECT USING (auth.uid() = user_id);
```

### Service-to-Service Authentication

#### Backend → Database
- **Method**: Service role key
- **Key**: `SUPABASE_SERVICE_ROLE_KEY`
- **Access**: Bypasses RLS (use carefully)

#### Backend → AI Service
- **Method**: None (internal network)
- **Security**: Render's private network
- **Validation**: Service URL validation

#### Worker → Redis
- **Method**: Connection string authentication
- **Security**: Password in Redis URL
- **Network**: Internal network (preferred)

## Data Encryption

### Encryption in Transit

#### HTTPS/TLS
- **All External Communications**: HTTPS required
- **TLS Version**: TLS 1.2+
- **Certificate**: Managed by hosting platform
- **Enforcement**: Automatic redirect HTTP → HTTPS

#### Internal Communications
- **Backend ↔ AI Service**: HTTPS (recommended)
- **Backend ↔ Database**: SSL/TLS required
- **Worker ↔ Redis**: TLS available (optional)

### Encryption at Rest

#### Database
- **Platform**: Supabase (managed encryption)
- **Method**: AES-256 encryption
- **Backups**: Encrypted backups
- **Compliance**: SOC 2 Type II compliant

#### File Storage
- **Documents**: Stored in Supabase Storage
- **Encryption**: Supabase-managed encryption
- **Access**: Signed URLs for access

#### Environment Variables
- **Storage**: Render environment variables
- **Encryption**: Render-managed encryption
- **Access**: Service-specific access

## API Security

### Request Validation

#### Input Validation
- **Schema Validation**: Zod (TypeScript), Drizzle ORM
- **Type Checking**: TypeScript compile-time checks
- **Sanitization**: Input sanitization middleware

#### Rate Limiting (Future)
- **Per User**: Limit requests per user
- **Per Endpoint**: Different limits per endpoint
- **Implementation**: Rate limiting middleware

### CORS Configuration

#### Current Setup
```javascript
cors({
  origin: function (origin, callback) {
    // Allow specific origins
    const allowedOrigins = [
      'https://dellsystemmanager.vercel.app',
      'http://localhost:3000'
    ];
    callback(null, true); // Temporarily allow all for mobile
  },
  credentials: true
})
```

#### Production Recommendations
- Restrict to specific origins
- Remove wildcard origins
- Validate origin headers
- Use environment-based configuration

### API Key Security

#### OpenAI API Key
- **Storage**: Environment variable
- **Access**: AI Service only
- **Rotation**: Manual rotation process
- **Monitoring**: Track API usage

#### Supabase Keys
- **Anon Key**: Public (limited permissions)
- **Service Role Key**: Secret (full access)
- **Storage**: Environment variables
- **Rotation**: Via Supabase dashboard

## Network Security

### Firewall Rules

#### Render Services
- **Inbound**: HTTPS (443) only
- **Outbound**: Allowed to external services
- **Internal**: Private network communication

#### Database
- **Access**: Supabase-managed firewall
- **IP Whitelist**: Configurable
- **SSL**: Required for connections

### Private Network

#### Render Internal Network
- **Services**: Communicate via private network
- **Security**: Isolated from public internet
- **Performance**: Lower latency
- **Cost**: No egress charges

#### Redis Internal URL
- **Format**: `redis://red-xxxxx:6379`
- **Access**: Internal network only
- **Security**: No external exposure

## Data Privacy

### Personal Data Protection

#### User Data
- **Email**: Encrypted at rest
- **Password**: Hashed (bcrypt)
- **Profile Data**: Encrypted at rest
- **Access**: User-specific access only

#### Project Data
- **Isolation**: User-specific projects
- **Access**: RLS policies enforce isolation
- **Sharing**: Future feature (with permissions)

### Data Retention

#### User Data
- **Retention**: As long as account is active
- **Deletion**: On account deletion
- **Backup**: Retained in backups (7 days)

#### Project Data
- **Retention**: As long as project exists
- **Deletion**: Cascade delete on project deletion
- **Backup**: Retained in backups

#### Log Data
- **Retention**: 30 days (Render logs)
- **Deletion**: Automatic after retention period
- **Access**: Account-based access

## Security Best Practices

### Code Security

#### Dependency Management
- **Updates**: Regular dependency updates
- **Vulnerabilities**: Monitor for security vulnerabilities
- **Auditing**: `npm audit`, `pip check`

#### Secret Management
- **Never Commit**: Secrets in code
- **Environment Variables**: Use environment variables
- **Rotation**: Regular secret rotation
- **Access**: Limit access to secrets

### Application Security

#### Input Sanitization
- **User Input**: Sanitize all user input
- **SQL Injection**: Use parameterized queries
- **XSS Prevention**: Escape output
- **CSRF Protection**: CSRF tokens (future)

#### Error Handling
- **Error Messages**: Don't expose sensitive information
- **Logging**: Log errors without sensitive data
- **User Messages**: Generic error messages

### Infrastructure Security

#### Service Isolation
- **Separate Services**: Isolated service instances
- **Network Isolation**: Private network communication
- **Access Control**: Service-specific access

#### Monitoring
- **Log Monitoring**: Monitor for suspicious activity
- **Access Logs**: Track access patterns
- **Alerting**: Alert on security events (future)

## Compliance Considerations

### Data Protection Regulations

#### GDPR (Future)
- **Right to Access**: User data access
- **Right to Deletion**: Account deletion
- **Data Portability**: Export user data
- **Consent Management**: User consent tracking

#### SOC 2 (Supabase)
- **Compliance**: Supabase is SOC 2 Type II compliant
- **Coverage**: Database and storage
- **Audits**: Regular security audits

### Security Audits

#### Current State
- **Manual Reviews**: Code review process
- **Dependency Audits**: npm audit, pip check
- **No External Audits**: Not yet performed

#### Future Considerations
- **Penetration Testing**: Regular security testing
- **Vulnerability Scanning**: Automated scanning
- **Compliance Audits**: Regular compliance reviews

## Incident Response

### Security Incident Procedures

#### Detection
1. Monitor logs for suspicious activity
2. Review error patterns
3. User reports of issues

#### Response
1. Identify scope of incident
2. Contain the incident
3. Investigate root cause
4. Remediate issues
5. Document incident

#### Communication
- **Internal**: Team notification
- **Users**: Notification if data affected
- **Regulators**: If required by law

## Security Checklist

### Development
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention
- [ ] XSS prevention
- [ ] CSRF protection (future)
- [ ] Secure password storage
- [ ] Token expiration and refresh
- [ ] Error message sanitization

### Deployment
- [ ] HTTPS enabled
- [ ] Environment variables secured
- [ ] Database SSL required
- [ ] Firewall rules configured
- [ ] CORS properly configured
- [ ] Secrets not in code
- [ ] Logging configured

### Monitoring
- [ ] Security logs monitored
- [ ] Access patterns tracked
- [ ] Error rates monitored
- [ ] Unusual activity alerts (future)

## Next Steps

- [Deployment Architecture](./06-deployment-architecture.md) - Security deployment details
- [Technology Stack](./09-technology-stack.md) - Security features of technologies
- [System Diagrams](./10-system-diagrams.md) - Security flow diagrams

