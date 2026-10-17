import { createContext, useContext } from 'react';
export interface Session {
  version: '1';
  uid: string;
  role: 'student' | 'admin';
}
export interface AuthState {
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
