#!/bin/bash

# Get the local IP address
IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -n 1)

echo "========================================="
echo "Starting Project Hub Server for Network"
echo "========================================="
echo ""
echo "Local IP Address: $IP"
echo ""
echo "Access URLs:"
echo "  - On this Mac: http://localhost:3000"
echo "  - From other devices: http://$IP:3000"
echo ""
echo "========================================="
echo ""

# Set environment and start server
export NODE_ENV=development
npm run dev
