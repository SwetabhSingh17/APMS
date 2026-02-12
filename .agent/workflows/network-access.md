---
description: Start server for network access from other devices
---

# Network Access Workflow

This workflow starts the server so it can be accessed from other devices on the same WiFi network.

## Steps

// turbo-all

1. **Find your Mac's IP address:**
   ```bash
   ifconfig | grep "inet " | grep -v 127.0.0.1
   ```
   Look for the IP that starts with 10.x.x.x or 192.168.x.x

2. **Start the server using the convenience script:**
   ```bash
   ./start-network.sh
   ```
   
   OR manually:
   ```bash
   npm run dev
   ```

3. **Access from other devices:**
   - Open a browser on any device connected to the same WiFi
   - Navigate to: `http://[YOUR_IP]:3000`
   - Example: `http://10.42.46.84:3000`

## Troubleshooting

- **Firewall blocking**: Allow Node.js in System Settings → Network → Firewall
- **IP changed**: Re-run step 1 to get the new IP address
- **Still blank**: Try the production build (see production-network.md)
