import { createContext, useContext } from 'react';
import { canAccessAudience, type AccessIdentity } from '../../contracts/access.generated';
import { useAuth } from './context';
export interface DisplayState {
  identity: AccessIdentity;
  previewing: boolean;
  setPreview: (identity: AccessIdentity | null) => void;
}
export const DisplayContext = createContext<DisplayState | null>(null);
/** Use for UI visibility only. API calls always keep the signed-in user's credentials. */
export function useDisplayIdentity(): DisplayState {
  const context = useContext(DisplayContext);
  const { session } = useAuth();
  return (
    context ?? { identity: session ?? { role: 'student' }, previewing: false, setPreview: () => {} }
  );
}
export function useCanDisplay(audience: Parameters<typeof canAccessAudience>[1]): boolean {
  return canAccessAudience(useDisplayIdentity().identity, audience);
}
