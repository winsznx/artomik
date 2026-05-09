'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface LogEntry {
  id: number;
  level: string;
  module: string;
  message: string;
  data: string | null;
  created_at: string;
}

export function useSSE() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    const es = new EventSource('/api/stream');
    esRef.current = es;

    es.onopen = () => setConnected(true);

    es.onmessage = (event) => {
      try {
        const entry = JSON.parse(event.data) as LogEntry;
        setLogs(prev => {
          const next = [...prev, entry];
          return next.length > 1000 ? next.slice(-1000) : next;
        });
      } catch {
        // skip malformed
      }
    };

    es.onerror = () => {
      setConnected(false);
      es.close();
      setTimeout(connect, 3000);
    };
  }, []);

  useEffect(() => {
    connect();
    return () => { esRef.current?.close(); };
  }, [connect]);

  return { logs, connected };
}
