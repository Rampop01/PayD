# Transaction Throttling Mechanism

## Overview

The Transaction Throttling Mechanism is a system-level feature designed to prevent hitting Stellar network rate limits and manage transaction submission flow. It implements a **Token Bucket Algorithm** to control the rate at which transactions are submitted to the Stellar network.

## Features

### Core Capabilities

1. **Token Bucket Algorithm**: Implements a leaky bucket/token bucket pattern for smooth rate limiting
2. **Configurable TPM (Transactions Per Minute)**: Adjustable transaction rate limits
3. **Queue-based Buffering**: Handles burst traffic by queuing transactions when rate limit is reached
4. **Priority Queue Support**: High-priority transactions can jump the queue
5. **Automatic Retry Logic**: Configurable retry mechanism for failed transactions
6. **Real-time Metrics**: Comprehensive monitoring and statistics
7. **Event-driven Architecture**: Emits events for monitoring and integration

### Key Components

- **StellarThrottlingService**: Main service managing Stellar transaction throttling
- **ThrottlingService**: Generic throttling service using token bucket algorithm
- **StellarThrottlingController**: REST API endpoints for management
- **Middleware**: Express middleware for automatic throttling

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
│  (Controllers, Routes, Business Logic)                      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│           StellarThrottlingService                          │
│  • Transaction submission management                         │
│  • Retry logic                                              │
│  • Metrics collection                                       │
│  • Event emission                                           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              ThrottlingService                              │
│  • Token bucket algorithm                                   │
│  • Queue management                                         │
│  • Token refill mechanism                                   │
│  • Priority queue support                                   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              StellarService                                 │
│  • Stellar SDK integration                                  │
│  • Transaction submission to Horizon                        │
└─────────────────────────────────────────────────────────────┘
```

## Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# Throttling Configuration
THROTTLING_TPM=100                      # Transactions per minute (default: 100)
THROTTLING_MAX_QUEUE_SIZE=1000          # Maximum queue size (default: 1000)
THROTTLING_REFILL_INTERVAL_MS=1000      # Token refill interval in ms (default: 1000)
```

### Configuration Limits

- **TPM**: 1 - 10,000 transactions per minute
- **Max Queue Size**: 1 - 100,000 transactions
- **Refill Interval**: 100 - 60,000 milliseconds

## Usage

### Basic Transaction Submission

```typescript
import { StellarThrottlingService } from './services/stellarThrottlingService';
import { Transaction } from '@stellar/stellar-sdk';

const throttlingService = StellarThrottlingService.getInstance();

// Submit a transaction
const transaction: Transaction = /* ... */;
const result = await throttlingService.submitTransaction(transaction);

console.log(`Transaction submitted: ${result.hash}`);
```

### Priority Transactions

```typescript
// Submit a high-priority transaction (jumps the queue)
const result = await throttlingService.submitTransaction(transaction, {
  priority: true,
});
```

### Retry Logic

```typescript
// Submit with automatic retry on failure
const result = await throttlingService.submitTransaction(transaction, {
  retryOnFailure: true,
  maxRetries: 3,
  retryDelayMs: 1000, // Exponential backoff applied
});
```

### With Metadata

```typescript
// Submit with custom metadata for tracking
const result = await throttlingService.submitTransaction(transaction, {
  metadata: {
    userId: '123',
    operation: 'payment',
    amount: '100',
  },
});
```

## API Endpoints

### Get Status

```http
GET /api/stellar-throttling/status
```

Returns current throttling status including available tokens and queue size.

**Response:**

```json
{
  "success": true,
  "data": {
    "tpm": 100,
    "currentTokens": 75,
    "maxTokens": 100,
    "queueSize": 5,
    "maxQueueSize": 1000,
    "processedCount": 1234,
    "rejectedCount": 12,
    "isProcessing": true,
    "utilizationRate": 25,
    "queueUtilization": 0.5
  }
}
```

### Get Metrics

```http
GET /api/stellar-throttling/metrics
```

