import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type GuildSummary } from '../lib/api';
import { Server, Settings, Search, Plus } from 'lucide-react';

const BOT_INVITE_URL =
  'https://web.fluxer.app/oauth2/authorize?client_id=1474069931333816428&scope=bot&permissions=4504699474930806';

export function GuildSelector() {
  const [guilds, setGuilds] = useState<GuildSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api
      .get<GuildSummary[]>('/guilds')
      .then(setGuilds)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = guilds.filter((g) => g.name.toLowerCase().includes(search.toLowerCase()));

  const botGuilds = filtered.filter((g) => g.botPresent !== false);
  const nonBotGuilds = filtered.filter((g) => g.botPresent === false);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (error) {
    return <div className="text-red-400">Failed to load guilds: {error}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Your Servers</h1>
          <p className="text-gray-400 mt-1">Select a server to manage its settings.</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search servers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full sm:w-64"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <Server className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">{search ? 'No servers match your search.' : 'No servers found.'}</p>
        </div>
      ) : (
        <>
          {/* Bot-present guilds */}
          {botGuilds.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {botGuilds.map((guild) => (
                <Link
                  key={guild.id}
                  to={`/guilds/${guild.id}`}
                  className="group bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-5 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/5 active:scale-[0.98] transition-all duration-150"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-lg font-bold shrink-0">
                      {guild.icon ? (
                        <img
                          src={`https://fluxerusercontent.com/icons/${guild.id}/${guild.icon}.png?size=64`}
                          alt=""
                          className="h-12 w-12 rounded-full object-cover"
                        />
                      ) : (
                        guild.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-semibold truncate group-hover:text-blue-400 transition-colors">
                        {guild.name}
                      </h3>
                    </div>
                    <Settings className="h-5 w-5 text-gray-600 group-hover:text-blue-400 transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Non-bot guilds (invite section) */}
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
                {nonBotGuilds.map((guild) => (
                  <a
                    key={guild.id}
                    href={`${BOT_INVITE_URL}&guild_id=${guild.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-5 opacity-60 hover:opacity-90 hover:border-green-500/50 hover:shadow-lg hover:shadow-green-500/5 active:scale-[0.98] transition-all duration-150"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-gray-700/30 flex items-center justify-center text-gray-500 text-lg font-bold shrink-0">
                        {guild.icon ? (
                          <img
                            src={`https://fluxerusercontent.com/icons/${guild.id}/${guild.icon}.png?size=64`}
                            alt=""
                            className="h-12 w-12 rounded-full object-cover grayscale"
                          />
                        ) : (
                          guild.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-gray-400 font-semibold truncate group-hover:text-green-400 transition-colors">
                          {guild.name}
                        </h3>
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
