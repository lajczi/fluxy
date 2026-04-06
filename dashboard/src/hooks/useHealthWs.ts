import { useEffect, useRef, useState, useCallback } from 'react';

export interface HealthMetrics {
  timestamp: number;
  uptime: number;
  online: boolean;
  wsPing: number | null;
  cpu: number;
  memoryMB: number;
  memoryTotalMB: number;
  rssMB: number;
  hostUsedMemoryMB: number;
  hostTotalMemoryMB: number;
  loadAvg: number[];
}

interface UseHealthWsReturn {
  metrics: HealthMetrics | null;
  connected: boolean;
  history: HealthMetrics[];
}

const MAX_HISTORY = 60;
const POLL_INTERVAL_MS = 5000;
const MAX_WS_FAILURES = 3;

export function useHealthWs(): UseHealthWsReturn {
  const [metrics, setMetrics] = useState<HealthMetrics | null>(null);
  const [connected, setConnected] = useState(false);
  const [history, setHistory] = useState<HealthMetrics[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const attemptsRef = useRef(0);
  const failuresRef = useRef(0);
  const usingPollingRef = useRef(false);

  const pushMetrics = useCallback((data: HealthMetrics) => {
    setMetrics(data);
    setHistory((prev) => {
      const next = [...prev, data];
      return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
    });
  }, []);

  const startPolling = useCallback(() => {
    if (pollTimer.current) return;
    usingPollingRef.current = true;
    setConnected(true);

    const poll = async () => {
      try {
        const token = localStorage.getItem('fluxy_token');
        const res = await fetch('/api/health/metrics', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data: HealthMetrics = await res.json();
          pushMetrics(data);
        }
      } catch {}
    };

    poll();
    pollTimer.current = setInterval(poll, POLL_INTERVAL_MS);
  }, [pushMetrics]);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
    usingPollingRef.current = false;
  }, []);

  const connect = useCallback(() => {
    if (usingPollingRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const token = localStorage.getItem('fluxy_token');
    const url = `${protocol}//${window.location.host}/ws/health${token ? `?token=${encodeURIComponent(token)}` : ''}`;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        attemptsRef.current = 0;
        failuresRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const data: HealthMetrics = JSON.parse(event.data);
          pushMetrics(data);
        } catch {}
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        failuresRef.current++;

        if (failuresRef.current >= MAX_WS_FAILURES) {
          console.info('[Health] WebSocket unavailable, switching to HTTP polling');
          startPolling();
          return;
        }

        const delay = Math.min(1000 * 2 ** attemptsRef.current, 30000);
        attemptsRef.current++;
        reconnectTimer.current = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      failuresRef.current++;
      if (failuresRef.current >= MAX_WS_FAILURES) {
        startPolling();
      }
    }
  }, [pushMetrics, startPolling]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      stopPolling();
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [connect, stopPolling]);

  return { metrics, connected, history };
}
