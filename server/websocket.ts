import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import type { IncomingMessage } from "http";
import type { Notification } from "@shared/schema";
import { log } from "./vite";
import type { DBStorage } from "./db-storage";
import crypto from "crypto";

// Map to store connected clients by user ID
const clients = new Map<number, Set<WebSocket>>();

/**
 * Un-signs an express-session cookie value (`s:<sid>.<hmac>`) using the same
 * algorithm as the `cookie-signature` package used by express-session.
 * Returns the raw session id, or null when the signature is invalid.
 */
function unsignSessionId(signed: string, secret: string): string | null {
  const dot = signed.lastIndexOf(".");
  if (dot <= 2 || !signed.startsWith("s:")) return null;

  const sid = signed.slice(2, dot);
  const receivedSig = signed.slice(dot + 1);
  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(sid)
    .digest("base64")
    .replace(/=+$/, "");

  const a = Buffer.from(expectedSig);
  const b = Buffer.from(receivedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }
  return sid;
}

function extractSessionCookie(req: IncomingMessage): string | null {
  const header = req.headers.cookie;
  if (!header) return null;

  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === "connect.sid") {
      try {
        return decodeURIComponent(rest.join("="));
      } catch {
        return rest.join("=");
      }
    }
  }
  return null;
}

/**
 * Resolves the authenticated userId for an incoming WebSocket handshake by
 * validating the express-session cookie against the session store.
 *
 * SECURITY: the userId is derived server-side from the signed session cookie.
 * The client-supplied ?userId= query parameter is ignored entirely — it could
 * otherwise be spoofed to subscribe to another user's notifications.
 */
function resolveUserIdFromSession(req: IncomingMessage, storage: DBStorage): Promise<number | null> {
  return new Promise((resolve) => {
    const signed = extractSessionCookie(req);
    if (!signed) return resolve(null);

    const secret = process.env.SESSION_SECRET || "integral-university-project-portal-secret";
    const sid = unsignSessionId(signed, secret);
    if (!sid) return resolve(null);

    storage.sessionStore.get(sid, (err, session) => {
      if (err || !session) return resolve(null);
      const userId = (session as any)?.passport?.user;
      resolve(typeof userId === "number" ? userId : null);
    });
  });
}

export function setupWebSocket(server: Server, storage: DBStorage) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", async (ws, req) => {
    const userId = await resolveUserIdFromSession(req, storage);

    if (userId === null) {
      ws.close(1008, "Unauthorized");
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

/**
 * Force-closes every live socket and clears the registry. Used after a database
 * reset: user IDs restart from 1, so stale pre-reset connections must never
 * receive notifications addressed to recycled user IDs. Clients auto-reconnect
 * (or are redirected to login by their stale session).
 */
export function disconnectAllClients() {
  clients.forEach((sockets, userId) => {
    sockets.forEach((ws) => {
      try {
        ws.close(1012, "Service Restart");
      } catch {
        // Socket may already be closing
      }
    });
  });
  clients.clear();
}
