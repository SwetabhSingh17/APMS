import { useEffect, useRef } from "react";
import { useAuth } from "./use-auth";
import { useToast } from "./use-toast";
import { queryClient } from "@/lib/queryClient";

export function useNotifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!user) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    const connectWebSocket = () => {
      // Connect to the WebSocket endpoint on the same host
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws?userId=${user.id}`;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "NOTIFICATION") {
            // Trigger toast (notification blob)
            toast({
              title: data.data.title,
              description: data.data.message,
            });

            // Invalidate the notifications cache so the notification section updates instantly
            queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
          }
        } catch (error) {
          console.error("Failed to parse websocket message:", error);
        }
      };

      ws.onclose = () => {
        // Simple reconnect logic
        setTimeout(() => {
          if (user && wsRef.current === ws) {
            connectWebSocket();
          }
        }, 3000);
      };
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [user, toast]);
}
