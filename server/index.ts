/**
 * Server Entry Point — Integral Project Hub
 *
 * Bootstraps the Express application with:
 *  1. JSON/URL-encoded body parsing
 *  2. Request logging middleware (API routes only)
 *  3. Passport.js session authentication
 *  4. REST API route registration
 *  5. Vite dev server (development) or static file serving (production)
 *  6. Database migration runner on startup
 *
 * Listens on all network interfaces (0.0.0.0) for LAN dev access.
 */
import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { runMigrations, db } from "./db";
import { DBStorage } from "./db-storage";
import passport from "passport";
import { createServer } from "http";
import { setupAuth } from "./auth";

// Initialize express app
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += `\nResponse: ${JSON.stringify(capturedJsonResponse, null, 2)}`;
      }
      log(logLine);
    }
  });

  next();
});

// Create storage instance
const storage = new DBStorage();

// Setup authentication
setupAuth(app, storage);

// Register routes
registerRoutes(app, storage);

// Start server
const port = process.env.PORT || 3000;

async function startServer() {
  try {
    // Run migrations
    await runMigrations();

    // Create HTTP server
    const server = createServer(app);

    // Setup Vite in development
    if (process.env.NODE_ENV === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Start listening
    server.listen(Number(port), '0.0.0.0', async () => {
      log(`Server running on http://0.0.0.0:${port}`);
      log(`Local: http://localhost:${port}`);

      // Get network IP dynamically
      const { networkInterfaces } = await import('os');
      const nets = networkInterfaces();
      const networkIP = Object.values(nets)
        .flat()
        .find(net => net?.family === 'IPv4' && !net.internal)?.address;

      if (networkIP) {
        log(`Network: http://${networkIP}:${port}`);
      }
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
