import { ApiError } from '../../lib/api-client';
export function operation() {
  return { operationId: crypto.randomUUID(), issuedAt: new Date().toISOString() };
}
export function libraryMessage(error: unknown) {
  const code = error instanceof ApiError ? error.code : '';
  const messages: Record<string, string> = {
    favorite_conflict:
      '別の画面で変更されました。現在の状態を読み直しました。確認してもう一度操作してください。',
    operation_expired: '操作の有効期限が切れました。画面を読み直してください。',
    report_limit: '本日の報告は上限に達しました。時間をおいてお試しください。',
    recent_login_required: 'もう一度Googleで本人確認してください。',
    offline: 'この操作はオンラインで利用できます。',
  };
  return messages[code] ?? '通信を確認して、同じ操作をもう一度お試しください。';
}
/** Reuse the receipt for identical retries, including an unknown response after commit. */
export function retryableIntent() {
  const pending = new Map<string, ReturnType<typeof operation>>();
  const fn = (intent: unknown) => {
    const key = JSON.stringify(intent);
    let op = pending.get(key);
    if (!op) {
      op = operation();
      pending.set(key, op);
    }
    return { ...op };
  };
  fn.clear = () => pending.clear();
  return fn;
}
