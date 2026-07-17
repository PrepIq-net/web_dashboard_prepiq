"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getWsInfo, getWsTicket } from "./service";
import type { HubSocketEvent } from "./types";

const PING_INTERVAL_MS = 25_000;
const MAX_BACKOFF_MS = 30_000;

export type HubSocketStatus = "connecting" | "open" | "closed";

/**
 * One WebSocket per Operations Hub screen.
 *
 * Auth: exchanges the cookie session for a one-time ticket (REST, through
 * the proxy) and dials the backend directly. Reconnects with capped
 * exponential backoff, re-minting a ticket each attempt. Subscriptions are
 * replayed after every reconnect so an open thread keeps streaming.
 */
export function useHubSocket(onEvent: (event: HubSocketEvent) => void) {
  const [status, setStatus] = useState<HubSocketStatus>("connecting");
  const [mediaOrigin, setMediaOrigin] = useState<string>("");

  const socketRef = useRef<WebSocket | null>(null);
  const subscriptionsRef = useRef<Set<string>>(new Set());
  const onEventRef = useRef(onEvent);
  const attemptRef = useRef(0);
  const disposedRef = useRef(false);

  onEventRef.current = onEvent;

  const send = useCallback((frame: Record<string, unknown>) => {
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(frame));
    }
  }, []);

  useEffect(() => {
    disposedRef.current = false;
    let pingTimer: ReturnType<typeof setInterval> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    async function connect() {
      if (disposedRef.current) return;
      setStatus("connecting");
      try {
        const [info, ticket] = await Promise.all([getWsInfo(), getWsTicket()]);
        if (disposedRef.current) return;
        setMediaOrigin(info.media_origin);

        const socket = new WebSocket(
          `${info.ws_url}?ticket=${encodeURIComponent(ticket)}`,
        );
        socketRef.current = socket;

        socket.onopen = () => {
          attemptRef.current = 0;
          setStatus("open");
          for (const conversationId of subscriptionsRef.current) {
            socket.send(
              JSON.stringify({ type: "subscribe", conversation_id: conversationId }),
            );
          }
          pingTimer = setInterval(() => {
            if (socket.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify({ type: "ping" }));
            }
          }, PING_INTERVAL_MS);
        };

        socket.onmessage = (raw) => {
          try {
            onEventRef.current(JSON.parse(raw.data) as HubSocketEvent);
          } catch {
            // Malformed frame; ignore.
          }
        };

        socket.onclose = () => {
          if (pingTimer) clearInterval(pingTimer);
          pingTimer = null;
          socketRef.current = null;
          if (disposedRef.current) return;
          setStatus("closed");
          const backoff = Math.min(
            1000 * 2 ** attemptRef.current,
            MAX_BACKOFF_MS,
          );
          attemptRef.current += 1;
          reconnectTimer = setTimeout(connect, backoff);
        };

        socket.onerror = () => {
          socket.close();
        };
      } catch {
        if (disposedRef.current) return;
        setStatus("closed");
        const backoff = Math.min(1000 * 2 ** attemptRef.current, MAX_BACKOFF_MS);
        attemptRef.current += 1;
        reconnectTimer = setTimeout(connect, backoff);
      }
    }

    connect();

    return () => {
      disposedRef.current = true;
      if (pingTimer) clearInterval(pingTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, []);

  const subscribe = useCallback(
    (conversationId: string) => {
      subscriptionsRef.current.add(conversationId);
      send({ type: "subscribe", conversation_id: conversationId });
    },
    [send],
  );

  const unsubscribe = useCallback(
    (conversationId: string) => {
      subscriptionsRef.current.delete(conversationId);
      send({ type: "unsubscribe", conversation_id: conversationId });
    },
    [send],
  );

  const sendTyping = useCallback(
    (conversationId: string, isTyping: boolean) => {
      send({ type: "typing", conversation_id: conversationId, is_typing: isTyping });
    },
    [send],
  );

  const sendRead = useCallback(
    (conversationId: string) => {
      send({ type: "read", conversation_id: conversationId });
    },
    [send],
  );

  return { status, mediaOrigin, subscribe, unsubscribe, sendTyping, sendRead };
}
