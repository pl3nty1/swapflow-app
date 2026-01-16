import { createContext, useContext, useEffect, useRef, useCallback, useState } from "react";
import { useAuth } from "@/App";

const WebSocketContext = createContext(null);

/**
 * Shared WebSocket context provider
 * Manages a single WebSocket connection that can handle multiple channels
 */
export const WebSocketProvider = ({ children }) => {
  const { user, API } = useAuth();
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const isConnectingRef = useRef(false);
  const subscribersRef = useRef(new Map()); // Map of channel -> Set of callbacks
  const [connected, setConnected] = useState(false);
  const maxReconnectAttempts = 10;
  const reconnectDelay = 3000;

  // Subscribe to channels
  const subscribe = useCallback((channels, callback) => {
    const channelSet = Array.isArray(channels) ? new Set(channels) : new Set([channels]);
    
    channelSet.forEach((channel) => {
      if (!subscribersRef.current.has(channel)) {
        subscribersRef.current.set(channel, new Set());
      }
      subscribersRef.current.get(channel).add(callback);
    });

    // Return unsubscribe function
    return () => {
      channelSet.forEach((channel) => {
        const callbacks = subscribersRef.current.get(channel);
        if (callbacks) {
          callbacks.delete(callback);
          if (callbacks.size === 0) {
            subscribersRef.current.delete(channel);
          }
        }
      });
    };
  }, []);

  // Get all channels that have subscribers
  const getSubscribedChannels = useCallback(() => {
    return Array.from(subscribersRef.current.keys());
  }, []);

  // Connect WebSocket
  const connect = useCallback(() => {
    if (!user || isConnectingRef.current || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const token = localStorage.getItem("session_token");
    if (!token) return;

    try {
      isConnectingRef.current = true;
      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsHost = API.replace(/^https?:\/\//, "").replace(/^http:\/\//, "");
      
      // Always connect with all channels to avoid reconnections
      // The backend will filter messages based on what we're subscribed to
      const channelsParam = "messages,notifications,trades";
      const wsUrl = `${wsProtocol}//${wsHost}/ws?token=${token}&channels=${channelsParam}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log(`WebSocket connected for channels: ${channelsParam}`);
        reconnectAttempts.current = 0;
        isConnectingRef.current = false;
        setConnected(true);
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

          // Notify all subscribers for this channel
          if (channel && type) {
            const callbacks = subscribersRef.current.get(channel);
            if (callbacks) {
              callbacks.forEach((callback) => {
                try {
                  callback(channel, type, data);
                } catch (error) {
                  console.error("Error in WebSocket callback:", error);
                }
              });
            }
          }
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        isConnectingRef.current = false;
        setConnected(false);
      };

      ws.onclose = () => {
        console.log("WebSocket disconnected");
        isConnectingRef.current = false;
        setConnected(false);
        wsRef.current = null;

        // Attempt to reconnect if we haven't exceeded max attempts
        if (reconnectAttempts.current < maxReconnectAttempts && user) {
          reconnectAttempts.current++;
          const delay = reconnectDelay * Math.min(reconnectAttempts.current, 5);
          console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})...`);

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else if (reconnectAttempts.current >= maxReconnectAttempts) {
          console.error("Max reconnection attempts reached. Please refresh the page.");
        }
      };
    } catch (error) {
      console.error("Failed to create WebSocket connection:", error);
      isConnectingRef.current = false;
      setConnected(false);
    }
  }, [user, API]);

  // Disconnect WebSocket
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
    setConnected(false);
  }, []);

  // Send message via WebSocket
  const sendMessage = useCallback((channel, type, data) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(
          JSON.stringify({
            channel,
            type,
            data,
          })
        );
        return true;
      } catch (error) {
        console.error("Failed to send WebSocket message:", error);
        return false;
      }
    }
    return false;
  }, []);

  // Connect when user is available
  useEffect(() => {
    if (user) {
      // Connect immediately - we connect with all channels anyway
      connect();
    } else {
      disconnect();
    }
  }, [user, connect, disconnect]);

  // No need to reconnect when channels change - we connect with all channels

  return (
    <WebSocketContext.Provider
      value={{
        connected,
        subscribe,
        sendMessage,
        disconnect,
        reconnect: connect,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};

/**
 * Hook to use the WebSocket context
 */
export const useWebSocketContext = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useWebSocketContext must be used within WebSocketProvider");
  }
  return context;
};
