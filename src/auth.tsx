// AuthProvider — JWT-токен в localStorage (это сессия, не критические данные),
// сами данные пользователей — в PostgreSQL
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from './api';
import type { User } from './types';

const TOKEN_KEY = 'aw_token';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) { setLoading(false); return; }
    api.me().then(u => {
      setUser(u);
      if (!u) localStorage.removeItem(TOKEN_KEY);
      setLoading(false);
    }).catch(() => {
      localStorage.removeItem(TOKEN_KEY);
      setLoading(false);
    });
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const { user, token } = await api.login(username, password);
    localStorage.setItem(TOKEN_KEY, token);
    setUser(user);
  }, []);

  const register = useCallback(async (username: string, password: string) => {
    const { user, token } = await api.register(username, password);
    localStorage.setItem(TOKEN_KEY, token);
    setUser(user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}