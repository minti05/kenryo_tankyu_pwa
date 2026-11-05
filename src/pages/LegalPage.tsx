import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../features/auth/context';
import { legalContent } from './legal-content';
import { CONTACT_EMAIL, CONTACT_URL } from '../lib/links';
import styles from './SupportPage.module.css';
export default function LegalPage({ kind }: { kind: 'privacy' | 'terms' }) {
  const { session } = useAuth(),
    document = legalContent[kind];
  return (
    <article className={styles.page}>
      <Link className={styles.back} to={session ? '/account' : '/welcome'}>
        <ArrowLeft size={18} />
        戻る
      </Link>
      <header>
        <p className={styles.eyebrow}>探究アーカイブ制作委員会</p>
        <h1>{document.title}</h1>
      </header>
      <div className={styles.document}>
        {document.intro.map((p) => (
          <p key={p}>{p}</p>
        ))}
        {document.sections.map((section, index) => (
          <section key={section.title} aria-labelledby={`legal-${index}`}>
            <h2 id={`legal-${index}`}>{section.title}</h2>
            {section.paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </section>
        ))}
      </div>
      <aside className={styles.contact}>
        <strong>お問い合わせ</strong>
        <span>探究アーカイブ制作委員会</span>
        <span>{CONTACT_EMAIL}</span>
        <Link to={CONTACT_URL}>
          お問い合わせフォーム
          <ChevronRight size={16} />
        </Link>
      </aside>
    </article>
  );
}
