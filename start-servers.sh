#!/bin/bash

echo "Starting Hospital Appointment System Backend Servers..."
echo

# Function to cleanup background processes
cleanup() {
    echo
    echo "Shutting down all servers..."
    kill $SERVER1_PID $SERVER2_PID $SERVER3_PID 2>/dev/null
    echo "All servers stopped. Goodbye!"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

echo "Starting Server 1 (Port 5001)..."
PORT=5001 SERVER_ID=1 node server.js &
SERVER1_PID=$!

sleep 2

echo "Starting Server 2 (Port 5002)..."
PORT=5002 SERVER_ID=2 node server.js &
SERVER2_PID=$!

sleep 2

echo "Starting Server 3 (Port 5003)..."
PORT=5003 SERVER_ID=3 node server.js &
SERVER3_PID=$!

echo
echo "All servers started!"
echo "Server URLs:"
echo "  - Server 1: http://localhost:5001"
echo "  - Server 2: http://localhost:5002"
echo "  - Server 3: http://localhost:5003"
echo
echo "Press Ctrl+C to stop all servers"

# Wait for background processes
wait


