import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api, type UserInfo } from './api';
import { GlitchTip } from './glitchtip';
import { getPosthog } from './posthog';

const MOCK_MODE = import.meta.env.VITE_MOCK_MODE === 'true';

const MOCK_USER: UserInfo = {
  id: '300000000000000001',
  username: 'MockAdmin',
  avatar: null,
  isOwner: true,
};

interface AuthContextType {
  user: UserInfo | null;
  loading: boolean;
  login: () => void;
  logout: () => void;
  onLogin: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(MOCK_MODE ? MOCK_USER : null);
  const [loading, setLoading] = useState(!MOCK_MODE);

  const fetchUser = useCallback(async () => {
    try {
      const userData = await api.get<UserInfo>('/auth/me');
      setUser(userData);
      GlitchTip.setUser({ id: userData.id, username: userData.username });
      getPosthog()?.identify(userData.id, { username: userData.username });
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (MOCK_MODE) return;
    fetchUser();
  }, [fetchUser]);

  const login = useCallback(async () => {
    if (MOCK_MODE) {
      setUser(MOCK_USER);
      setLoading(false);
      return;
    }

    try {
      const { url, state } = await api.get<{ url: string; state: string }>('/auth/login');
      localStorage.setItem('fluxy_oauth_state', state);
      window.location.href = url;
    } catch (err) {
      console.error('Failed to get login URL:', err);
    }
  }, []);

  const onLogin = useCallback(async () => {
    if (MOCK_MODE) {
      setUser(MOCK_USER);
      setLoading(false);
      return;
    }

    try {
      const userData = await api.get<UserInfo>('/auth/me');
      setUser(userData);
      GlitchTip.setUser({ id: userData.id, username: userData.username });
      getPosthog()?.identify(userData.id, { username: userData.username });
    } catch {
      setUser(null);
    }
  }, []);

  const logout = useCallback(async () => {
    if (MOCK_MODE) {
      setUser(MOCK_USER);
      return;
    }

    try { await api.post('/auth/logout'); } catch { /* ignore */ }
    setUser(null);
    GlitchTip.setUser(null);
    getPosthog()?.reset();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, onLogin, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
