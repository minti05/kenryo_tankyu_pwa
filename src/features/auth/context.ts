import { createContext, useContext } from 'react';
import type { CacheSession } from '../offline/store';
import type { SessionDto } from '../../contracts/session.generated';
export type Session = SessionDto;
export interface AuthState {
  offline: boolean;
  cacheSession: CacheSession | null;
  requestResponse: (path: string, options?: RequestInit) => Promise<Response>;
  request: <T>(path: string, options?: RequestInit) => Promise<T>;
  ready: boolean;
  configured: boolean;
  busy: boolean;
  error: string;
  session: Session | null;
  signedIn: boolean;
  login: () => void;
  logout: () => Promise<void>;
  retry: () => Promise<void>;
}
export const AuthContext = createContext<AuthState | null>(null);
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider missing');
  return value;
}
