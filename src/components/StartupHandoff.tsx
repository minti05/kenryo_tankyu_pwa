import { useLayoutEffect, type ReactNode } from 'react';
import { finishStartupBoot } from '../lib/startup-screen';

/** Runs after the first route (including its authentication gate) has committed. */
export function StartupHandoff({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    finishStartupBoot();
  }, []);
  return children;
}