Returns comprehensive metrics about transaction processing.

**Response:**

```json
{
  "success": true,
  "data": {
    "totalSubmitted": 1246,
    "totalSuccessful": 1234,
    "totalFailed": 12,
    "totalThrottled": 150,
    "averageWaitTime": 245,
    "currentQueueDepth": 5,
    "lastSubmissionTime": "2024-03-25T10:30:00Z",
    "successRate": "99.04%",
    "throttleRate": "12.04%"
  }
}
```

### Get Configuration

```http
GET /api/stellar-throttling/config
```

Returns current throttling configuration.

**Response:**

```json
{
  "success": true,
  "data": {
    "tpm": 100,
    "maxQueueSize": 1000,
    "refillIntervalMs": 1000
  }
}
```

### Update Configuration

```http
PUT /api/stellar-throttling/config
Content-Type: application/json

{
  "tpm": 200,
  "maxQueueSize": 2000,
  "refillIntervalMs": 500
}
```

Updates throttling configuration dynamically (no restart required).

**Response:**

```json
{
  "success": true,
  "message": "Throttling configuration updated successfully",
  "data": {
    "tpm": 200,
    "maxQueueSize": 2000,
    "refillIntervalMs": 500
  }
}
```

### Clear Queue

```http
POST /api/stellar-throttling/queue/clear
```

Clears all pending transactions from the queue.

**Response:**

```json
{
  "success": true,
  "message": "Cleared 15 transactions from queue",
  "data": {
    "clearedCount": 15
  }
}
```

### Reset Metrics

```http
POST /api/stellar-throttling/metrics/reset
```

Resets all metrics counters to zero.

### Health Check

```http
GET /api/stellar-throttling/health
```

Returns health status of the throttling service.

