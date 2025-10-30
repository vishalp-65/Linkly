# Analytics System Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Analytics    │  │ WebSocket    │  │ Redux Store          │  │
│  │ Page         │◄─┤ Service      │◄─┤ (analyticsSlice)     │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────────────────┘  │
│         │                  │                                      │
└─────────┼──────────────────┼──────────────────────────────────┘
          │                  │
          │ HTTP/REST        │ WebSocket
          │                  │
┌─────────▼──────────────────▼──────────────────────────────────┐
│                      Backend (Node.js/Express)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │ Analytics    │  │ WebSocket    │  │ Direct Analytics     │ │
│  │ Controller   │  │ Service      │  │ Service              │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────────────┘ │
│         │                  │                  │                  │
│  ┌──────▼──────────────────▼──────────────────▼───────────────┐│
│  │              Analytics Repository                           ││
│  └──────┬──────────────────────────────────────────────────────┘│
│         │                                                         │
└─────────┼─────────────────────────────────────────────────────┘
          │
┌─────────▼─────────────────────────────────────────────────────┐
│                    Data Layer                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │ PostgreSQL   │  │ Redis Cache  │  │ Kafka (Optional)     │ │
│  │ - Events     │  │ - Analytics  │  │ - Event Stream       │ │
│  │ - Summaries  │  │ - Realtime   │  │                      │ │
│  └──────────────┘  └──────────────┘  └──────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Component Details

### Frontend Components

#### 1. Analytics Page (`AnalyticsPage.tsx`)
**Responsibilities**:
- Display analytics dashboard
- Manage date range selection
- Handle WebSocket connection lifecycle
- Transform API data for charts
- Update UI on real-time events

**Key Features**:
- Real-time click counter
- WebSocket connection status
- Date range picker
- Multiple chart types
- Export functionality (planned)

**Data Flow**:
```
User Action → Redux Action → RTK Query → API Call → Update UI
                    ↓
            WebSocket Event → Redux Action → Update UI
```

#### 2. WebSocket Service (`websocket.ts`)
**Responsibilities**:
- Manage WebSocket connection
- Handle reconnection logic
- Subscribe/unsubscribe to events
- Emit and receive events

**Connection Lifecycle**:
```
Connect → Authenticate → Subscribe → Receive Events → Unsubscribe → Disconnect
           ↓                                ↓
      Retry on Fail              Update Redux Store
```

#### 3. Analytics Slice (`analyticsSlice.ts`)
**Responsibilities**:
- Store analytics state
- Cache analytics data
- Manage date range
- Handle real-time updates

**State Structure**:
```typescript
{
  currentAnalytics: AnalyticsData | null,
  realtimeData: RealtimeData | null,
  globalAnalytics: GlobalAnalytics | null,
  dateRange: DateRange,
  analyticsCache: Record<string, CachedData>,
  isLoading: boolean,
  error: string | null
}
```

### Backend Components

#### 1. WebSocket Service (`websocketService.ts`)
**Responsibilities**:
- Initialize Socket.IO server
- Manage client connections
- Handle room-based subscriptions
- Broadcast click events
- Track connection statistics

**Room Structure**:
```
analytics:abc123 → [socket1, socket2, socket3]
analytics:xyz789 → [socket4, socket5]
```

**Event Flow**:
```
Click Event → Emit to Room → All Subscribers Receive
```

#### 2. Analytics Controller (`analytics.controller.ts`)
**Responsibilities**:
- Handle HTTP requests
- Validate user permissions
- Transform data for frontend
- Manage cache invalidation

**Endpoints**:
- `GET /analytics/:shortCode` - Get analytics
- `GET /analytics/:shortCode/realtime` - Get realtime data
- `GET /analytics/global/summary` - Get global analytics
- `POST /analytics/:shortCode/invalidate-cache` - Clear cache
- `GET /analytics/cache/stats` - Cache statistics
- `GET /analytics/websocket/stats` - WebSocket statistics

#### 3. Direct Analytics Service (`directAnalyticsService.ts`)
**Responsibilities**:
- Buffer analytics events
- Batch insert to database
- Emit WebSocket events
- Handle failures gracefully

**Buffer Management**:
```
Event → Buffer → Flush (when full or timeout) → Database
         ↓
    WebSocket Emit (immediate)
```

#### 4. Analytics Repository (`AnalyticsRepository.ts`)
**Responsibilities**:
- Query analytics data
- Use daily summaries when available
- Fall back to raw events
- Aggregate data efficiently

**Query Strategy**:
```
Check Daily Summaries → Use if Available
         ↓
    Query Raw Events → Aggregate on-the-fly
```

### Data Layer

#### 1. PostgreSQL Tables

**analytics_events**:
```sql
- event_id (UUID, PK)
- short_code (VARCHAR)
- clicked_at (TIMESTAMP)
- ip_address (VARCHAR)
- user_agent (TEXT)
- referrer (VARCHAR)
- country_code (VARCHAR)
- region (VARCHAR)
- city (VARCHAR)
- device_type (VARCHAR)
- browser (VARCHAR)
- os (VARCHAR)
```

