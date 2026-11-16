import { Link } from 'react-router-dom';
import { ArrowUpRight, Mail, MapPin, Sprout } from 'lucide-react';

const columns = [
  {
    title: '探索农智通',
    links: [
      { label: '首页', to: '/' },
      { label: '智能助手', to: '/assistant' },
      { label: '知识空间', to: '/space' },
    ],
  },
  {
    title: '我们相信',
    links: [
      { label: '科技应该更简单', to: '/space' },
      { label: '数据应该服务人', to: '/space' },
      { label: '土地值得被理解', to: '/space' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="relative overflow-hidden bg-ink text-white">
      <div className="grain-overlay" />
      <div className="relative mx-auto max-w-[1240px] px-5 pb-12 pt-20 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_2fr]">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand">
                <Sprout className="h-5 w-5" />
              </span>
              <span className="font-display text-2xl font-bold tracking-[-.02em]">农智通</span>
            </div>
            <p className="mt-6 max-w-sm text-small leading-7 text-white/55">
              让每一位农业从业者，都能用更少的时间做出更好的决定。自然智能，服务每一块土地。
            </p>
            <div className="mt-6 flex items-center gap-2.5 text-caption font-semibold uppercase tracking-[.16em] text-white/45">
              <MapPin className="h-3.5 w-3.5 text-gold" />
              中国 · 服务全国农业生产者
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {columns.map((col) => (
              <div key={col.title}>
                <h3 className="text-caption font-bold uppercase tracking-[.18em] text-white/40">{col.title}</h3>
                <div className="mt-5 space-y-3.5">
                  {col.links.map((link) => (
                    <Link
                      key={link.label}
                      to={link.to}
                      className="link-underline block w-fit text-small text-white/60 transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}

            <div>
              <h3 className="text-caption font-bold uppercase tracking-[.18em] text-white/40">保持联系</h3>
              <div className="mt-5 space-y-3.5">
                <a
                  href="mailto:hello@agrismart.cn"
                  className="link-underline flex w-fit items-center gap-2 text-small text-white/60 transition-colors hover:text-white"
                >
                  <Mail className="h-3.5 w-3.5" />
                  联系我们
                </a>
                <Link to="/about" className="link-underline flex w-fit items-center gap-1 text-small text-white/60 transition-colors hover:text-white">
                  关于我们
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-20 flex flex-col justify-between gap-3 border-t border-white/10 pt-7 text-caption text-white/35 sm:flex-row">
          <span>© 2026 农智通 · AI Native Agriculture Workspace</span>
          <span className="tracking-[.1em]">隐私政策 · 服务条款 · 数据安全</span>
        </div>
      </div>
    </footer>
  );
}
