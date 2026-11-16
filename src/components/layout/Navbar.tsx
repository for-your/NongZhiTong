import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, Sprout, X } from 'lucide-react';

const links = [{ label: '首页', to: '/' }, { label: '智能助手', to: '/assistant' }, { label: '知识空间', to: '/space' }, { label: '关于我们', to: '/about' }];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-6">
      <div
        className={`mx-auto max-w-[1240px] border bg-surface/95 backdrop-blur-md transition-all duration-500 ease-out-soft sm:px-7 ${
          scrolled ? 'rounded-full border-faint py-2 shadow-md' : 'rounded-[26px] border-faint/60 py-3 shadow-sm'
        }`}
      >
        <div className="flex items-center justify-between gap-4 px-4 sm:px-0">
          <Link to="/" className="group flex items-center gap-2.5" title="返回首页">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-tint text-brand transition-transform duration-500 ease-out-soft group-hover:rotate-[-12deg]">
              <Sprout className="h-[18px] w-[18px]" />
            </span>
            <span className="leading-none">
              <span className="block font-display text-[17px] font-bold tracking-[-.01em] text-ink">农智通</span>
              <span className="mt-1 hidden text-[8px] font-semibold uppercase tracking-[.2em] text-subtle sm:block">
                AI Agriculture Workspace
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }: { isActive: boolean }) =>
                  `relative px-4 py-2 text-small font-semibold transition-colors duration-300 ${
                    isActive ? 'text-brand' : 'text-muted hover:text-ink'
                  }`
                }
              >
                {({ isActive }: { isActive: boolean }) => (
                  <span className="relative">
                    {link.label}
                    {isActive && (
                      <motion.span
                        layoutId="nav-underline"
                        className="absolute inset-x-2 -bottom-1.5 h-px bg-brand"
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                      />
                    )}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              to="/assistant"
              className="hidden rounded-full bg-brand px-5 py-2.5 text-caption font-bold uppercase tracking-[.14em] text-white transition-all duration-300 hover:bg-brand-deep hover:shadow-md active:scale-[.98] sm:inline-flex"
            >
              Get Started
            </Link>
            <button
              onClick={() => setOpen((value) => !value)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-ink transition hover:bg-paper-warm md:hidden"
              aria-label={open ? '关闭菜单' : '打开菜单'}
              aria-expanded={open}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {open && (
            <motion.nav
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden md:hidden"
            >
              <div className="mt-3 border-t border-faint px-4 pt-1 sm:px-0">
                {links.map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    onClick={() => setOpen(false)}
                    className={({ isActive }: { isActive: boolean }) =>
                      `block border-b border-faint/60 py-3.5 text-small font-semibold transition-colors last:border-0 ${
                        isActive ? 'text-brand' : 'text-ink hover:text-brand'
                      }`
                    }
                  >
                    {link.label}
                  </NavLink>
                ))}
                <Link
                  to="/assistant"
                  onClick={() => setOpen(false)}
                  className="my-3 inline-flex rounded-full bg-brand px-5 py-2.5 text-caption font-bold uppercase tracking-[.14em] text-white"
                >
                  Get Started
                </Link>
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
