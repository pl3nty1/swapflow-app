import { useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/App";

/**
 * Unified WebSocket hook for real-time communication
 * @param {string[]} channels - Channels to subscribe to: "messages", "notifications", "trades"
 * @param {function} onMessage - Callback function when a message is received: (channel, type, data) => void
 * @param {object} options - Additional options
 */
export const useWebSocket = (channels = ["messages", "notifications", "trades"], onMessage, options = {}) => {
  const { user, API } = useAuth();
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = options.maxReconnectAttempts || 10;
  const reconnectDelay = options.reconnectDelay || 3000;
  const isConnectingRef = useRef(false);

  const connect = useCallback(() => {
    if (!user || isConnectingRef.current) return;
    
    const token = localStorage.getItem("session_token");
    if (!token) return;

    try {
      isConnectingRef.current = true;
      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsHost = API.replace(/^https?:\/\//, "").replace(/^http:\/\//, "");
      const channelsParam = channels.join(",");
      const wsUrl = `${wsProtocol}//${wsHost}/ws?token=${token}&channels=${channelsParam}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log(`WebSocket connected for channels: ${channels.join(", ")}`);
        reconnectAttempts.current = 0;
        isConnectingRef.current = false;
        if (options.onConnect) {
          options.onConnect();
        }
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          const { channel, type, data } = message;
          
          // Handle system messages
          if (channel === "system" && type === "connected") {
            console.log("WebSocket connection confirmed:", data);
            return;
          }
          
          // Call the onMessage callback
          if (onMessage && channel && type) {
            onMessage(channel, type, data);
          }
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        isConnectingRef.current = false;
      };

      ws.onclose = () => {
        console.log("WebSocket disconnected");
        isConnectingRef.current = false;
        wsRef.current = null;
        
        // Attempt to reconnect if we haven't exceeded max attempts
        if (reconnectAttempts.current < maxReconnectAttempts && user) {
          reconnectAttempts.current++;
          const delay = reconnectDelay * Math.min(reconnectAttempts.current, 5); // Exponential backoff, max 5x
          console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})...`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else if (reconnectAttempts.current >= maxReconnectAttempts) {
          console.error("Max reconnection attempts reached. Please refresh the page.");
          if (options.onMaxReconnectAttempts) {
            options.onMaxReconnectAttempts();
          }
        }
      };
    } catch (error) {
      console.error("Failed to create WebSocket connection:", error);
      isConnectingRef.current = false;
    }
  }, [user, API, channels, onMessage, maxReconnectAttempts, reconnectDelay, options]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    reconnectAttempts.current = 0;
    isConnectingRef.current = false;
  }, []);

  const sendMessage = useCallback((channel, type, data) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({
          channel,
          type,
          data
        }));
        return true;
      } catch (error) {
        console.error("Failed to send WebSocket message:", error);
        return false;
      }
    }
    return false;
  }, []);

  useEffect(() => {
    if (user) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [user, connect, disconnect]);

  return {
    connected: wsRef.current?.readyState === WebSocket.OPEN,
    sendMessage,
    disconnect,
    reconnect: connect
  };
};
