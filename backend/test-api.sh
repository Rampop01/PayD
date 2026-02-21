#!/bin/bash

# Test script for Advanced Search & Filtering API
BASE_URL="http://localhost:3000/api/search"
ORG_ID=1

echo "=== Testing Advanced Search & Filtering API ==="
echo ""

# Test 1: Search employees by name
echo "1. Search employees by name 'john':"
curl -s "${BASE_URL}/organizations/${ORG_ID}/employees?query=john" | jq '.'
echo ""

# Test 2: Filter employees by status
echo "2. Filter employees by status 'active':"
curl -s "${BASE_URL}/organizations/${ORG_ID}/employees?status=active" | jq '.'
echo ""

# Test 3: Search employees with pagination
echo "3. Search employees with pagination (page 1, limit 2):"
curl -s "${BASE_URL}/organizations/${ORG_ID}/employees?page=1&limit=2" | jq '.'
echo ""

# Test 4: Search transactions by hash
echo "4. Search transactions by hash 'abc123':"
curl -s "${BASE_URL}/organizations/${ORG_ID}/transactions?query=abc123" | jq '.'
echo ""

# Test 5: Filter transactions by status and amount range
echo "5. Filter transactions by status 'completed' and amount range 1000-3000:"
curl -s "${BASE_URL}/organizations/${ORG_ID}/transactions?status=completed&amountMin=1000&amountMax=3000" | jq '.'
echo ""

# Test 6: Filter transactions by date range
echo "6. Filter transactions by date range (last 30 days):"
DATE_FROM=$(date -u -d '30 days ago' +%Y-%m-%dT%H:%M:%SZ)
DATE_TO=$(date -u +%Y-%m-%dT%H:%M:%SZ)
curl -s "${BASE_URL}/organizations/${ORG_ID}/transactions?dateFrom=${DATE_FROM}&dateTo=${DATE_TO}" | jq '.'
echo ""

# Test 7: Complex search - employees with sorting
echo "7. Search employees sorted by last_name ascending:"
curl -s "${BASE_URL}/organizations/${ORG_ID}/employees?sortBy=last_name&sortOrder=asc" | jq '.'
echo ""

# Test 8: Complex search - transactions with multiple filters
echo "8. Search transactions with multiple filters:"
curl -s "${BASE_URL}/organizations/${ORG_ID}/transactions?status=completed,pending&amountMin=500&sortBy=amount&sortOrder=desc" | jq '.'
echo ""

echo "=== Tests Complete ==="
