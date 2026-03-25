import { useEffect, useState } from 'react';
import { api, type DailyStat, type TopCommand, type TopGuild, type StatsTotals } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { BarChart3, TrendingUp, Server, Terminal } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

export function Stats() {
  const [totals, setTotals] = useState<StatsTotals | null>(null);
  const [daily, setDaily] = useState<DailyStat[]>([]);
  const [topCommands, setTopCommands] = useState<TopCommand[]>([]);
  const [topGuilds, setTopGuilds] = useState<TopGuild[]>([]);
  const [days, setDays] = useState('30');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    Promise.all([
      api.get<StatsTotals>('/stats/totals'),
      api.get<DailyStat[]>(`/stats/commands/daily?days=${days}`),
      api.get<TopCommand[]>('/stats/commands/top?limit=10'),
      api.get<TopGuild[]>('/stats/guilds/top?limit=10'),
    ])
      .then(([t, d, tc, tg]) => {
        setTotals(t);
        setDaily(d);
        setTopCommands(tc);
        setTopGuilds(tg);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [days]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (error) {
    return <div className="text-red-400">Failed to load stats: {error}</div>;
  }

  const summaryCards = [
    { label: 'Total Commands', value: totals?.totalCommands?.toLocaleString() ?? '0', icon: Terminal, color: 'text-blue-400' },
    { label: 'Mod Actions', value: totals?.totalModActions?.toLocaleString() ?? '0', icon: BarChart3, color: 'text-purple-400' },
    { label: 'Top Command', value: topCommands[0]?.command ?? 'N/A', icon: TrendingUp, color: 'text-green-400' },
    { label: 'Top Server', value: topGuilds[0]?.name ?? 'N/A', icon: Server, color: 'text-orange-400' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Statistics</h1>
          <p className="text-gray-400 mt-1">Command usage and bot activity analytics.</p>
        </div>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="14">Last 14 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="60">Last 60 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map(card => (
          <Card key={card.label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-400">{card.label}</p>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
              <p className="text-2xl font-bold text-white mt-2">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Command usage over time */}
      <Card>
        <CardHeader>
          <CardTitle>Command Usage Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          {daily.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No data for this period.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={daily}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217.2, 32.6%, 17.5%)" />
                <XAxis dataKey="date" stroke="#6b7280" fontSize={12}
                  tickFormatter={v => new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} />
                <YAxis stroke="#6b7280" fontSize={12} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(222.2, 84%, 6%)', border: '1px solid hsl(217.2, 32.6%, 17.5%)', borderRadius: '8px', color: '#fff' }}
                  labelFormatter={v => new Date(v).toLocaleDateString()}
                />
                <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2}
                  fillOpacity={1} fill="url(#colorCount)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Top commands + top guilds side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Top 10 Commands</CardTitle>
          </CardHeader>
          <CardContent>
            {topCommands.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topCommands} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(217.2, 32.6%, 17.5%)" />
                  <XAxis type="number" stroke="#6b7280" fontSize={12} />
                  <YAxis type="category" dataKey="command" stroke="#6b7280" fontSize={12} width={80} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(222.2, 84%, 6%)', border: '1px solid hsl(217.2, 32.6%, 17.5%)', borderRadius: '8px', color: '#fff' }}
                  />
                  <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top 10 Servers (by usage)</CardTitle>
          </CardHeader>
          <CardContent>
            {topGuilds.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No data yet.</p>
            ) : (
              <div className="space-y-3">
                {topGuilds.map((g, i) => (
                  <div key={g.guildId} className="flex items-center gap-3">
                    <span className="text-sm font-mono text-gray-500 w-6 text-right">{i + 1}.</span>
                    <div className="flex-1 min-w-0">
                      <div className="h-2 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-500"
                          style={{ width: `${(g.count / (topGuilds[0]?.count || 1)) * 100}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-sm text-gray-300 truncate flex-1" title={g.guildId}>
                      {g.name}
                    </span>
                    <span className="text-sm font-semibold text-white w-12 text-right">{g.count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
