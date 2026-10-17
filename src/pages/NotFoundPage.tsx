import { Link } from 'react-router-dom';
export default function NotFoundPage() {
  return (
    <div className="page-container empty-state">
      <span className="eyebrow">PAGE NOT FOUND</span>
      <h1>お探しのページが見つかりません。</h1>
      <p>リンクをご確認いただくか、トップから探し直してください。</p>
      <Link className="button primary" to="/welcome">
        トップへ戻る
      </Link>
    </div>
  );
}
