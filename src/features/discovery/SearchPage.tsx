import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ConditionSuggestions } from './ConditionSuggestions';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Compass } from 'lucide-react';
import { SearchForm } from './SearchForm';
import { SearchHistory } from './SearchHistory';
import './discovery.css';
export default function SearchPage() {
  const location = useLocation();
  const [text, setText] = useState(new URLSearchParams(location.search).get('q') ?? '');
  return (
    <div className="page-container search-page">
      <h1 className="sr-only">検索</h1>
      <div className="search-entry">
        <Link className="icon-button" to="/home" aria-label="ホームへ戻る">
          <ArrowLeft size={22} />
        </Link>
        <SearchForm autoFocus onQueryChange={setText} />
      </div>
      <Link className="category-entry" to="/explore">
        <Compass size={23} />
        <span>カテゴリから調べる</span>
        <ArrowRight size={20} />
      </Link>
      <ConditionSuggestions text={text} />
      <SearchHistory />
    </div>
  );
}
