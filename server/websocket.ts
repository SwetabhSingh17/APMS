import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import type { Notification } from "@shared/schema";
import { log } from "./vite";

// Map to store connected clients by user ID
const clients = new Map<number, Set<WebSocket>>();

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws, req) => {
    // Basic URL parsing to extract userId from query params e.g. /ws?userId=123
    const url = new URL(req.url || "", `http://${req.headers.host || "localhost"}`);
    const userIdStr = url.searchParams.get("userId");
    
    if (!userIdStr) {
      ws.close(1008, "User ID required");
      return;
    }

    const userId = parseInt(userIdStr, 10);
    if (isNaN(userId)) {
      ws.close(1008, "Invalid User ID");
      return;
    }

    log(`WebSocket connected for user ${userId}`);

    if (!clients.has(userId)) {
      clients.set(userId, new Set());
    }
    clients.get(userId)!.add(ws);

    ws.on("close", () => {
      const userClients = clients.get(userId);
      if (userClients) {
        userClients.delete(ws);
        if (userClients.size === 0) {
          clients.delete(userId);
        }
      }
    });
  });

  return wss;
}

/**
 * Broadcasts a notification exclusively to a specific user's active WebSocket connections.
 */
export function notifyUser(userId: number, notification: Notification) {
  const userClients = clients.get(userId);
  if (userClients) {
    const message = JSON.stringify({
      type: "NOTIFICATION",
      data: notification
    });
    userClients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }
}
