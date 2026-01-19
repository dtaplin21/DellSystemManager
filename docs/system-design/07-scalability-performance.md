# Scalability & Performance

This document describes scaling strategies, performance optimization techniques, caching layers, load balancing, and resource requirements.

## Scaling Overview

The system is designed to scale both horizontally and vertically, with different strategies for different components.

## Horizontal Scaling Strategies

### Backend API Service

#### Current State
- **Instances**: 1
- **Plan**: Starter ($7/month)
- **Resources**: 0.5 CPU, 512 MB RAM

#### Scaling Approach
- **Stateless Design**: Supports horizontal scaling
- **No Shared State**: Each instance is independent
- **Database**: Shared PostgreSQL database
- **Session Storage**: Redis (shared)

#### Scaling Considerations
- ✅ Can scale to multiple instances
- ✅ Load balancer distributes requests
- ⚠️ Database connection pool limits
- ⚠️ Redis connection limits

#### Recommended Scaling
- **2-3 Instances**: For moderate load
- **5+ Instances**: For high load
- **Load Balancer**: Render's built-in load balancer

### AI Service

#### Current State
- **Instances**: 1
- **Plan**: Starter ($7/month)
- **Resources**: 0.5 CPU, 512 MB RAM

#### Scaling Approach
- **Stateless Design**: Supports horizontal scaling
- **Browser Sessions**: Managed per instance
- **Model Calls**: Independent per instance

#### Scaling Considerations
- ✅ Can scale to multiple instances
- ⚠️ Browser session isolation
- ⚠️ OpenAI API rate limits
- ⚠️ Cost increases with instances

#### Recommended Scaling
- **2 Instances**: For moderate AI load
- **3-5 Instances**: For high AI load
- **Cost Monitoring**: Track API costs per instance

### Worker Service

#### Current State
- **Instances**: 1
- **Plan**: Starter ($7/month)
- **Resources**: 0.5 CPU, 512 MB RAM

#### Scaling Approach
- **Job Distribution**: Redis queue distributes jobs
- **Multiple Workers**: Can process jobs in parallel
- **Job Locking**: BullMQ prevents duplicate processing

#### Scaling Considerations
- ✅ Can scale to multiple instances
- ✅ Jobs distributed automatically
- ⚠️ Database connection limits
- ⚠️ Redis connection limits

#### Recommended Scaling
- **2-3 Workers**: For moderate job volume
- **5+ Workers**: For high job volume
- **Queue Monitoring**: Monitor queue depth

### Database Scaling

#### Current State
- **Platform**: Supabase (managed PostgreSQL)
- **Plan**: Free tier or paid
- **Limitations**: Connection limits based on plan

#### Scaling Options
1. **Vertical Scaling**: Upgrade Supabase plan
2. **Read Replicas**: For read-heavy workloads (future)
3. **Connection Pooling**: Optimize connection usage

#### Connection Pooling
- **Current**: Supabase-managed pooling
- **Optimization**: Reuse connections
- **Monitoring**: Track connection usage

### Redis Scaling

#### Current State
- **Platform**: Render Redis
- **Plan**: Starter (Free tier available)
- **Limitations**: Memory limits based on plan

#### Scaling Options
1. **Vertical Scaling**: Upgrade Redis plan
2. **Redis Cluster**: For high availability (future)
3. **Memory Optimization**: Optimize data storage

## Performance Optimization

### Database Optimization

#### Indexing Strategy
```sql
-- Frequently queried columns
CREATE INDEX idx_projects_user ON projects(user_id);
CREATE INDEX idx_asbuilt_project ON asbuilt_records(project_id);
CREATE INDEX idx_documents_project ON documents(project_id);

-- Composite indexes for common queries
CREATE INDEX idx_asbuilt_project_panel ON asbuilt_records(project_id, panel_id);
```

#### Query Optimization
- **Use Indexes**: Ensure queries use indexes
- **Limit Results**: Use pagination for large datasets
- **Avoid N+1 Queries**: Use joins or batch queries
- **JSONB Queries**: Use efficient JSONB operators

#### Connection Pooling
- **Pool Size**: Managed by Supabase
- **Connection Reuse**: Reuse connections
- **Timeout**: 30 seconds default

### Caching Strategy

#### Multi-Layer Caching

**Layer 1: Application Cache (In-Memory)**
- **Purpose**: Frequently accessed data
- **TTL**: 5-15 minutes
- **Examples**: Project data, user settings
- **Invalidation**: On data updates

**Layer 2: Redis Cache**
- **Purpose**: Shared cache across instances
- **TTL**: 24 hours - 7 days
- **Examples**: Job status, session data, AI context
- **Invalidation**: Time-based or event-based

**Layer 3: CDN Cache (Future)**
- **Purpose**: Static assets
- **TTL**: Long-term
- **Examples**: Images, documents, static files

#### Cache Invalidation Patterns

**Time-Based**:
- Automatic expiration after TTL
- Simple but may serve stale data

**Event-Based**:
- Invalidate on data updates
- More complex but ensures freshness

**Hybrid**:
- Combine time-based and event-based
- Balance between freshness and performance

### API Performance

#### Response Time Optimization
- **Database Queries**: Optimize slow queries
- **External API Calls**: Use timeouts and retries
- **Payload Size**: Minimize response payloads
- **Compression**: Enable gzip compression

#### Request Optimization
- **Pagination**: Limit result sets
- **Field Selection**: Return only needed fields
- **Batch Operations**: Combine multiple requests

### Frontend Performance

#### Next.js Optimization
- **Server-Side Rendering**: Initial page load
- **Static Generation**: Pre-render static pages
- **Code Splitting**: Lazy load components
- **Image Optimization**: Next.js Image component

