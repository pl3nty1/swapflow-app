import { useEffect, useRef, useCallback } from "react";
import { useWebSocketContext } from "@/contexts/WebSocketContext";

/**
 * Unified WebSocket hook for real-time communication
 * Now uses a shared WebSocket connection managed by WebSocketContext
 * @param {string[]} channels - Channels to subscribe to: "messages", "notifications", "trades"
 * @param {function} onMessage - Callback function when a message is received: (channel, type, data) => void
 * @param {object} options - Additional options
 */
export const useWebSocket = (channels = ["messages", "notifications", "trades"], onMessage, options = {}) => {
  const { connected, subscribe, sendMessage, reconnect } = useWebSocketContext();
  const onMessageRef = useRef(onMessage);
  const optionsRef = useRef(options);

  // Keep refs up to date
  useEffect(() => {
    onMessageRef.current = onMessage;
    optionsRef.current = options;
  }, [onMessage, options]);

  // Subscribe to channels
  useEffect(() => {
    if (!channels || channels.length === 0) return;

    // Create a stable callback that uses refs
    const messageHandler = (channel, type, data) => {
      if (onMessageRef.current) {
        onMessageRef.current(channel, type, data);
      }
    };

    // Subscribe and get unsubscribe function
    const unsubscribe = subscribe(channels, messageHandler);

    // Call onConnect if provided and we're already connected
    if (connected && optionsRef.current.onConnect) {
      optionsRef.current.onConnect();
    }

    // Cleanup: unsubscribe when component unmounts or channels change
    return unsubscribe;
  }, [channels, subscribe, connected]);

  return {
    connected,
    sendMessage,
    reconnect,
  };
};
