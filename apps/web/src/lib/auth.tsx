import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiClient, onAuthExpired, setAccessToken } from "./api";

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    onAuthExpired(() => setUser(null));

    // Silent refresh on load: the refresh cookie may still be valid even
    // though we don't hold an access token in memory yet (page reload).
    apiClient
      .post<{ user: User; accessToken: string }>("/api/auth/refresh")
      .then((res) => {
        setAccessToken(res.accessToken);
        setUser(res.user);
      })
      .catch(() => setAccessToken(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const res = await apiClient.post<{ user: User; accessToken: string }>("/api/auth/login", { email, password });
    setAccessToken(res.accessToken);
    setUser(res.user);
  }

  async function logout() {
    await apiClient.post("/api/auth/logout").catch(() => undefined);
    setAccessToken(null);
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
