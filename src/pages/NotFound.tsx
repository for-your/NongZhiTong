import { Link } from 'react-router-dom';

function NotFound() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-paper px-4">
      <div className="max-w-md text-center">
        <p className="text-caption font-semibold uppercase tracking-[.2em] text-brand">农智通</p>
        <h1 className="mt-3 font-display text-6xl font-bold text-ink">404</h1>
        <p className="mt-4 text-xl font-bold text-ink">页面没有找到</p>
        <p className="mt-2 text-sm leading-6 text-muted">链接可能已经失效，返回首页继续查看天气、知识和智能助手。</p>
        <Link
          to="/"
          className="mt-8 inline-flex rounded-full bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-deep"
        >
          返回首页
        </Link>
      </div>
    </div>
  );
}

export default NotFound;
