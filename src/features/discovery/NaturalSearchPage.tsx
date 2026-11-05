import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Search, ArrowUpRight, RotateCcw, Sparkles } from 'lucide-react';
import { LiveWorkCard } from './LiveWorkCard';
import type { SearchWorkDto } from '../../contracts/discovery.generated';
import { useAuth } from '../auth/context';
import styles from './NaturalSearch.module.css';

const examples = [
  '地域の防災につながる探究を見つけたい',
  '睡眠と集中力の関係が気になる',
  '食品ロスを減らすアイデアを探したい',
];
export default function NaturalSearchPage() {
  const { session } = useAuth();
  return <SearchConversation key={session?.uid} />;
}
function SearchConversation() {
  const [draft, setDraft] = useState(
    () => new URLSearchParams(location.search).get('q')?.slice(0, 500) ?? '',
  );
  const { request } = useAuth();
  const [busy, setBusy] = useState(false);
  const [turns, setTurns] = useState<
    {
      id: string;
      text: string;
      items?: { work: SearchWorkDto; similarity: number }[];
      error?: boolean;
    }[]
  >([]);
  const input = useRef<HTMLTextAreaElement>(null),
    end = useRef<HTMLDivElement>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (text.length < 2 || busy) return;
    const id = crypto.randomUUID();
    setBusy(true);
    setTurns((previous) => [...previous, { id, text }]);
    setDraft('');
    requestAnimationFrame(() => end.current?.scrollIntoView({ block: 'nearest' }));
    try {
      const result = await request<{
        items: { work: SearchWorkDto; similarity: number }[];
      }>('/api/semantic-search', {
        method: 'POST',
        body: JSON.stringify({ query: text }),
      });
      setTurns((previous) =>
        previous.map((t) => (t.id === id ? { ...t, items: result.items } : t)),
      );
    } catch {
      setTurns((previous) => previous.map((t) => (t.id === id ? { ...t, error: true } : t)));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={`page-container ${styles.page}`}>
      <header className={styles.header}>
        <Link className="icon-button" to="/explore" aria-label="探索に戻る">
          <ArrowLeft size={21} />
        </Link>
        <div>
          <h1>AIで探す</h1>
          <span className={styles.status}>内容から探す</span>
        </div>
        {!!turns.length && (
          <button
            className="icon-button"
            aria-label="やり取りをクリア"
            disabled={busy}
            onClick={() => {
              setTurns([]);
              setDraft('');
              input.current?.focus();
            }}
          >
            <RotateCcw size={18} />
          </button>
        )}
      </header>
      {!turns.length ? (
        <section className={styles.welcome}>
          <span className={styles.symbol}>
            <Sparkles size={30} strokeWidth={1.5} />
          </span>
          <h2>
            気になることを、
            <br />
            そのまま。
          </h2>
          <p>テーマや気になることを文章で入力。</p>
          <div className={styles.examples} aria-label="検索文の例">
            {examples.map((text) => (
              <button
                key={text}
                onClick={() => {
                  setDraft(text);
                  input.current?.focus();
                }}
              >
                {text}
                <ArrowUpRight size={17} />
              </button>
            ))}
          </div>
        </section>
      ) : (
        <section
          className={styles.conversation}
          role="log"
          aria-label="検索のやり取り"
          aria-live="polite"
        >
          {turns.map((turn) => (
            <div className={styles.turn} key={turn.id}>
              <div className={styles.user}>
                <span className="sr-only">あなた：</span>
                {turn.text}
              </div>
              <div className={styles.reply}>
                <Sparkles size={19} aria-hidden="true" />
                <div>
                  {turn.error ? (
                    <p>検索できませんでした。時間をおいてもう一度お試しください。</p>
                  ) : turn.items ? (
                    turn.items.length ? (
                      <div className={styles.resultCards}>
                        {turn.items.map(({ work }) => (
                          <LiveWorkCard key={work.documentID} work={work} from="/search/chat" />
                        ))}
                      </div>
                    ) : (
                      <p>近い探究が見つかりませんでした。別の言葉でも試してみてください。</p>
                    )
                  ) : (
                    <div role="status" aria-label="探究を検索中" className={styles.searching}>
                      <span />
                      <span />
                      <span />
                    </div>
                  )}
                  <Link
                    to={`/results?${new URLSearchParams({ q: turn.text })}`}
                    className={styles.searchLink}
                  >
                    キーワード検索で探す
                    <ArrowUpRight size={16} />
                  </Link>
                </div>
              </div>
            </div>
          ))}
          <div ref={end} />
        </section>
      )}
      <div className={styles.composerArea}>
        <form className={styles.composer} onSubmit={submit}>
          <label className="sr-only" htmlFor="natural-search-input">
            探したいこと
          </label>
          <textarea
            id="natural-search-input"
            ref={input}
            value={draft}
            maxLength={500}
            rows={2}
            placeholder="どんなことに興味がありますか？"
            enterKeyHint="send"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === 'Enter' &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing &&
                event.keyCode !== 229
              ) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <button
            type="submit"
            disabled={draft.trim().length < 2 || busy}
            aria-label="AIで検索する"
          >
            <Search size={21} />
          </button>
        </form>
        <p>入力した文章の意味から、内容の近い探究を探します。</p>
      </div>
    </div>
  );
}
