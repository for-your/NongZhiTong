import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion, useScroll, useTransform, type Variants } from 'framer-motion';
import PillButton from './PillButton';

const slides = [
  {
    image: 'https://images.pexels.com/photos/9560384/pexels-photo-9560384.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    alt: '无人机俯瞰整齐的农田',
    eyebrow: '智能预警 · Early warning',
    lead: '风险来临之前，',
    highlight: '先一步看见',
    text: '天气、灾害与病虫害趋势被提前研判，变成可以早做准备的清晰提醒。',
    cta: { label: '和预警专家聊聊', href: '/assistant' },
    more: { label: '查看预警能力', href: '/space' },
  },
  {
    image: 'https://images.pexels.com/photos/16678079/pexels-photo-16678079.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    alt: '特写镜头下的作物叶片',
    eyebrow: '智能诊断 · AI diagnosis',
    lead: '一片叶子的异常，',
    highlight: '也逃不过 AI 的眼睛',
    text: '拍一张照片，AI 在问题扩大之前，给出专业的判断与防治方案。',
    cta: { label: '和诊断专家聊聊', href: '/assistant' },
    more: { label: '了解诊断能力', href: '/space' },
  },
  {
    image: 'https://images.pexels.com/photos/36838598/pexels-photo-36838598.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    alt: '现代农业温室与丰收的作物',
    eyebrow: '智能销售 · Smart sales',
    lead: '好收成，',
    highlight: '也要卖出好价格',
    text: '行情趋势与渠道建议，让每一份农产品找到更合适的去处。',
    cta: { label: '和销售专家聊聊', href: '/assistant' },
    more: { label: '探索销售建议', href: '/space' },
  },
];

const SLIDE_INTERVAL = 6000;
// iOS 风格缓动曲线，横移全程平滑无顿挫
const SLIDE_EASE = [0.32, 0.72, 0, 1] as const;

// 背景图：新旧两张并排横移，任何时刻都完整覆盖画面，不会露出底色
const imageVariants: Variants = {
  enter: (direction: number) => ({ x: direction > 0 ? '100%' : '-100%' }),
  center: { x: '0%' },
  exit: (direction: number) => ({ x: direction > 0 ? '-100%' : '100%' }),
};

// 文案与按钮：跟随同方向小幅滑入滑出
const textVariants: Variants = {
  enter: (direction: number) => ({ x: direction > 0 ? 80 : -80, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { duration: 0.55, ease: 'easeOut' } },
  exit: (direction: number) => ({ x: direction > 0 ? -80 : 80, opacity: 0, transition: { duration: 0.3, ease: 'easeIn' } }),
};

export default function HeroSection() {
  const [[index, direction], setSlide] = useState<[number, number]>([0, 1]);
  const [paused, setPaused] = useState(false);
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 600], [0, 160]);

  const paginate = useCallback((dir: number) => {
    setSlide(([current]) => [(current + dir + slides.length) % slides.length, dir]);
  }, []);

  const goTo = (target: number) => {
    setSlide(([current]) => [target, target >= current ? 1 : -1]);
  };

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => paginate(1), SLIDE_INTERVAL);
    return () => clearInterval(timer);
  }, [paused, paginate]);

  const slide = slides[index];

  return (
    <section
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="relative flex min-h-[720px] items-end overflow-hidden bg-brand-deep pt-32"
    >
      <motion.div style={{ y }} className="absolute inset-0">
        <AnimatePresence initial={false} custom={direction}>
          <motion.img
            key={index}
            src={slide.image}
            alt={slide.alt}
            custom={direction}
            variants={imageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.7, ease: SLIDE_EASE }}
            className="absolute inset-x-0 top-0 h-[calc(100%+180px)] w-full object-cover opacity-55"
          />
        </AnimatePresence>
        {/* 漂浮光晕：绿金两色缓慢浮动，营造晨雾田野的光感 */}
        <div className="absolute -left-24 top-1/3 h-96 w-96 animate-float rounded-full bg-brand/25 blur-3xl" />
        <div className="absolute -right-16 top-10 h-72 w-72 animate-float rounded-full bg-gold/15 blur-3xl [animation-delay:1.2s]" />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-deep via-brand-deep/50 to-brand-deep/25" />
        <div className="grain-overlay" />
      </motion.div>

      <div className="absolute right-[12%] top-1/4 h-28 w-28 rounded-full border border-white/20" />
      <div className="absolute right-[15%] top-[29%] h-2.5 w-2.5 rounded-full bg-gold shadow-[0_0_0_10px_rgba(232,168,62,.15)]" />

      <div className="relative mx-auto w-full max-w-[1240px] px-5 pb-20 lg:px-8 lg:pb-28">
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.div key={index} custom={direction} variants={textVariants} initial="enter" animate="center" exit="exit" className="max-w-4xl">
            <p className="mb-6 text-caption font-semibold uppercase tracking-[.22em] text-gold">{slide.eyebrow}</p>
            <h1 className="max-w-4xl font-display text-[clamp(2.5rem,5.4vw,4.5rem)] font-bold leading-[1.06] tracking-[-.02em] text-white">
              {slide.lead}
              <br />
              <span className="bg-gradient-to-r from-[#e6f5d5] via-brand-line to-[#8fd0a0] bg-clip-text text-transparent">
                {slide.highlight}
              </span>
            </h1>
            <p className="mt-7 max-w-xl text-lede leading-7 text-white/75">{slide.text}</p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <PillButton href={slide.cta.href}>{slide.cta.label}</PillButton>
              <PillButton href={slide.more.href} variant="outline">
                {slide.more.label}
              </PillButton>
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="mt-10 flex items-center gap-2.5">
          {slides.map((item, i) => (
            <button
              key={item.eyebrow}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`切换到第 ${i + 1} 张：${item.highlight}`}
              className={`h-[3px] rounded-full transition-all duration-500 ease-out-soft ${
                i === index ? 'w-10 bg-gold' : 'w-4 bg-white/25 hover:bg-white/50'
              }`}
            />
          ))}
        </div>
      </div>

      {/* 底部主题跑马灯：无缝循环滚动 */}
      <div className="absolute inset-x-0 bottom-0 overflow-hidden border-t border-white/10 py-3.5">
        <div className="flex w-max animate-ticker items-center whitespace-nowrap">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex items-center">
              {['智能预警', '科学诊断', '合理销售', '农事知识', 'AI 看田', '数据助农'].map((word) => (
                <span key={word} className="flex items-center text-caption font-semibold uppercase tracking-[.35em] text-white/35">
                  <span className="px-8">{word}</span>
                  <span className="text-gold/60">✦</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="absolute bottom-16 right-6 hidden text-caption uppercase tracking-[.2em] text-white/45 lg:block">
        <span className="mr-3 inline-block h-px w-12 bg-white/30 align-middle" />
        Scroll to grow
      </div>
    </section>
  );
}
