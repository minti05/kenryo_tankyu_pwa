import { createContext } from 'react';
export interface ReaderSearch {
  toggle: () => void;
}
export const ReaderContext = createContext<{
  pdfVisible?: boolean;
  onScroll?: (metrics: { top: number; remaining: number }) => void;
  bindSearch: (api: ReaderSearch | null) => void;
  reportDocument?: () => void;
} | null>(null);