**analytics_daily_summaries**:
```sql
- id (SERIAL, PK)
- short_code (VARCHAR)
- date (DATE)
- total_clicks (INTEGER)
- unique_visitors (INTEGER)
- top_countries (JSONB)
- top_referrers (JSONB)
- device_breakdown (JSONB)
- browser_breakdown (JSONB)
- hourly_distribution (JSONB)
- peak_hour (INTEGER)
- avg_clicks_per_hour (NUMERIC)
```

#### 2. Redis Cache

**Cache Keys**:
```
analytics:{shortCode}:{dateFrom}:{dateTo} → Analytics Data (TTL: 5 min)
realtime:{shortCode} → Realtime Data (TTL: 1 min)
global:{userId}:{dateFrom}:{dateTo} → Global Analytics (TTL: 10 min)
```

**Cache Strategy**:
```
Request → Check Cache → Return if Valid
              ↓
         Query Database → Cache Result → Return
```

#### 3. Kafka (Optional)

**Topics**:
- `analytics-events` - Raw click events
- `analytics-aggregations` - Aggregated data

**Flow**:
```
Click → Kafka Producer → Topic → Consumer → Database
```

## Data Flow Diagrams

### Click Event Flow

```
User Clicks URL
      ↓
URL Controller Records Click
      ↓
Direct Analytics Service
      ├─→ Buffer Event → Database (batched)
      └─→ WebSocket Service (immediate)
            ↓
      Broadcast to Room
            ↓
      Frontend Receives Event
            ↓
      Update Redux Store
            ↓
      Refetch Analytics
            ↓
      Update Charts
```

### Analytics Query Flow

```
User Opens Analytics Page
      ↓
Frontend Requests Data
      ↓
Backend Controller
      ├─→ Check User Permission
      ├─→ Check Cache
      │     ├─→ Return if Valid
      │     └─→ Query Database
      │           ├─→ Use Daily Summaries
      │           └─→ Use Raw Events
      └─→ Transform Data
            ↓
      Cache Result
            ↓
      Return to Frontend
            ↓
      Transform for Charts
            ↓
      Render UI
```

### Real-time Update Flow

```
Click Event Occurs
      ↓
WebSocket Emits Event
      ↓
Frontend Receives Event
      ├─→ Update Live Counter
      ├─→ Update Redux Store
      └─→ Trigger Analytics Refetch
            ↓
      Backend Returns Updated Data
            ↓
      Charts Re-render
```

## Scalability Considerations

### Horizontal Scaling

**WebSocket Servers**:
```
Load Balancer
      ├─→ WebSocket Server 1
      ├─→ WebSocket Server 2
      └─→ WebSocket Server 3
            ↓
      Redis Pub/Sub (for cross-server events)
```

**API Servers**:
```
Load Balancer
      ├─→ API Server 1
      ├─→ API Server 2
      └─→ API Server 3
            ↓
      Shared Redis Cache
            ↓
      PostgreSQL (Read Replicas)
```

### Performance Optimizations

1. **Caching Strategy**:
   - Multi-level caching (Redis + In-memory)
   - Cache warming for popular URLs
   - Intelligent cache invalidation

2. **Database Optimization**:
   - Daily summaries for historical data
   - Partitioning by date
   - Indexes on frequently queried columns

3. **WebSocket Optimization**:
   - Room-based broadcasting
   - Connection pooling
   - Heartbeat monitoring

4. **Query Optimization**:
   - Parallel query execution
   - Aggregation at database level
   - Limit result sets

## Security Considerations

### Authentication
- JWT tokens for API requests
- JWT tokens for WebSocket connections
- Token expiration and refresh

### Authorization
- User can only view their own analytics
- Ownership verification on every request
- Rate limiting per user

### Data Privacy
- IP address hashing (optional)
- GDPR compliance
- Data retention policies

## Monitoring and Observability

### Metrics to Track
- WebSocket connection count
- Active subscriptions per short code
- Analytics query latency
- Cache hit/miss ratio
- Database query performance
- Event processing rate

### Logging
- WebSocket connection events
- Analytics queries
- Cache operations
- Error tracking
- Performance metrics

### Alerts
- High WebSocket connection count
- Database query timeouts
- Cache failures
- WebSocket disconnections
- High error rates

## Future Enhancements

### Phase 1 (Immediate)
- [ ] Export to CSV/PDF
- [ ] More granular time filters
- [ ] Browser breakdown chart
- [ ] OS breakdown chart

### Phase 2 (Short-term)
- [ ] Custom date range picker
- [ ] Analytics comparison
- [ ] Email reports
- [ ] Webhook notifications

### Phase 3 (Long-term)
- [ ] A/B testing support
- [ ] Conversion tracking
- [ ] UTM parameter tracking
- [ ] Bot detection
- [ ] Machine learning insights
- [ ] Predictive analytics

## Technology Stack

### Frontend
- React 18
- TypeScript
- Redux Toolkit
- RTK Query
- Socket.IO Client
- Recharts (for charts)
- TailwindCSS

### Backend
- Node.js
- Express
- TypeScript
- Socket.IO
- PostgreSQL
- Redis
- Kafka (optional)
- JWT

### Infrastructure
- Docker
- Kubernetes (for scaling)
- Nginx (load balancer)
- Prometheus (monitoring)
- Grafana (dashboards)
