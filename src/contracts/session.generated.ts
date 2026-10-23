// Generated public contract. Update through its owner; do not edit by hand.
export interface SessionDto {
  version: "1";
  uid: string;
  role: "student" | "teacher" | "admin" | "unassigned";
  enterYear?: number;
  access?: "active" | "suspended";
  registration?: "waiting" | "processing";
}
