import { useEffect, useState, useCallback } from 'react';
import { api, type ProcessInfo, type LogEntry, type LogsResponse } from '../lib/api';
import { useHealthWs } from '../hooks/useHealthWs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import {
  Activity, Cpu, Clock, RefreshCw, Wifi,
  Server, MemoryStick, Radio,
} from 'lucide-react';

interface HostInfo {
  platform: string;
  arch: string;
  hostname: string;
  cpuModel: string;
  cpuCores: number;
  totalMemoryMB: number;
  freeMemoryMB: number;
  usedMemoryMB: number;
  loadAvg: number[];
  uptimeSeconds: number;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

function GaugeRing({ value, max, label, unit, color }: {
  value: number; max: number; label: string; unit: string; color: string;
}) {
  const pct = Math.min((value / max) * 100, 100);
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="hsl(217.2, 32.6%, 17.5%)" strokeWidth="8" />
          <circle cx="50" cy="50" r={radius} fill="none" stroke={color} strokeWidth="8"
            strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
            className="transition-all duration-500" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold text-white">{Math.round(pct)}%</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-gray-400">{value.toFixed(1)} {unit}</p>
      </div>
    </div>
  );
}

function Sparkline({ data, color, height = 32 }: { data: number[]; color: string; height?: number }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const w = 200;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = height - (v / max) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

export function Health() {
  const { metrics: live, connected: wsConnected, history } = useHealthWs();

  const [restProcess, setRestProcess] = useState<ProcessInfo | null>(null);
  const [host, setHost] = useState<HostInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [logFilter, setLogFilter] = useState<string>('all');

  const fetchStatic = useCallback(async () => {
    try {
      const [p, ho] = await Promise.all([
        api.get<ProcessInfo>('/health/process'),
        api.get<HostInfo>('/health/host'),
      ]);
      setRestProcess(p);
      setHost(ho);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const data = await api.get<LogsResponse>('/health/logs?limit=100');
      setLogEntries(data.entries);
    } catch {}
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchStatic(), fetchLogs()]).finally(() => setLoading(false));
  }, [fetchStatic, fetchLogs]);

  useEffect(() => {
    const interval = setInterval(fetchLogs, 10_000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchStatic(), fetchLogs()]);
    setRefreshing(false);
  };

  const filteredLogs = logFilter === 'all'
    ? logEntries
    : logEntries.filter(e => e.level === logFilter);

  const uptime = live?.uptime ?? restProcess?.uptime ?? 0;
  const online = live?.online ?? !!restProcess;
  const wsPing = live?.wsPing ?? null;
  const cpu = live?.cpu ?? restProcess?.cpu ?? 0;
  const memoryMB = live?.memoryMB ?? restProcess?.memoryMB ?? 0;
  const memoryTotalMB = live?.memoryTotalMB ?? restProcess?.memoryTotalMB ?? 0;
  const rssMB = live?.rssMB ?? restProcess?.rssMB ?? 0;
  const hostUsedMB = live?.hostUsedMemoryMB ?? host?.usedMemoryMB ?? 0;
  const hostTotalMB = live?.hostTotalMemoryMB ?? host?.totalMemoryMB ?? 0;

  const cpuHistory = history.map(h => h.cpu);
  const memHistory = history.map(h => h.memoryMB);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (error) {
    return <div className="text-red-400">Failed to load health data: {error}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">System Health</h1>
          <p className="text-gray-400 mt-1">Real-time monitoring of bot and host resources.</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className={wsConnected ? 'border-emerald-500 text-emerald-400' : 'border-yellow-500 text-yellow-400'}>
            <Radio className={`h-3 w-3 mr-1.5 ${wsConnected ? 'text-emerald-400' : 'text-yellow-400'}`} />
            {wsConnected ? 'Live' : 'Polling'}
          </Badge>
          <Badge variant={online ? 'default' : 'destructive'} className={online ? 'bg-green-600' : ''}>
            {online ? 'Online' : 'Offline'}
          </Badge>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">Uptime</p>
              <Clock className="h-5 w-5 text-green-400" />
            </div>
            <p className="text-xl font-bold text-white mt-2">{formatUptime(uptime)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">WS Latency</p>
              <Wifi className="h-5 w-5 text-blue-400" />
            </div>
            <p className="text-xl font-bold text-white mt-2">
              {wsPing != null ? `${wsPing}ms` : 'N/A'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">Process CPU</p>
              <Cpu className="h-5 w-5 text-purple-400" />
            </div>
            <p className="text-xl font-bold text-white mt-2">{cpu.toFixed(1)}%</p>
            {cpuHistory.length > 1 && (
              <div className="mt-2">
                <Sparkline data={cpuHistory} color="#8b5cf6" />
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">Heap Memory</p>
              <MemoryStick className="h-5 w-5 text-orange-400" />
            </div>
            <p className="text-xl font-bold text-white mt-2">
              {memoryMB.toFixed(0)} / {memoryTotalMB.toFixed(0)} MB
            </p>
            {memHistory.length > 1 && (
              <div className="mt-2">
                <Sparkline data={memHistory} color="#3b82f6" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gauges */}
      <Card>
        <CardHeader>
          <CardTitle>Resource Usage</CardTitle>
          <CardDescription>Process and system resource gauges</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap justify-center gap-8 py-4">
            <GaugeRing
              value={cpu}
              max={100}
              label="Process CPU"
              unit="%"
              color="#8b5cf6"
            />
            <GaugeRing
              value={memoryMB}
              max={memoryTotalMB || 512}
              label="Heap Used"
              unit="MB"
              color="#3b82f6"
            />
            <GaugeRing
              value={rssMB}
              max={hostTotalMB || 1024}
              label="RSS"
              unit="MB"
              color="#f59e0b"
            />
            {hostTotalMB > 0 && (
              <GaugeRing
                value={hostUsedMB}
                max={hostTotalMB}
                label="Host Memory"
                unit="MB"
                color="#ef4444"
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Process + Host info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" /> Process Info</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              {[
                ['PID', restProcess?.pid],
                ['Node.js', restProcess?.nodeVersion],
                ['CPU', `${cpu.toFixed(1)}%`],
                ['Heap Used', `${memoryMB.toFixed(1)} MB`],
                ['Heap Total', `${memoryTotalMB.toFixed(1)} MB`],
                ['RSS', `${rssMB.toFixed(1)} MB`],
                ['Process Uptime', formatUptime(uptime)],
              ].map(([label, value]) => (
                <div key={label as string} className="flex justify-between">
                  <span className="text-gray-400">{label}</span>
                  <span className="text-white font-mono">{value ?? 'N/A'}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Server className="h-5 w-5" /> Host Info</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              {host ? [
                ['Hostname', host.hostname],
                ['Platform', `${host.platform} (${host.arch})`],
                ['CPU', `${host.cpuModel}`],
                ['CPU Cores', host.cpuCores],
                ['Total Memory', `${(host.totalMemoryMB / 1024).toFixed(1)} GB`],
                ['Free Memory', `${(host.freeMemoryMB / 1024).toFixed(1)} GB`],
                ['Load Average', (live?.loadAvg ?? host.loadAvg).map(l => l.toFixed(2)).join(', ')],
                ['Host Uptime', formatUptime(host.uptimeSeconds)],
              ].map(([label, value]) => (
                <div key={label as string} className="flex justify-between">
                  <span className="text-gray-400">{label}</span>
                  <span className="text-white font-mono text-right max-w-[60%] truncate">{String(value)}</span>
                </div>
              )) : (
                <p className="text-gray-400">Host info unavailable</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Logs */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle>Recent Logs</CardTitle>
              <CardDescription>Last {filteredLogs.length} log entries (auto-refreshes every 10s)</CardDescription>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {['all', 'error', 'warn', 'info', 'ok', 'debug'].map(level => (
                <button
                  key={level}
                  onClick={() => setLogFilter(level)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    logFilter === level
                      ? level === 'error' ? 'bg-red-500/20 text-red-400 ring-1 ring-red-500/40'
                      : level === 'warn' ? 'bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/40'
                      : level === 'ok' ? 'bg-green-500/20 text-green-400 ring-1 ring-green-500/40'
                      : level === 'debug' ? 'bg-gray-500/20 text-gray-400 ring-1 ring-gray-500/40'
                      : level === 'info' ? 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/40'
                      : 'bg-white/10 text-white ring-1 ring-white/20'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  {level === 'all' ? 'All' : level.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredLogs.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No log entries yet.</p>
          ) : (
            <div className="max-h-[400px] overflow-y-auto space-y-0.5 font-mono text-xs">
              {[...filteredLogs].reverse().map((entry, i) => {
                const time = new Date(entry.timestamp);
                const hh = String(time.getHours()).padStart(2, '0');
                const mm = String(time.getMinutes()).padStart(2, '0');
                const ss = String(time.getSeconds()).padStart(2, '0');
                const levelColor =
                  entry.level === 'error' || entry.level === 'fatal' ? 'text-red-400'
                  : entry.level === 'warn' ? 'text-yellow-400'
                  : entry.level === 'ok' ? 'text-green-400'
                  : entry.level === 'debug' ? 'text-gray-500'
                  : 'text-blue-400';
                return (
                  <div key={i} className="flex gap-2 py-1 px-2 rounded hover:bg-white/5">
                    <span className="text-gray-500 shrink-0">{hh}:{mm}:{ss}</span>
                    <span className={`shrink-0 w-8 ${levelColor}`}>
                      {entry.level === 'fatal' ? 'FTL' : entry.level.toUpperCase().slice(0, 3)}
                    </span>
                    <span className="text-blue-400 shrink-0">[{entry.tag}]</span>
                    <span className="text-gray-300 break-all">{entry.message}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
