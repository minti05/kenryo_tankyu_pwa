import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
export default function PendingWorkPage() {
  const { id } = useParams(),
    [p] = useSearchParams();
  const from = p.get('from');
  const back = from && /^\/(explore|awards)(\?|$)/.test(from) ? from : '/explore';
  if (!/^\d{8}$/.test(id ?? '')) return <Navigate to="/explore" replace />;
  return (
    <div className="page-container empty-state">
      <h1>作品の詳細</h1>
      <p>資料を読む画面は準備中です。</p>
      <Link className="button secondary" to={back}>
        一覧へ戻る
      </Link>
    </div>
  );
}
