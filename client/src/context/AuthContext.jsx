import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, tokenStore, API_URL } from '../lib/api';
import { closeSocket } from '../lib/socket';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    if (!tokenStore.get()) {
      setUser(null);
      setLoading(false);
      return null;
    }
    try {
      const { data } = await api.get('/auth/me');
      setUser(data.user);
      return data.user;
    } catch {
      tokenStore.clear();
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = useCallback(() => {
    window.location.href = `${API_URL}/api/auth/github`;
  }, []);

  const completeLogin = useCallback(
    async (token) => {
      tokenStore.set(token);
      setLoading(true);
      return loadUser();
    },
    [loadUser]
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // token may already be invalid; clearing locally is enough
    }
    tokenStore.clear();
    closeSocket();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout, completeLogin, reload: loadUser }),
    [user, loading, login, logout, completeLogin, loadUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
