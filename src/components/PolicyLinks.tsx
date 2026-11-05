import { Link } from 'react-router-dom';
import { ShieldCheck, FileText, Mail, ChevronRight } from 'lucide-react';
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
        <Link key={url} className={settings ? 'setting-row' : undefined} to={url}>
          {settings && <Icon size={21} />}
          <span>{label}</span>
          {settings && <ChevronRight size={16} />}
        </Link>
      ))}
    </>
  );
}
