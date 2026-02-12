---
description: Run production build for network access (faster, more stable)
---

# Production Network Access Workflow

Use this if the development server has issues with network access. Production build is faster and doesn't require HMR/WebSocket connections.

## Steps

// turbo

1. **Build the production version:**
   ```bash
   npm run build
   ```

// turbo

2. **Start the production server:**
   ```bash
   npm start
   ```

3. **Find your IP address:**
   ```bash
   ifconfig | grep "inet " | grep -v 127.0.0.1
   ```

4. **Access from other devices:**
   - Open browser on remote device
   - Navigate to: `http://[YOUR_IP]:3000`
   - Example: `http://10.42.46.84:3000`

## Advantages

- No WebSocket/HMR issues
- Faster loading
- More stable for network access
- Production-ready code

## Disadvantages

- Must rebuild after code changes
- No hot module replacement
