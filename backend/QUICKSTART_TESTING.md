# Quick Start - Testing Guide

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

## Installation

```bash
cd backend
npm install
```

## Running Tests

### 1. Run All Tests

```bash
npm test
```

Expected output:

```
PASS  src/services/__tests__/searchService.test.ts
PASS  src/controllers/__tests__/searchController.test.ts

Test Suites: 2 passed, 2 total
Tests:       60 passed, 60 total
Time:        2.5s
```

### 2. Run Tests with Coverage

```bash
npm test -- --coverage
```

Expected output:

```
----------------------|---------|----------|---------|---------|
File                  | % Stmts | % Branch | % Funcs | % Lines |
----------------------|---------|----------|---------|---------|
searchService.ts      |   95.5  |   90.2   |  100.0  |   95.8  |
searchController.ts   |   92.3  |   85.7   |  100.0  |   93.1  |
----------------------|---------|----------|---------|---------|
All files             |   94.2  |   88.5   |  100.0  |   94.7  |
```

### 3. Run Tests in Watch Mode

```bash
npm run test:watch
```

This will re-run tests automatically when you save files.

### 4. Run Specific Test File

```bash
npm test -- searchService.test.ts
```

### 5. Run Tests Matching Pattern

```bash
npm test -- --testNamePattern="should search employees"
```

### 6. View HTML Coverage Report

```bash
npm test -- --coverage
open coverage/lcov-report/index.html
```

## Test Structure

```
backend/
├── src/
│   ├── services/
│   │   ├── __tests__/
│   │   │   └── searchService.test.ts      # 24 unit tests
│   │   └── searchService.ts
│   └── controllers/
│       ├── __tests__/
│       │   └── searchController.test.ts   # 36 integration tests
│       └── searchController.ts
├── jest.config.js                         # Jest configuration
└── package.json                           # Test scripts
```

## What's Being Tested?

### SearchService (Unit Tests)

- ✅ Full-text search with PostgreSQL tsvector
- ✅ Status filtering
- ✅ Date range filtering
- ✅ Amount range filtering
- ✅ Pagination logic
- ✅ Sorting functionality
- ✅ Edge cases (special chars, empty results, etc.)

### SearchController (Integration Tests)

- ✅ API endpoint responses
- ✅ Query parameter parsing
- ✅ Input validation (Zod)
- ✅ Error handling (400, 500)
- ✅ Complex multi-filter queries

## Common Commands

| Command                     | Description                    |
| --------------------------- | ------------------------------ |
| `npm test`                  | Run all tests once             |
| `npm test -- --coverage`    | Run tests with coverage report |
| `npm run test:watch`        | Run tests in watch mode        |
| `npm test -- --verbose`     | Run tests with detailed output |
| `npm test -- searchService` | Run only searchService tests   |
| `npm test -- --bail`        | Stop on first test failure     |

## Debugging Tests

### VS Code Debug Configuration

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/backend/node_modules/.bin/jest",
  "args": ["--runInBand", "--no-cache"],
  "console": "integratedTerminal",
  "cwd": "${workspaceFolder}/backend"
}
```

Then:

1. Set breakpoints in test files
2. Press F5 or click "Run and Debug"
3. Select "Jest Debug"

### Debug Single Test

```bash
npm test -- -t "should search employees with full-text query" --runInBand
```

## Troubleshooting

### Issue: Tests not found

**Solution**: Make sure you're in the `backend` directory

```bash
cd backend
npm test
```

### Issue: Module not found errors

**Solution**: Install dependencies

```bash
npm install
```

### Issue: Tests timeout

**Solution**: Increase timeout in jest.config.js

```javascript
testTimeout: 10000;
```

### Issue: Coverage not generated

**Solution**: Check jest.config.js has `collectCoverageFrom` configured

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: cd backend && npm install
      - run: cd backend && npm test -- --coverage
      - uses: codecov/codecov-action@v3
        with:
          files: ./backend/coverage/lcov.info
```

## Test Examples

### Example 1: Unit Test

```typescript
it('should search employees with full-text query', async () => {
  mockPool.query
    .mockResolvedValueOnce({ rows: [{ total: '2' }] })
    .mockResolvedValueOnce({ rows: mockEmployees });

  const result = await searchService.searchEmployees(1, {
    query: 'john',
    page: 1,
    limit: 20,
  });

  expect(result.data).toEqual(mockEmployees);
  expect(result.pagination.total).toBe(2);
});
```

### Example 2: Integration Test

```typescript
it('should return employees with default pagination', async () => {
  (searchService.searchEmployees as jest.Mock).mockResolvedValue(mockEmployeeResult);

  const response = await request(app).get('/api/search/organizations/1/employees').expect(200);

  expect(response.body).toEqual(mockEmployeeResult);
});
```

## Next Steps

1. ✅ Install dependencies: `npm install`
2. ✅ Run tests: `npm test`
3. ✅ Check coverage: `npm test -- --coverage`
4. ✅ Review test files in `src/**/__tests__/`
5. ✅ Read [TESTING.md](TESTING.md) for detailed documentation

## Resources

- [Jest Documentation](https://jestjs.io/)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Testing Best Practices](https://testingjavascript.com/)

---

**Ready to test?** Run `npm test` and watch all 60+ tests pass! ✅
