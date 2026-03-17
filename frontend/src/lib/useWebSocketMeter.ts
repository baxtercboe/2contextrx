"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { MeterEvent } from "./api";

const WS_URL = "ws://localhost:8000/ws/meter";

export function useWebSocketMeter() {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<MeterEvent[]>([]);
  const [lastEvent, setLastEvent] = useState<MeterEvent | null>(null);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      setConnected(true);
    };

    ws.onmessage = (ev) => {
      try {
        const data: MeterEvent = JSON.parse(ev.data);
        setLastEvent(data);
        if (data.type === "transaction" || data.type === "autonomy_update") {
          setEvents((prev) => [data, ...prev].slice(0, 100));
        }
      } catch {
        // ignore non-JSON
      }
    };

    ws.onclose = () => {
      setConnected(false);
      // Auto-reconnect after 2s
      reconnectTimeout.current = setTimeout(connect, 2000);
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimeout.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((msg: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const executeViaWs = useCallback(
    (toolName: string, consumerId: number, parameters: Record<string, unknown>, sessionId?: string) => {
      send({
        type: "execute_query",
        tool_name: toolName,
        consumer_id: consumerId,
        parameters,
        session_id: sessionId,
      });
    },
    [send]
  );

  return { connected, events, lastEvent, send, executeViaWs };
}
