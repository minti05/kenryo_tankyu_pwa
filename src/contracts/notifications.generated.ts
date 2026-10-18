// Generated public contract. Update through its owner; do not edit by hand.
export interface NoticeDto {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  workId: string | null;
}

export interface NoticesDto {
  version: "1";
  items: NoticeDto[];
  nextCursor: string | null;
}

export interface PushStatusDto {
  version: "1";
  enabled: boolean;
  registered: boolean;
}

export interface PublishDto {
  version: "1";
  id: string;
  queued: number;
}
