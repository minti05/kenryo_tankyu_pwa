import { useTheme } from '../lib/theme';
import { Link } from 'react-router-dom';
export function Brand({ to = '/welcome' }: { to?: string }) {
  const { theme } = useTheme();
  return (
    <Link className="brand" to={to} aria-label="探究アーカイブのトップ">
      <img src="/icons/app-icon.png" width="44" height="44" alt="" />
      <span>
        <picture>
          <img
            src={theme === 'dark' ? '/images/archive-white.png' : '/images/archive-black.png'}
            width="1781"
            height="139"
            alt="探究アーカイブ"
          />
        </picture>
        <small>TANKYU ARCHIVE</small>
      </span>
    </Link>
  );
}
