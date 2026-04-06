import { useEffect, useState, useCallback, useRef } from 'react';
import { api, normalizeSettings, type GuildDetail, type GuildSettings } from '../lib/api';
import { createMockGuild, createMockSettings } from '../lib/mockDashboardData';

const MOCK_MODE = import.meta.env.VITE_MOCK_MODE === 'true';

export function useGuildData(guildId: string | undefined) {
  const [guild, setGuild] = useState<GuildDetail | null>(null);
  const [settings, setSettings] = useState<GuildSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const savingRef = useRef(false);

  const fetchSettings = useCallback((id: string) => {
    if (MOCK_MODE) {
      setSettings(prev => normalizeSettings({ ...(prev ?? createMockSettings(id)), guildId: id }));
      return;
    }

    api.get<GuildSettings>(`/guilds/${id}/settings`)
      .then(s => setSettings(normalizeSettings(s)))
      .catch(() => { });
  }, []);

  useEffect(() => {
    if (!guildId) return;

    if (MOCK_MODE) {
      setGuild(createMockGuild(guildId));
      setSettings(createMockSettings(guildId));
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    Promise.all([
      api.get<GuildDetail>(`/guilds/${guildId}`, { skipCache: true }),
      api.get<GuildSettings>(`/guilds/${guildId}/settings`),
    ])
      .then(([g, s]) => {
        setGuild(g);
        setSettings(normalizeSettings(s));
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [guildId]);

  useEffect(() => {
    if (!guildId) return;
    if (MOCK_MODE) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const token = localStorage.getItem('fluxy_token');
    let ws: WebSocket | null = null;

    try {
      const url = `${protocol}//${window.location.host}/ws/settings${token ? `?token=${encodeURIComponent(token)}` : ''}`;
      ws = new WebSocket(url);

      ws.onopen = () => {
        ws?.send(JSON.stringify({ subscribe: guildId }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.event === 'settings_updated' && data.guildId === guildId && !savingRef.current) {
            fetchSettings(guildId);
          }
        } catch { }
      };

      ws.onerror = () => { };
    } catch {
    }

    return () => {
      ws?.close();
    };
  }, [guildId, fetchSettings]);

  const updateSettings = useCallback(
    async (patch: Partial<GuildSettings>) => {
      if (!guildId) return;

      if (MOCK_MODE) {
        setSaving(true);
        savingRef.current = true;
        setSaveError(null);

        setSettings(prev => {
          const base = prev ?? createMockSettings(guildId);
          return normalizeSettings({ ...base, ...patch, guildId });
        });

        setSaving(false);
        setTimeout(() => { savingRef.current = false; }, 200);
        return;
      }

      setSaving(true);
      savingRef.current = true;
      setSaveError(null);
      try {
        const updated = await api.patch<GuildSettings>(`/guilds/${guildId}/settings`, patch);
        setSettings(normalizeSettings(updated));
      } catch (err: any) {
        setSaveError(err.message);
        throw err;
      } finally {
        setSaving(false);
        setTimeout(() => { savingRef.current = false; }, 3000);
      }
    },
    [guildId],
  );

  const refetchSettings = useCallback(() => {
    if (guildId) fetchSettings(guildId);
  }, [guildId, fetchSettings]);

  return { guild, settings, loading, saving, error, saveError, updateSettings, setSettings, refetchSettings };
}
