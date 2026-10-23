// Generated public contract. Update through its owner; do not edit by hand.
import type {SearchWorkDto} from "./discovery.generated";
export interface LibraryItemDto {
  work: SearchWorkDto;
  viewedAt: string | null;
  favorite: boolean;
}

export interface LibraryPageDto {
  version: "1";
  items: LibraryItemDto[];
  nextCursor: string | null;
  stats?: StatsDto;
}

export interface FavoriteDto {
  version: "1";
  favorite: boolean;
  revision: number;
  count: number;
}

export interface StatsDto {
  version: "1";
  today: number;
  week: number;
  total: number;
  serverTime: string;
}

export interface ReceiptDto {
  version: "1";
  id: string;
  status: "received" | "pending" | "complete";
}

export interface ViewRecordedDto {
  version: "1";
  recorded: boolean;
  item?: LibraryItemDto;
  stats?: StatsDto;
}

export interface HistoryDeletedDto {
  version: "1";
  deleted: boolean;
  stats?: StatsDto;
}
