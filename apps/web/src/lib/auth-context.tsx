import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { demoLogin, fetchMe, type Me } from "./api";

const TOKEN_STORAGE_KEY = "quotedrive.token";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  me: Me | null;
  token: string | null;
  error: string | null;
  login: (email: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(() =>
    localStorage.getItem(TOKEN_STORAGE_KEY) ? "loading" : "unauthenticated",
  );
  const [me, setMe] = useState<Me | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!storedToken) {
      return;
    }
    fetchMe(storedToken)
      .then((fetchedMe) => {
        setMe(fetchedMe);
        setToken(storedToken);
        setStatus("authenticated");
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        setStatus("unauthenticated");
      });
  }, []);

  async function login(email: string): Promise<void> {
    setError(null);
    try {
      const newToken = await demoLogin(email);
      const fetchedMe = await fetchMe(newToken);
      localStorage.setItem(TOKEN_STORAGE_KEY, newToken);
      setMe(fetchedMe);
      setToken(newToken);
      setStatus("authenticated");
    } catch {
      setError("That demo login didn't work. Please try again.");
    }
  }

  function logout(): void {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setMe(null);
    setToken(null);
    setStatus("unauthenticated");
  }

  return (
    <AuthContext.Provider value={{ status, me, token, error, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