**Response (Healthy):**

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "hasCapacity": true,
    "currentTokens": 75,
    "queueSize": 5,
    "queueUtilization": 0.5
  }
}
```

**Response (Degraded - 503):**

```json
{
  "success": true,
  "data": {
    "status": "degraded",
    "hasCapacity": false,
    "currentTokens": 0,
    "queueSize": 1000,
    "queueUtilization": 100
  }
}
```

## Events

The service emits various events for monitoring and integration:

### stellar:transaction:success

Emitted when a transaction is successfully submitted.

```typescript
service.on('stellar:transaction:success', (data) => {
  console.log(`Transaction ${data.hash} submitted in ${data.waitTime}ms`);
});
```

### stellar:transaction:error

Emitted when a transaction submission fails.

```typescript
service.on('stellar:transaction:error', (data) => {
  console.error(`Transaction ${data.transactionId} failed: ${data.error}`);
});
```

### stellar:transaction:queued

Emitted when a transaction is queued due to rate limiting.

```typescript
service.on('stellar:transaction:queued', (data) => {
  console.log(`Transaction ${data.id} queued at position ${data.queuePosition}`);
});
```

### config:updated

Emitted when configuration is updated.

```typescript
service.on('config:updated', (config) => {
  console.log('Configuration updated:', config);
});
```

### queue:cleared

Emitted when the queue is cleared.

```typescript
service.on('queue:cleared', (data) => {
  console.log(`Queue cleared: ${data.clearedCount} transactions removed`);
});
```

## Token Bucket Algorithm

### How It Works

1. **Token Generation**: Tokens are generated at a constant rate (TPM / 60 per second)
2. **Token Consumption**: Each transaction consumes one token
3. **Bucket Capacity**: Maximum tokens = TPM
4. **Queue Buffering**: When no tokens available, transactions are queued
5. **Token Refill**: Tokens refill at configured intervals

### Example

With TPM = 100:

- Tokens refill at ~1.67 tokens/second
- Bucket holds max 100 tokens
- Burst of 100 transactions can be processed immediately
- Sustained rate: 100 transactions/minute
- Queue buffers excess transactions

## Monitoring

### Key Metrics to Monitor

1. **Utilization Rate**: Percentage of tokens being used
2. **Queue Utilization**: Percentage of queue capacity used
3. **Success Rate**: Percentage of successful transactions
4. **Average Wait Time**: Average time transactions spend in queue
5. **Throttle Rate**: Percentage of transactions that were queued

### Recommended Alerts

- Queue utilization > 80%: Consider increasing TPM or queue size
- Success rate < 95%: Investigate transaction failures
- Average wait time > 5000ms: System may be overloaded

## Best Practices

### 1. Set Appropriate TPM

- Start conservative (e.g., 60 TPM)
- Monitor Stellar network response
- Gradually increase if needed
- Stay well below Stellar's actual limits

### 2. Size Your Queue

- Queue size should handle peak burst traffic
- Formula: `maxQueueSize = peakTPM * burstDurationMinutes`
- Example: For 200 TPM peak lasting 5 minutes: `200 * 5 = 1000`

### 3. Use Priority Wisely

- Reserve priority for critical transactions
- Don't overuse (defeats the purpose)
- Examples: User-initiated payments, time-sensitive operations

### 4. Enable Retry for Transient Failures

- Use retry for network errors
- Don't retry for invalid transactions
- Set reasonable max retries (2-3)

### 5. Monitor Metrics

- Set up dashboards for key metrics
- Configure alerts for degraded performance
- Review metrics regularly

## Troubleshooting

### Queue Full Errors

**Symptom**: `Transaction queue is full` errors

**Solutions**:

1. Increase `THROTTLING_MAX_QUEUE_SIZE`
2. Increase `THROTTLING_TPM` to process faster
3. Investigate why transactions are backing up

### High Wait Times

**Symptom**: Transactions taking too long to process

**Solutions**:

1. Increase `THROTTLING_TPM`
2. Reduce `THROTTLING_REFILL_INTERVAL_MS` for faster refills
3. Check Stellar network status

### Low Success Rate

**Symptom**: Many transaction failures

**Solutions**:

1. Check Stellar network connectivity
2. Verify transaction construction
3. Review error logs for patterns
4. Consider enabling retry logic

## Testing

### Unit Tests

```bash
npm test -- stellarThrottlingService.test.ts
npm test -- stellarThrottlingController.test.ts
```

### Integration Tests

```bash
npm test -- throttling.integration.test.ts
```

### Load Testing

```bash
# Simulate high load
npm run test:load -- --tpm 500 --duration 60
```

## Performance Considerations

### Memory Usage

- Each queued transaction: ~1-2 KB
- 1000 queued transactions: ~1-2 MB
- Monitor memory if using large queue sizes

### CPU Usage

- Token refill: Minimal overhead
- Queue processing: Scales with TPM
- Event emission: Negligible impact

### Latency

- Immediate execution: < 1ms overhead
- Queued execution: Depends on queue position and TPM
- Average: 50-500ms for moderate load

## Security Considerations

1. **Rate Limit API Endpoints**: Protect configuration endpoints
2. **Authentication**: Require auth for admin operations
3. **Validation**: Validate all configuration inputs
4. **Monitoring**: Log all configuration changes
5. **Access Control**: Restrict who can modify settings

## Future Enhancements

- [ ] Redis-based distributed throttling
- [ ] Per-account throttling limits
- [ ] Dynamic TPM adjustment based on network conditions
- [ ] Advanced retry strategies (circuit breaker)
- [ ] Prometheus metrics export
- [ ] Grafana dashboard templates
- [ ] WebSocket real-time status updates

## References

- [Stellar Network Rate Limits](https://developers.stellar.org/docs/horizon/rate-limiting)
- [Token Bucket Algorithm](https://en.wikipedia.org/wiki/Token_bucket)
- [Leaky Bucket Algorithm](https://en.wikipedia.org/wiki/Leaky_bucket)

## Support

For issues or questions:

- GitHub Issues: [Create an issue](https://github.com/your-repo/issues)
- Documentation: [Full docs](https://docs.your-project.com)
- Community: [Discord/Slack channel]
