# Advanced Search & Filtering Implementation

## Overview

This implementation provides a powerful search and filtering engine for employee lists and transaction history, meeting all acceptance criteria for issue #051.

## Acceptance Criteria ✅

### 1. Full-text search integrated with PostgreSQL `tsvector` ✅

- **Generated `tsvector` columns**: Both `employees` and `transactions` tables have auto-generated `search_vector` columns using PostgreSQL's `GENERATED ALWAYS AS` syntax
- **Weighted search**: Different fields have different weights (A, B, C) for relevance ranking
- **GIN indexes**: Full-text search indexes created for optimal performance
- **Ranking**: Results are ranked by relevance using `ts_rank()` function

**Employees search includes:**

- First name (weight A - highest priority)
- Last name (weight A)
- Email (weight B)
- Position (weight C)
- Department (weight C)

**Transactions search includes:**

- Transaction hash (weight A)
- Asset code (weight B)
- Status (weight C)

### 2. Multi-criteria filtering (status, date, amount range) ✅

**Employee filters:**

- Status (active, inactive, pending)
- Date range (created_at)
- Full-text search query
- Sorting by multiple columns

**Transaction filters:**

- Status (pending, completed, failed)
- Date range (created_at)
- Amount range (min/max)
- Full-text search query
- Sorting by multiple columns

### 3. Search results are paginated and performant ✅

**Pagination:**

- Configurable page size (default: 20, customizable via `limit` parameter)
- Page number support
- Total count and total pages in response
- Offset-based pagination

**Performance optimizations:**

- B-tree indexes on frequently filtered columns (status, dates, amounts)
- GIN indexes for full-text search
- Connection pooling (max 20 connections)
- Efficient query construction with parameterized queries
- Separate count and data queries run in parallel

## Technical Implementation

### Database Schema

```sql
-- Generated tsvector column for employees
search_vector tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('english', coalesce(first_name, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(last_name, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(email, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(position, '')), 'C') ||
  setweight(to_tsvector('english', coalesce(department, '')), 'C')
) STORED

-- GIN index for fast full-text search
CREATE INDEX idx_employees_search ON employees USING GIN(search_vector);
```

### Search Service Architecture

```
SearchService
├── searchEmployees()
│   ├── Full-text search with ts_rank
│   ├── Status filtering
│   ├── Date range filtering
│   ├── Pagination
│   └── Sorting
└── searchTransactions()
    ├── Full-text search with ts_rank
    ├── Status filtering
    ├── Date range filtering
    ├── Amount range filtering
    ├── Pagination
    └── Sorting
```

### API Endpoints

#### Search Employees

```
GET /api/search/organizations/:organizationId/employees
```

#### Search Transactions

```
GET /api/search/organizations/:organizationId/transactions
```

### Query Parameters

| Parameter | Type   | Description                        | Example                |
| --------- | ------ | ---------------------------------- | ---------------------- |
| query     | string | Full-text search query             | `john`                 |
| status    | string | Comma-separated statuses           | `active,pending`       |
| dateFrom  | string | ISO 8601 date                      | `2024-01-01T00:00:00Z` |
| dateTo    | string | ISO 8601 date                      | `2024-12-31T23:59:59Z` |
| amountMin | number | Minimum amount (transactions only) | `100`                  |
| amountMax | number | Maximum amount (transactions only) | `1000`                 |
| page      | number | Page number                        | `1`                    |
| limit     | number | Items per page                     | `20`                   |
| sortBy    | string | Sort column                        | `created_at`           |
| sortOrder | string | Sort order (asc/desc)              | `desc`                 |

## Performance Benchmarks

### Index Strategy

1. **GIN indexes** for full-text search (O(log n) lookup)
2. **B-tree indexes** for:
   - Foreign keys (organization_id, employee_id)
   - Status columns
   - Date columns
   - Amount columns
   - Unique constraints (tx_hash, email)

### Query Optimization

- Parameterized queries prevent SQL injection
- Parallel execution of count and data queries
- Limited result sets via pagination
- Efficient WHERE clause construction
- Relevance ranking only when search query is present

## Security Features

- **Input validation**: Zod schema validation for all query parameters
- **SQL injection prevention**: Parameterized queries throughout
- **Type safety**: Full TypeScript implementation
- **Error handling**: Comprehensive error catching and logging
- **Rate limiting ready**: Structure supports middleware addition

## Usage Examples

### Example 1: Search employees by name

```bash
curl "http://localhost:3000/api/search/organizations/1/employees?query=john"
```

### Example 2: Filter active employees

```bash
curl "http://localhost:3000/api/search/organizations/1/employees?status=active&sortBy=last_name&sortOrder=asc"
```

### Example 3: Search transactions by hash with amount range

```bash
curl "http://localhost:3000/api/search/organizations/1/transactions?query=abc123&amountMin=100&amountMax=1000"
```

### Example 4: Complex transaction search

```bash
curl "http://localhost:3000/api/search/organizations/1/transactions?status=completed,pending&dateFrom=2024-01-01T00:00:00Z&dateTo=2024-12-31T23:59:59Z&amountMin=500&sortBy=amount&sortOrder=desc&page=1&limit=50"
```

## Testing

### Setup Test Environment

1. Run migrations:

```bash
psql -d payd -f src/db/migrations/001_create_tables.sql
```

2. Seed test data:

```bash
psql -d payd -f src/db/seed.sql
```

3. Run test script:

```bash
./test-api.sh
```

### Manual Testing

Use the provided `test-api.sh` script which includes 8 comprehensive test cases covering:

- Simple text search
- Status filtering
- Pagination
- Hash search
- Amount range filtering
- Date range filtering
- Sorting
- Complex multi-criteria searches

## Future Enhancements

Potential improvements for future iterations:

1. **Fuzzy search**: Add support for typo tolerance using `pg_trgm`
2. **Autocomplete**: Implement prefix matching for search suggestions
3. **Search analytics**: Track popular searches and optimize accordingly
4. **Caching**: Add Redis caching for frequently accessed queries
5. **Cursor-based pagination**: For better performance on large datasets
6. **Faceted search**: Add aggregation counts for filter options
7. **Saved searches**: Allow users to save and reuse complex queries
8. **Export results**: Add CSV/Excel export functionality

## Maintenance

### Monitoring

Monitor these metrics:

- Query execution time
- Index usage statistics
- Cache hit rates (if caching is added)
- Most common search patterns

### Database Maintenance

```sql
-- Analyze tables for query planner
ANALYZE employees;
ANALYZE transactions;

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- Vacuum tables periodically
VACUUM ANALYZE employees;
VACUUM ANALYZE transactions;
```

## Conclusion

This implementation fully satisfies all acceptance criteria:

- ✅ PostgreSQL `tsvector` full-text search with relevance ranking
- ✅ Multi-criteria filtering (status, dates, amounts)
- ✅ Paginated and performant results with proper indexing

The solution is production-ready, type-safe, secure, and scalable.
