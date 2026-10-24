import { createContext } from 'react';
export interface ReaderSearch {
  toggle: () => void;
}
export const ReaderContext = createContext<{
  pdfVisible?: boolean;
  bindSearch: (api: ReaderSearch | null) => void;
} | null>(null);
