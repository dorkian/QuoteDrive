import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { demoLogin, fetchMe, type Me } from "./api";
import { UNAUTHORIZED_EVENT } from "./errors";

const TOKEN_STORAGE_KEY = "quotedrive.token";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  me: Me | null;
  token: string | null;
  error: string | null;
  login: (email: string) => Promise<void>;
  logout: () => void;
  /** Re-reads /me, e.g. after the user's own role changed. */
  refreshMe: () => Promise<void>;
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

  // Any authenticated call that comes back 401 (e.g. the JWT expired mid-session)
  // drops back to the login screen at the current URL, so signing in again
  // returns the user to the page they were on.
  useEffect(() => {
    function handleUnauthorized(): void {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      setMe(null);
      setToken(null);
      setStatus("unauthenticated");
      setError("Your session expired. Sign in again.");
    }
    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    return () =>
      window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
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

  async function refreshMe(): Promise<void> {
    if (!token) {
      return;
    }
    setMe(await fetchMe(token));
  }

  function logout(): void {
    setError(null);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setMe(null);
    setToken(null);
    setStatus("unauthenticated");
  }

  return (
    <AuthContext.Provider
      value={{ status, me, token, error, login, logout, refreshMe }}
    >
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
