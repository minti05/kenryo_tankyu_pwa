// Generated public contract. Update through its owner; do not edit by hand.
export type AppRole = 'admin' | 'teacher' | 'student' | 'unassigned';
export interface AccessIdentity {
  role: AppRole;
  enterYear?: number;
}
export function validEnterYear(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1900 && value <= 2100;
}
/** Evaluate only verified identities on the server; UI previews are not authorization. */
export function canAccessAudience(
  identity: AccessIdentity,
  audience: { roles?: readonly AppRole[]; enterYears?: readonly number[] },
): boolean {
  if (identity.role === 'unassigned') return false;
  if (identity.role === 'admin') return true;
  if (audience.roles && !audience.roles.includes(identity.role)) return false;
  if (audience.enterYears)
    return identity.role === 'student' && identity.enterYear !== undefined && audience.enterYears.includes(identity.enterYear);
  return true;
}
/** Japanese school years start on April 1 JST. Alumni have no current high-school grade. */
export function schoolGrade(enterYear: number, now = new Date()): number | null {
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const year = jst.getUTCFullYear() - (jst.getUTCMonth() < 3 ? 1 : 0);
  const grade = year - enterYear + 1;
  return validEnterYear(enterYear) && grade >= 1 && grade <= 3 ? grade : null;
}
