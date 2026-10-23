import { ShieldCheck, FileText, Mail, ArrowUpRight } from 'lucide-react';
import { CONTACT_URL, PRIVACY_URL, TERMS_URL } from '../lib/links';
export function PolicyLinks({ settings = false }: { settings?: boolean }) {
  const links = [
    { url: PRIVACY_URL, label: 'プライバシーポリシー', icon: ShieldCheck },
    { url: TERMS_URL, label: '利用規約', icon: FileText },
    { url: CONTACT_URL, label: 'お問い合わせ', icon: Mail },
  ];
  return (
    <>
      {links.map(({ url, label, icon: Icon }) => (
        <a
          key={url}
          className={settings ? 'setting-row' : undefined}
          href={url}
          target={url.startsWith('https:') ? '_blank' : undefined}
          rel={url.startsWith('https:') ? 'noopener noreferrer' : undefined}
        >
          {settings && <Icon size={21} />}
          <span>{label}</span>
          {settings && <ArrowUpRight size={16} />}
        </a>
      ))}
    </>
  );
}
