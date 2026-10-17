import { createContext, useContext, useState, type ReactNode } from 'react';
const PreviewLibraryContext = createContext<{
  saved: Set<string>;
  toggle: (id: string) => void;
} | null>(null);
export function PreviewLibraryProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState(new Set<string>());
  const toggle = (id: string) =>
    setSaved((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return <PreviewLibraryContext value={{ saved, toggle }}>{children}</PreviewLibraryContext>;
}
// eslint-disable-next-line react-refresh/only-export-components
export function usePreviewLibrary() {
  const value = useContext(PreviewLibraryContext);
  if (!value) throw new Error('Preview library is unavailable');
  return value;
}
