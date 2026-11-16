import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

export default function App() {
  const location = useLocation();

  return (
    <div className="min-h-screen">
      <BigLogoLayer />
      <div className="relative z-10 bg-paper">
        <Navbar />
        <AnimatePresence mode="wait">
          <Outlet key={location.pathname} />
        </AnimatePresence>
        <Footer />
      </div>
      <div aria-hidden className="h-[45vh]" />
    </div>
  );
}

const LINES = [
  ['A', 'G', 'R', 'I'],
  ['S', 'M', 'A', 'R', 'T'],
];
// 每字母独立响应系数：fx/fy 决定鼠标方向与幅度；baseY 静态错开 baseline，形成堆块感
const FACTORS = [
  { x: 28, y: -18, baseY: -6 },
  { x: -22, y: 32, baseY: 8 },
  { x: 36, y: 22, baseY: -10 },
  { x: -30, y: -28, baseY: 4 },
  { x: 22, y: 26, baseY: -4 },
  { x: -34, y: -20, baseY: 10 },
  { x: 30, y: 24, baseY: -8 },
  { x: -18, y: -32, baseY: 6 },
  { x: 26, y: 18, baseY: -5 },
];

function BigLogoLayer() {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const lastMouse = useRef<{ x: number; y: number; ready: boolean }>({ x: 0, y: 0, ready: false });
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      // 首帧只记录起点，不累计位移
      if (!lastMouse.current.ready) {
        lastMouse.current = { x: e.clientX, y: e.clientY, ready: true };
        return;
      }
      const dx = (e.clientX - lastMouse.current.x) / window.innerWidth;
      const dy = (e.clientY - lastMouse.current.y) / window.innerHeight;
      lastMouse.current = { x: e.clientX, y: e.clientY, ready: true };
      // 累计位移（clamp 到 -1~1），鼠标停下/离开时 offset 冻结在最后值，不会回归 0
      setOffset(prev => ({
        x: Math.max(-1, Math.min(1, prev.x + dx * 4)),
        y: Math.max(-1, Math.min(1, prev.y + dy * 4)),
      }));
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);
  return (
    <div aria-hidden className="fixed inset-x-0 bottom-0 z-0 flex h-[45vh] select-none flex-col items-center justify-center overflow-hidden bg-brand-deep">
      {LINES.map((line, li) => (
        <div key={li} className="flex items-center gap-[0.8vw]">
          {line.map((char, ci) => {
            const f = FACTORS[li === 0 ? ci : LINES[0].length + ci];
            return (
              <span
                key={`${li}-${ci}`}
                className="text-[22vw] font-black leading-[.85] text-paper/[0.09]"
                style={{
                  transform: `translate3d(${offset.x * f.x}px, ${f.baseY + offset.y * f.y}px, 0)`,
                  transition: 'transform 350ms cubic-bezier(.22,1,.36,1)',
                }}
              >
                {char}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}
