import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type BotInfo, type GuildSummary } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Server, Clock, Cpu, Zap, ChevronRight, Plus } from 'lucide-react';

const BOT_INVITE_URL = 'https://web.fluxer.app/oauth2/authorize?client_id=1474069931333816428&scope=bot&permissions=4504699474930806';

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [info, setInfo] = useState<BotInfo | null>(null);
  const [guilds, setGuilds] = useState<GuildSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const promises: Promise<void>[] = [];

    promises.push(
      api.get<GuildSummary[]>('/guilds')
        .then(setGuilds)
        .catch(() => { })
    );

    if (user?.isOwner) {
      promises.push(
        api.get<BotInfo>('/bot/info')
          .then(setInfo)
          .catch(err => setError(err.message))
      );
    }

    Promise.all(promises).finally(() => setLoading(false));
  }, [user?.isOwner]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (error && user?.isOwner) {
    return <div className="text-red-400">Failed to load bot info: {error}</div>;
  }

  if (user?.isOwner && info) {
    const cards = [
      { label: 'Servers', value: info.guilds.toLocaleString(), icon: Server, color: 'text-blue-400' },
      { label: 'Uptime', value: formatUptime(info.uptime), icon: Clock, color: 'text-green-400' },
      { label: 'Memory', value: `${info.memoryMB} MB`, icon: Cpu, color: 'text-purple-400' },
      { label: 'Status', value: info.readyAt ? 'Online' : 'Offline', icon: Zap, color: info.readyAt ? 'text-green-400' : 'text-red-400' },
    ];

    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Welcome back, {user?.username}</h1>
          <p className="text-gray-400 mt-1">Here's an overview of your bot.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map(card => (
            <div key={card.label} className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-400">{card.label}</p>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
              <p className="text-2xl font-bold text-white mt-2">{card.value}</p>
            </div>
          ))}
        </div>

        {info.username && (
          <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Bot Info</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-400">Username:</span> <span className="text-white">{info.username}</span></div>
              <div><span className="text-gray-400">ID:</span> <span className="text-white font-mono">{info.id}</span></div>
              <div><span className="text-gray-400">Ready at:</span> <span className="text-white">{info.readyAt ? new Date(info.readyAt).toLocaleString() : 'N/A'}</span></div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const botGuilds = guilds.filter(g => g.botPresent !== false);
  const nonBotGuilds = guilds.filter(g => g.botPresent === false);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Welcome back, {user?.username}</h1>
        <p className="text-gray-400 mt-1">Select a server to manage.</p>
      </div>

      {guilds.length === 0 ? (
        <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-8 text-center">
          <Server className="h-12 w-12 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400">You don't have any servers to manage yet.</p>
        </div>
      ) : (
        <>
          {/* Bot-present guilds - manage */}
          {botGuilds.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {botGuilds.map(guild => (
                <button
                  key={guild.id}
                  onClick={() => navigate(`/guilds/${guild.id}`)}
                  className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-5 text-left hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/5 active:scale-[0.98] transition-all duration-150 group"
                >
                  <div className="flex items-center gap-4">
                    {guild.icon ? (
                      <img
                        src={`https://fluxerusercontent.com/icons/${guild.id}/${guild.icon}.png?size=64`}
                        alt={guild.name}
                        className="h-12 w-12 rounded-full"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-[hsl(var(--border))] flex items-center justify-center">
                        <span className="text-white font-semibold text-lg">
                          {guild.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold truncate">{guild.name}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-500 group-hover:text-blue-400 transition-colors" />
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Non-bot guilds - invite */}
          {nonBotGuilds.length > 0 && (
            <>
              {botGuilds.length > 0 && (
                <div className="flex items-center gap-3 pt-2">
                  <div className="h-px flex-1 bg-[hsl(var(--border))]" />
                  <span className="text-xs text-gray-500 uppercase tracking-wider">Add Fluxy to your servers</span>
                  <div className="h-px flex-1 bg-[hsl(var(--border))]" />
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {nonBotGuilds.map(guild => (
                  <a
                    key={guild.id}
                    href={`${BOT_INVITE_URL}&guild_id=${guild.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-5 opacity-60 hover:opacity-90 hover:border-green-500/50 hover:shadow-lg hover:shadow-green-500/5 active:scale-[0.98] transition-all duration-150 group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-gray-700/30 flex items-center justify-center text-gray-500 text-lg font-bold shrink-0">
                        {guild.icon ? (
                          <img
                            src={`https://fluxerusercontent.com/icons/${guild.id}/${guild.icon}.png?size=64`}
                            alt={guild.name}
                            className="h-12 w-12 rounded-full object-cover grayscale"
                          />
                        ) : (
                          guild.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-400 font-semibold truncate group-hover:text-green-400 transition-colors">
                          {guild.name}
                        </p>
                        <p className="text-xs text-gray-600 mt-0.5">Bot not added</p>
                      </div>
                      <Plus className="h-5 w-5 text-gray-600 group-hover:text-green-400 transition-colors" />
                    </div>
                  </a>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
