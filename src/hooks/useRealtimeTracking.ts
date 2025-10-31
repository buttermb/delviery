import { useState, useEffect, useRef } from "react";

interface TrackingUpdate {
  status: string;
  message?: string;
  lat?: number;
  lng?: number;
  created_at: string;
}

export const useRealtimeTracking = (orderId: string | null) => {
  const [updates, setUpdates] = useState<TrackingUpdate[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  useEffect(() => {
    if (!orderId) return;

    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "vltveasdxtfvvqbzxzuf";
    const wsUrl = `wss://${projectId}.supabase.co/functions/v1/realtime-tracking`;

    let ws: WebSocket | null = null;
    let isClosing = false;

    const connect = () => {
      if (isClosing || reconnectAttemptsRef.current >= maxReconnectAttempts) {
        console.log('Max reconnection attempts reached or closing');
        return;
      }

      try {
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;
        
        console.log(`Attempting WebSocket connection (attempt ${reconnectAttemptsRef.current + 1})`);


        ws.onopen = () => {
          console.log("Real-time tracking connected successfully");
          setConnected(true);
          reconnectAttemptsRef.current = 0;
          
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "subscribe-order", orderId }));
          }
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "tracking-update" && data.data) {
              setUpdates((prev) => [...prev, data.data]);
            }
          } catch (error) {
            console.error("Error parsing WebSocket message:", error);
          }
        };

        ws.onerror = (error) => {
          console.error("WebSocket error:", error);
          setConnected(false);
        };

        ws.onclose = (event) => {
          console.log(`WebSocket closed: ${event.code} - ${event.reason}`);
          setConnected(false);
          wsRef.current = null;
          
          if (!isClosing && reconnectAttemptsRef.current < maxReconnectAttempts) {
            reconnectAttemptsRef.current++;
            const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
            console.log(`Reconnecting in ${delay}ms...`);
            
            reconnectTimeoutRef.current = setTimeout(() => {
              connect();
            }, delay);
          }
        };
      } catch (error) {
        console.error("Failed to create WebSocket:", error);
        setConnected(false);
        
        if (!isClosing && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      }
    };

    connect();

    return () => {
      isClosing = true;
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (ws) {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close(1000, "Component unmounting");
        }
      }
      
      wsRef.current = null;
      reconnectAttemptsRef.current = 0;
    };
  }, [orderId]);

  const sendCourierLocation = (courierId: string, lat: number, lng: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "courier-location",
          courierId,
          lat,
          lng,
        })
      );
    }
  };

  return { updates, connected, sendCourierLocation };
};
