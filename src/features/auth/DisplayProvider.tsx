import { useState, type ReactNode } from 'react';
import type { AccessIdentity } from '../../contracts/access.generated';
import { validEnterYear } from '../../contracts/access.generated';
import { useAuth } from './context';
import { DisplayContext } from './display-context';
export function DisplayProvider({ children }: { children: ReactNode }) {
  const { session, offline } = useAuth();
  const [preview, setPreview] = useState<{ uid: string; identity: AccessIdentity } | null>(null);
  const allowed = session?.role === 'admin' && !offline;
  const active = allowed && preview?.uid === session.uid ? preview.identity : null;
  return (
    <DisplayContext.Provider
      value={{
        identity: active ?? session ?? { role: 'student' },
        previewing: active !== null,
        setPreview: (identity) => {
          if (!allowed || identity === null || identity.role === 'admin') {
            setPreview(null);
            return;
          }
          if (
            !['teacher', 'student'].includes(identity.role) ||
            (identity.enterYear !== undefined &&
              (identity.role !== 'student' || !validEnterYear(identity.enterYear)))
          )
            return;
          setPreview({ uid: session.uid, identity });
        },
      }}
    >
      {children}
    </DisplayContext.Provider>
  );
}
