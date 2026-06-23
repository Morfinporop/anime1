import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { hashPassword, store } from './store';
import type { User } from './types';

// КРИТИЧНО: localStorage не используется. Только sessionStorage для UI-сессии,
// а критические данные (пользователи, контент) — на бэкенде (PostgreSQL).
const SESSION_KEY = 'animeworld:session';

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
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) {
      try { setUser(JSON.parse(raw)); } catch { sessionStorage.removeItem(SESSION_KEY); }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const hash = await hashPassword(password);
    const u = store.login(username, hash);
    setUser(u);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(u));
  }, []);

  const register = useCallback(async (username: string, password: string) => {
    const hash = await hashPassword(password);
    const u = store.register(username, hash);
    setUser(u);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(u));
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    sessionStorage.removeItem(SESSION_KEY);
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