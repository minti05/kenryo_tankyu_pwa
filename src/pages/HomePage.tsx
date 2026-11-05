import { LoadingSkeleton } from '../components/Loading';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Trophy } from 'lucide-react';
import { useAuth } from '../features/auth/context';
import type { SearchPageDto } from '../contracts/discovery.generated';
import { LiveWorkCard } from '../features/discovery/LiveWorkCard';
import discoveryStyles from '../features/discovery/PreviewRoutes.module.css';
import './home.css';
import { useDiscoveryDay } from './daily-discovery';

export default function HomePage() {
  const { session, request, offline } = useAuth();
  const day = useDiscoveryDay();
  const recommended = useQuery({
    queryKey: ['discovery', session?.uid, day],
    enabled: !!session && !offline,
    queryFn: ({ signal }) => request<SearchPageDto>('/api/discovery', { signal }),
  });
  return (
    <div className="page-container home-page">
      <h1 className="sr-only">ホーム</h1>
      <Link className="krgp-card" to="/awards">
        <Trophy size={40} strokeWidth={1.5} />
        <div>
          <h2>KRGP受賞作品</h2>
          <p>先輩たちの探究を、開催年・賞からたどる。</p>
        </div>
        <ArrowRight size={22} />
      </Link>
      <section aria-labelledby="home-recommended-title">
        <div className="home-section-heading">
          <h2 id="home-recommended-title">今日のおすすめ</h2>
          <Link className="text-link" to="/explore">
            探索する
            <ArrowRight size={16} />
          </Link>
        </div>
        {offline ? (
          <Link className="button secondary" to="/saved">
            履歴の管理を開く
          </Link>
        ) : recommended.isPending ? (
          <LoadingSkeleton
            label="おすすめの作品を読み込み中"
            cards
            count={4}
            className={discoveryStyles.workGrid}
          />
        ) : recommended.isError ? (
          <p role="status">
            作品を取得できませんでした。
            <button className="button quiet" onClick={() => void recommended.refetch()}>
              再試行
            </button>
          </p>
        ) : !recommended.data?.items.length ? (
          <p>公開中の作品はまだありません。</p>
        ) : (
          <div className={discoveryStyles.workGrid}>
            {recommended.data.items.slice(0, 4).map((work) => (
              <LiveWorkCard key={work.documentID} work={work} from="/home" />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
