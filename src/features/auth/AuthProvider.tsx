import {
  forgetOtherUser,
  activateCache,
  cacheIsCurrent,
  resumeCache,
  revokeCache,
  subscribeCache,
  sweepExpired,
  type CacheSession,
} from '../offline/store';
import { CONTRACT_VERSION } from '../../contracts/work.generated';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { ApiError, createApiClient, createApiTransport } from '../../lib/api-client';
import { initializeAuth, authConfigured } from './firebase';
import { AuthContext, type Session } from './context';
function message(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  const messages: Record<string, string> = {
    'auth/popup-closed-by-user': 'ログインがキャンセルされました。',
    'auth/cancelled-popup-request': 'ログイン画面が開いています。',
    'auth/popup-blocked': 'ポップアップを許可して、もう一度ログインしてください。',
    'auth/account-exists-with-different-credential':
      '以前のアカウントとの連携確認が必要です。別のアカウントを作り直さず、運営者へ確認してください。',
    'auth/unauthorized-domain': 'この接続先ではまだログイン設定が完了していません。',
    google_required: '学校のGoogleアカウントでもう一度ログインしてください。',
    school_account_required: '確認済みの学校のGoogleアカウントを選んでください。',
    membership_required:
      'このアカウントの利用資格を確認できません。登録状況を運営者へ確認してください。',
    session_expired: 'ログインの有効期限が切れました。もう一度ログインしてください。',
    configuration_required: '接続設定を準備中です。時間をおいてお試しください。',
  };
  return (
    messages[code] ?? 'ログイン状態を確認できませんでした。通信を確認して、もう一度お試しください。'
  );
}
export function AuthProvider({ children }: { children: ReactNode }) {
  const query = useQueryClient();
  const [ready, setReady] = useState(!authConfigured),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [session, setSession] = useState<Session | null>(null),
    [signedIn, setSignedIn] = useState(false),
    [offline, setOffline] = useState(false),
    [cacheSession, setCacheSession] = useState<CacheSession | null>(null);
  const runtime = useRef<Awaited<ReturnType<typeof initializeAuth>> | null>(null),
    generation = useRef(0);
  const checkRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    if (!authConfigured) return;
    let disposed = false,
      unsubscribe: () => void = () => {};
    initializeAuth()
      .then((value) => {
        if (disposed) return;
        runtime.current = value;
        setReady(true);
        const check = async () => {
          const ticket = ++generation.current;
          setSession(null);
          setCacheSession(null);
          setOffline(false);
          query.clear();
          const user = value.auth.currentUser;
          setSignedIn(!!user);
          if (!user) {
            await revokeCache().catch(() => {});
            setBusy(false);
            return;
          }
          setError('');
          setBusy(true);
          try {
            await forgetOtherUser(user.uid).catch(() => {});
            if (!navigator.onLine) {
              const google = user.providerData.some((p) => p.providerId === 'google.com');
              const saved =
                google && user.emailVerified && user.email?.endsWith('@kenryo.ed.jp')
                  ? await resumeCache(user.uid)
                  : null;
              if (!disposed && generation.current === ticket) {
                if (saved) {
                  setSession(saved.session);
                  setCacheSession(saved.cacheSession);
                  setOffline(true);
                } else
                  setError(
                    'オフラインで開ける保存資料がありません。通信に接続してログインしてください。',
                  );
              }
              return;
            }
            const request = createApiClient(async () => {
              const token = await user.getIdToken();
              return value.auth.currentUser?.uid === user.uid ? token : null;
            });
            const data = await request<unknown>('/api/session');
            if (
              !data ||
              typeof data !== 'object' ||
              !('version' in data) ||
              data.version !== CONTRACT_VERSION ||
              !('uid' in data) ||
              data.uid !== user.uid ||
              !('role' in data) ||
              !['student', 'admin'].includes(String(data.role))
            )
              throw new Error('invalid_session');
            if (
              !disposed &&
              generation.current === ticket &&
              value.auth.currentUser?.uid === user.uid
            ) {
              const cache = await activateCache(user.uid).catch(() => null);
              if (
                !disposed &&
                generation.current === ticket &&
                value.auth.currentUser?.uid === user.uid
              ) {
                setSession(data as Session);
                setCacheSession(cache);
                setOffline(false);
              }
            }
          } catch (caught) {
            if (!disposed && generation.current === ticket) {
              setError(message(caught));
              if (caught instanceof ApiError && [401, 403].includes(caught.status))
                await revokeCache().catch(() => {});
              if (caught instanceof ApiError && caught.status === 401)
                await value.sdk.signOut(value.auth);
            }
          } finally {
            if (!disposed && generation.current === ticket) setBusy(false);
          }
        };
        checkRef.current = check;
        unsubscribe = value.sdk.onIdTokenChanged(value.auth, () => {
          void check();
        });
      })
      .catch(() => {
        if (!disposed) {
          setError('ログイン機能を読み込めませんでした。画面を再読み込みしてください。');
          setReady(false);
        }
      });
    const changed = () => {
      void checkRef.current();
    };
    window.addEventListener('online', changed);
    window.addEventListener('offline', changed);
    return () => {
      window.removeEventListener('online', changed);
      window.removeEventListener('offline', changed);
      disposed = true;
      unsubscribe();
      runtime.current = null;
    };
  }, [query]);
  function login() {
    const value = runtime.current;
    if (!value || busy) return;
    setError('');
    setBusy(true);
    // SDKはボタンを有効にする前に初期化済み。ユーザー操作から直接popupを開く。
    void value.sdk.signInWithPopup(value.auth, value.provider).catch((caught) => {
      setError(message(caught));
      setBusy(false);
    });
  }
  async function logout() {
    generation.current++;
    setSession(null);
    setCacheSession(null);
    setOffline(false);
    query.clear();
    setError('');
    await revokeCache().catch(() =>
      setError('端末の保存を削除できませんでした。ブラウザのサイトデータも削除してください。'),
    );
    try {
      if (runtime.current) await runtime.current.sdk.signOut(runtime.current.auth);
      setSignedIn(false);
    } catch (caught) {
      setError(message(caught));
    }
  }
  async function requestResponse(path: string, options: RequestInit = {}): Promise<Response> {
    if (offline || !navigator.onLine) throw new ApiError(0, 'offline');
    const uid = session?.uid;
    if (!uid) throw new ApiError(401, 'authentication_required');
    const ticket = generation.current;
    try {
      const call = createApiTransport(async () => {
        const user = runtime.current?.auth.currentUser;
        if (user?.uid !== uid) return null;
        const token = await user.getIdToken();
        return runtime.current?.auth.currentUser?.uid === uid ? token : null;
      });
      const result = await call(path, options);
      if (generation.current !== ticket || runtime.current?.auth.currentUser?.uid !== uid) {
        await result.body?.cancel();
        throw new ApiError(0, 'session_changed');
      }
      return result;
    } catch (caught) {
      if (
        generation.current === ticket &&
        runtime.current?.auth.currentUser?.uid === uid &&
        caught instanceof ApiError &&
        (caught.status === 401 || caught.status === 403)
      ) {
        generation.current++;
        setSession(null);
        setCacheSession(null);
        setOffline(false);
        await revokeCache().catch(() => {});
        query.clear();
        setError(message(caught));
      }
      throw caught;
    }
  }
  async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await requestResponse(path, options);
    if (!response.headers.get('content-type')?.includes('application/json'))
      throw new ApiError(response.status, 'invalid_response');
    return response.json() as Promise<T>;
  }
  useEffect(() => {
    const cleanup = () => {
      void sweepExpired().catch(() => {});
    };
    const check = () => {
      if (cacheSession)
        void (offline ? resumeCache(cacheSession.uid).then(Boolean) : cacheIsCurrent(cacheSession))
          .then((ok) => {
            if (!ok) {
              generation.current++;
              setSession(null);
              setCacheSession(null);
              query.clear();
              setOffline(false);
            }
          })
          .catch(() => {});
    };
    const unsubscribe = subscribeCache(check);
    const timer = setInterval(() => {
      cleanup();
      check();
    }, 30000);
    cleanup();
    window.addEventListener('focus', cleanup);
    document.addEventListener('visibilitychange', cleanup);
    return () => {
      unsubscribe();
      clearInterval(timer);
      window.removeEventListener('focus', cleanup);
      document.removeEventListener('visibilitychange', cleanup);
    };
  }, [cacheSession, query, offline]);
  return (
    <AuthContext.Provider
      value={{
        request,
        requestResponse,
        offline,
        cacheSession,
        ready,
        configured: authConfigured,
        busy,
        error,
        session,
        signedIn,
        login,
        logout,
        retry: () => checkRef.current(),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
