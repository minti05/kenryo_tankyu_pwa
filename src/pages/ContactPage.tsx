import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Send } from 'lucide-react';
import { useAuth } from '../features/auth/context';
import { LoadingIndicator } from '../components/Loading';
import styles from './SupportPage.module.css';
export default function ContactPage() {
  const { profile, session, offline } = useAuth();
  const [email, setEmail] = useState<string | null>(null),
    [subject, setSubject] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [sent, setSent] = useState(false),
    [error, setError] = useState('');
  const operation = useRef<{ payload: string; id: string } | null>(null);
  const active = useRef(false);
  return (
    <div className={styles.page}>
      <Link className={styles.back} to={session ? '/account' : '/welcome'}>
        <ArrowLeft size={18} />
        戻る
      </Link>
      <header>
        <p className={styles.eyebrow}>SUPPORT</p>
        <h1>お問い合わせ</h1>
      </header>
      {sent ? (
        <section className={styles.success} role="status">
          <CheckCircle2 size={34} />
          <h2>送信しました</h2>
          <p>制作委員会で内容を確認し、ご入力のメールアドレスへご連絡します。</p>
          <Link className="button secondary" to={session ? '/home' : '/welcome'}>
            戻る
          </Link>
        </section>
      ) : (
        <form
          className={styles.form}
          onSubmit={async (e) => {
            e.preventDefault();
            if (active.current || offline) return;
            const payload = JSON.stringify({
              email: (email ?? profile?.email ?? '').trim(),
              subject: subject.trim(),
              message: message.trim(),
            });
            if (!operation.current || operation.current.payload !== payload)
              operation.current = { payload, id: crypto.randomUUID() };
            active.current = true;
            setBusy(true);
            setError('');
            try {
              const response = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                cache: 'no-store',
                redirect: 'error',
                body: JSON.stringify({ ...JSON.parse(payload), id: operation.current.id }),
              });
              if (!response.ok)
                throw new Error(
                  response.status === 429
                    ? 'しばらく時間をおいてから、もう一度お試しください。'
                    : response.status === 400
                      ? '入力内容を確認してください。'
                      : '送信できませんでした。通信を確認して、もう一度お試しください。',
                );
              const result = await response.json();
              if (result.id !== operation.current.id || result.status !== 'received')
                throw new Error('送信を確認できませんでした。もう一度お試しください。');
              setSent(true);
            } catch (e) {
              setError(
                e instanceof Error && /^(しばらく|入力内容|送信)/.test(e.message)
                  ? e.message
                  : '送信できませんでした。通信を確認して、もう一度お試しください。',
              );
            } finally {
              active.current = false;
              setBusy(false);
            }
          }}
        >
          <label>
            連絡可能なメールアドレス
            <input
              type="email"
              name="email"
              autoComplete="email"
              maxLength={254}
              required
              value={email ?? profile?.email ?? ''}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
            />
          </label>
          <label>
            件名
            <input
              name="subject"
              maxLength={120}
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={busy}
            />
          </label>
          <label>
            内容
            <textarea
              name="message"
              rows={8}
              maxLength={5000}
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={busy}
            />
          </label>
          <p className={styles.note}>
            入力された情報は、お問い合わせへの対応に使用します。
            <Link to="/privacy">プライバシーポリシー</Link>
          </p>
          {offline && <p role="status">送信するにはインターネットに接続してください。</p>}
          {error && <p role="alert">{error}</p>}
          <button
            className="button primary"
            type="submit"
            disabled={
              busy ||
              offline ||
              !(email ?? profile?.email ?? '').trim() ||
              !subject.trim() ||
              !message.trim()
            }
          >
            {busy ? (
              <LoadingIndicator inline label="送信中" />
            ) : (
              <>
                <Send size={18} />
                送信する
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
}
