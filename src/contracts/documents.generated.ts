// Generated public contract. Update through its owner; do not edit by hand.
import type {SearchWorkDto} from "./discovery.generated";
export interface WorkSummaryEvidenceDto {
  targets: { start: number; end: number; }[];
  kind: "slide" | "report" | "poster" | "thesis";
  page: number;
}

export interface WorkSummaryDto {
  body: string;
  evidence: WorkSummaryEvidenceDto[];
}

export interface WorkDocumentDto {
  kind: "slide" | "report" | "poster" | "thesis";
  state: "available" | "missing" | "too_large" | "invalid";
  bytes: number | null;
  revision: string | null;
  sha256: string | null;
}

export interface WorkDetailDto {
  version: "1";
  work: SearchWorkDto;
  documents: WorkDocumentDto[];
  summary?: WorkSummaryDto | null;
  authorizedAt: string;
}
