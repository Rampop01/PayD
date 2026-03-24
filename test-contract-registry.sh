#!/bin/bash
# Test script for Contract Address Registry API

echo "Testing GET /api/contracts endpoint..."
echo ""

# Start the backend server in the background
cd backend
npm run dev &
SERVER_PID=$!

# Wait for server to start
echo "Waiting for server to start..."
sleep 5

# Test the endpoint
echo "Making request to http://localhost:3000/api/contracts"
echo ""
curl -s http://localhost:3000/api/contracts | jq '.'

# Kill the server
kill $SERVER_PID 2>/dev/null

echo ""
echo "Test complete!"