#### Asset Optimization
- **JavaScript**: Minify and bundle
- **CSS**: Tailwind CSS purging
- **Images**: Optimize and compress
- **Fonts**: Use system fonts or optimize

## Load Balancing

### Current Implementation
- **Platform**: Render's built-in load balancer
- **Method**: Round-robin distribution
- **Health Checks**: Automatic health monitoring

### Load Balancing Strategy

#### Backend API
- **Distribution**: Round-robin
- **Health Checks**: Automatic
- **Session Affinity**: Not required (stateless)

#### AI Service
- **Distribution**: Round-robin
- **Health Checks**: `/health` endpoint
- **Session Affinity**: Not required (stateless)

### Future Considerations
- **Sticky Sessions**: If needed for stateful operations
- **Geographic Distribution**: Multi-region deployment
- **Intelligent Routing**: Route based on load or location

## Resource Requirements

### Minimum Requirements (Development)

**Backend API**:
- CPU: 0.25 CPU
- RAM: 256 MB
- Storage: 1 GB

**AI Service**:
- CPU: 0.5 CPU
- RAM: 512 MB
- Storage: 2 GB

**Worker Service**:
- CPU: 0.25 CPU
- RAM: 256 MB
- Storage: 1 GB

**Database**:
- Storage: 500 MB
- Connections: 60 (Supabase free tier)

**Redis**:
- Memory: 25 MB (free tier)
- Connections: Unlimited

### Recommended Requirements (Production)

**Backend API**:
- CPU: 1 CPU
- RAM: 1 GB
- Storage: 5 GB
- Instances: 2-3

**AI Service**:
- CPU: 1 CPU
- RAM: 2 GB
- Storage: 10 GB
- Instances: 2

**Worker Service**:
- CPU: 0.5 CPU
- RAM: 512 MB
- Storage: 2 GB
- Instances: 2-3

**Database**:
- Storage: 10 GB+
- Connections: 200+
- Plan: Pro or higher

**Redis**:
- Memory: 100 MB+
- Connections: Unlimited

## Performance Metrics

### Key Metrics to Monitor

#### API Metrics
- **Request Rate**: Requests per second
- **Response Time**: P50, P95, P99 latencies
- **Error Rate**: Percentage of failed requests
- **Throughput**: Requests processed per second

#### Database Metrics
- **Query Time**: Average query duration
- **Connection Count**: Active connections
- **Cache Hit Rate**: Query cache effectiveness
- **Slow Queries**: Queries exceeding threshold

#### Job Queue Metrics
- **Queue Depth**: Number of pending jobs
- **Processing Time**: Average job duration
- **Failure Rate**: Percentage of failed jobs
- **Throughput**: Jobs processed per minute

#### AI Service Metrics
- **Model Call Time**: Time per AI call
- **Token Usage**: Tokens consumed
- **Cost per Request**: API cost tracking
- **Error Rate**: Failed AI calls

### Monitoring Tools

#### Current Implementation
- **Render Logs**: Service logs
- **Application Logs**: Structured logging
- **Manual Monitoring**: Periodic checks

#### Future Considerations
- **APM Tool**: New Relic, Datadog, or similar
- **Error Tracking**: Sentry or similar
- **Metrics Dashboard**: Custom dashboard
- **Alerting**: Automated alerts for issues

## Cost Optimization

### AI Service Costs

#### Model Selection
- **Simple Tasks**: Route to cheaper models
- **Complex Tasks**: Use GPT-4o
- **Cost Tracking**: Monitor per-user costs
- **Tier Limits**: Enforce user tier limits

#### Caching Strategy
- **Cache Results**: Cache AI responses when possible
- **Reduce Calls**: Minimize redundant API calls
- **Batch Processing**: Process multiple items together

### Infrastructure Costs

#### Service Optimization
- **Right-Sizing**: Use appropriate plan sizes
- **Auto-Scaling**: Scale down during low usage
- **Resource Monitoring**: Track resource usage

#### Database Optimization
- **Query Optimization**: Reduce database load
- **Connection Pooling**: Optimize connections
- **Storage Management**: Clean up old data

## Capacity Planning

### Current Capacity

**Backend API**:
- **Concurrent Users**: ~50-100
- **Requests/Second**: ~10-20
- **Bottleneck**: Database connections

**AI Service**:
- **Concurrent Requests**: ~5-10
- **Requests/Minute**: ~10-20
- **Bottleneck**: OpenAI API rate limits

**Worker Service**:
- **Concurrent Jobs**: ~5-10
- **Jobs/Hour**: ~100-200
- **Bottleneck**: Processing time

### Scaling Triggers

#### Scale Up When:
- CPU usage > 70% for extended period
- Memory usage > 80%
- Response time > 2 seconds (P95)
- Error rate > 1%
- Queue depth > 100 jobs

#### Scale Down When:
- CPU usage < 30% for extended period
- Memory usage < 50%
- Low request volume
- Low queue depth

## Performance Testing

### Load Testing (Future)
- **Tool**: k6, Artillery, or similar
- **Scenarios**: 
  - Normal load
  - Peak load
  - Stress test
- **Metrics**: Response time, error rate, throughput

### Benchmarking
- **Baseline**: Establish performance baseline
- **Regular Testing**: Periodic performance tests
- **Regression Testing**: Detect performance regressions

## Next Steps

- [Deployment Architecture](./06-deployment-architecture.md) - Infrastructure details
- [Technology Stack](./09-technology-stack.md) - Technology performance characteristics
- [System Diagrams](./10-system-diagrams.md) - Performance flow diagrams

