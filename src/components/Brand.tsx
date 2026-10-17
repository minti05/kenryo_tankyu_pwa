import { Link } from 'react-router-dom';
export function Brand() {
  return (
    <Link className="brand" to="/welcome" aria-label="探究アーカイブのトップ">
      <img src="/icons/app-icon.png" width="44" height="44" alt="" />
      <span>
        <picture>
          <source media="(prefers-color-scheme: dark)" srcSet="/images/archive-white.png" />
          <img src="/images/archive-black.png" width="1781" height="139" alt="探究アーカイブ" />
        </picture>
        <small>KENRYO INQUIRY ARCHIVE</small>
      </span>
    </Link>
  );
}
