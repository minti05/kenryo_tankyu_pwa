import { createContext } from 'react';
export interface ReaderSearch {
  toggle: () => void;
}
export const ReaderContext = createContext<{
  bindSearch: (api: ReaderSearch | null) => void;
} | null>(null);
