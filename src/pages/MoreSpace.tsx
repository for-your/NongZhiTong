import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight, BookOpen, Calculator, CalendarDays, ChevronRight, Clock3,
  MessageCircleQuestion, Newspaper, RefreshCw, Search, Sparkles, Users,
} from 'lucide-react';
import PageTransition from '@/components/layout/PageTransition';
import AnimatedSection from '@/components/ui/AnimatedSection';
import { Lunar } from 'lunar-typescript';
import { fetchKnowledgeArticles, HERO_IMAGES, KNOWLEDGE_CATEGORIES, type CategoryArticle } from '@/lib/news';
import { useAutoRefresh } from '@/lib/useAutoRefresh';

// 通用专栏（常设知识内容）：真实新闻数量不足时按分类补齐（每类 6 篇起步）
const generalPool: Record<string, Array<{ title: string; summary: string }>> = {
  市场观察: [
    { title: '冷链物流：生鲜农产品溢价的关键一环', summary: '预冷、冷藏车与周转箱，减少损耗就是增加收入。' },
    { title: '电商助农：直播间之外的销售渠道盘点', summary: '社区团购、企业直采与订单农业，多渠道分散风险。' },
    { title: '产地批发价与田头价：价差里的出手时机', summary: '读懂两种价格的价差变化，把握农产品最佳出手窗口。' },
    { title: '农产品质量安全追溯：卖上价的第一步', summary: '一证一码看懂溯源体系，让好产品卖出信任价。' },
    { title: '仓储保鲜：产地初加工的增值第一步', summary: '预冷分选与分级包装，田头到收购商的第一道溢价。' },
    { title: '订单农业：先找市场再下种的避险逻辑', summary: '锁价签单再生产，减少丰产不丰收的波动风险。' },
  ],
  病虫害防治: [
    { title: '小麦赤霉病防治：抽穗扬花期是关键窗口', summary: '见花打药、看天补防，一次到位控制病害基数。' },
    { title: '草地贪夜蛾监测：看叶见虫早发现', summary: '聚焦心叶与喇叭口，发现初孵幼虫立即点片防治。' },
    { title: '病虫害绿色防控：从清园到天敌防治', summary: '减少化学农药依赖，生态调控与生物防治组合拳。' },
    { title: '科学安全用药：读懂农药标签上的关键信息', summary: '剂型、含量、安全间隔期，标签看懂再用约。' },
    { title: '田间巡田十步法：把虫口密度看在眼里', summary: '定株定行取样，早发现早控制，少打一次药。' },
    { title: '抗药性治理：同一类药剂不要连着用', summary: '轮换作用机制不同的药剂，延缓防效下降。' },
  ],
  土壤管理: [
    { title: '酸化与盐渍化：大棚土壤的两大隐形杀手', summary: '覆膜控盐、施用调理剂，把酸碱度调回适宜区。' },
    { title: '测土配方施肥：一张配方卡省下的肥料钱', summary: '按土供肥、缺啥补啥，避免盲目过量投入。' },
    { title: '土壤墒情怎么判断：手捏看色两步法', summary: '不靠仪器也能快速判断旱情，决定是否灌溉。' },
    { title: '有机质提升：秸秆还田与有机肥配施要点', summary: '培肥地力的两条主路，用量与时机有讲究。' },
    { title: '耕层变浅与犁底层：深松什么时候做', summary: '打破板结层让根系下扎，雨季前深松效果最好。' },
    { title: '水溶肥怎么用：少量多次的追肥节奏', summary: '随水施肥讲究浓度与频率，避免烧根伤苗。' },
  ],
  气候适应: [
    { title: '倒春寒来了：果树与蔬菜的应急防护', summary: '熏烟、覆盖与喷防冻剂，寒潮前后的三步应对。' },
    { title: '洪涝过后：受淹田块的补救与改种建议', summary: '排水洗苗、补施肥料与改种决策的时间窗。' },
    { title: '设施农业防风防冻：四季巡查清单', summary: '大棚加固、保温与通风的日常检查要点。' },
    { title: '高温干旱与连阴雨：两类极端天气的田管要点', summary: '极端天气前后，水分与病害管理的应对预案。' },
    { title: '干热风来了：灌浆期小麦的应急补水', summary: '避开正午高温时段补水降温，减轻灌浆受阻。' },
    { title: '秋季连阴雨：抢收晾晒与籽粒含水率', summary: '含水率超标先烘干再入仓，霉变损失降到最低。' },
  ],
  新技术: [
    { title: '物联网监测：大棚里的传感器都看什么', summary: '温湿度、光照与土壤数据，手机上远程看棚。' },
    { title: '手机识别病虫害：AI 诊断的用法与边界', summary: '拍照角度决定准确率，疑难杂症仍需人工复核。' },
    { title: '无人机植保作业：飞防前的田块准备', summary: '航线规划、药液配比与避让事项，安全飞防。' },
    { title: '水肥一体化：省水省肥的滴灌系统入门', summary: '滴灌带选型与施肥制度，小成本用上新技术。' },
    { title: '农业无人车与巡田机器人：能干什么了', summary: '从巡田查苗到定向喷施，机器换人的现实进度。' },
    { title: '卫星遥感估产：一张图看懂长势差异', summary: 'NDVI 指数分辨旺弱苗，变量施肥有的放矢。' },
  ],
};

const categories = KNOWLEDGE_CATEGORIES;

interface ArticleItem {
  title: string;
  category: string;
  type: string;
  date: string;
  minutes: number;
  image: string;
  size: 'large' | 'small';
  featured?: boolean;
  /** 真实新闻的原文链接（存在时新窗口打开） */
  url?: string;
  /** 原文摘要 / 专栏简介 */
  summary?: string;
}

// 本地精选专栏：真实新闻源不可用时的回落展示
const fallbackArticles: ArticleItem[] = [
  {
    title: '高温之后，玉米田最需要关注的三个信号',
    category: '气候适应', type: '深度文章', date: '8 月 28 日', minutes: 6,
    image: 'https://images.pexels.com/photos/9560384/pexels-photo-9560384.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    size: 'large', featured: true,
  },
  {
    title: '不用背参数：看懂一次土壤检测报告',
    category: '土壤管理', type: '入门指南', date: '8 月 24 日', minutes: 4,
    image: 'https://images.pexels.com/photos/27793706/pexels-photo-27793706.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    size: 'small',
  },
  {
    title: '叶片上的第一处异常，往往比你想象的更重要',
    category: '病虫害防治', type: '现场笔记', date: '8 月 19 日', minutes: 5,
    image: 'https://images.pexels.com/photos/16678079/pexels-photo-16678079.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    size: 'small',
  },
  {
    title: '温室里的新工具：让每一次灌溉更有依据',
    category: '新技术', type: '技术观察', date: '8 月 12 日', minutes: 7,
    image: 'https://images.pexels.com/photos/36917505/pexels-photo-36917505.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    size: 'small',
  },
  {
    title: '新季水果上市前，如何找到最合适的销售窗口？',
    category: '市场观察', type: '行情解读', date: '8 月 2 日', minutes: 5,
    image: 'https://images.pexels.com/photos/36838598/pexels-photo-36838598.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    size: 'small',
  },
];

// 背景图左右滑动过渡（同首页 Hero 设计）
const heroVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? '100%' : '-100%' }),
  center: { x: '0%' },
  exit: (dir: number) => ({ x: dir > 0 ? '-100%' : '100%' }),
};
const HERO_EASE = [0.32, 0.72, 0, 1] as const;

export default function MoreSpace() {
  const [articles, setArticles] = useState<ArticleItem[]>(fallbackArticles);
  const [openTool, setOpenTool] = useState<'calc' | 'calendar' | 'profit' | null>(null);
  const [newsReal, setNewsReal] = useState(false);
  const [[heroIdx, heroDir], setHeroState] = useState<[number, number]>([0, 1]);
  const goHero = (target: number) =>
    setHeroState(([cur]) => {
      const t = ((target % HERO_IMAGES.length) + HERO_IMAGES.length) % HERO_IMAGES.length;
      return [t, t >= cur ? 1 : -1] as [number, number];
    });
  const [category, setCategory] = useState('市场观察');
  const [keyword, setKeyword] = useState('');
  const [selectedArticle, setSelectedArticle] = useState<ArticleItem | null>(null);

  // Hero 背景图自动轮播
  useEffect(() => {
    const t = setInterval(() => setHeroState(([cur]) => [(cur + 1) % HERO_IMAGES.length, 1] as [number, number]), 6000);
    return () => clearInterval(t);
  }, []);

  // 真实文章：按分类栏目抓取部要闻，每类补齐 6 篇（不足用通用专栏填充）；
  // 每 5 分钟自动刷新 + 回到前台补刷 + 徽标点击手动刷新（实时链路）
  const [newsAt, setNewsAt] = useState('');
  const [newsRefreshing, setNewsRefreshing] = useState(false);
  const newsSeq = useRef(0);
  const loadKnowledge = useCallback(() => {
    const seq = ++newsSeq.current;
    setNewsRefreshing(true);
    fetchKnowledgeArticles(generalPool)
      .then((byCategory) => {
        if (seq !== newsSeq.current) return;
        const merged: ArticleItem[] = [];
        KNOWLEDGE_CATEGORIES.forEach((cat) => {
          (byCategory[cat] ?? []).forEach((a: CategoryArticle) => {
            const d = new Date(a.date);
            const date = a.sourceKind === 'local' ? '本地资料' : Number.isNaN(d.getTime()) ? '日期待核对' : `${d.getMonth() + 1} 月 ${d.getDate()} 日`;
            merged.push({
              title: a.title,
              category: cat,
              type: a.sourceKind === 'remote' ? '部要闻' : '本地专栏',
              date,
              minutes: Math.max(3, Math.round(a.title.length / 15)),
              image: a.image,
              size: merged.length === 0 ? 'large' : 'small',
              featured: merged.length === 0,
              url: a.url,
              summary: a.summary,
            });
          });
        });
        if (merged.length) {
          setNewsReal(merged.some((article) => Boolean(article.url)));
          setArticles(merged);
          setNewsAt(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }));
        }
      })
      .catch(() => { /* 回落本地专栏 */ })
      .finally(() => { if (seq === newsSeq.current) setNewsRefreshing(false); });
  }, []);
  const refreshKnowledge = useAutoRefresh(loadKnowledge);
  useEffect(() => {
    loadKnowledge();
  }, [loadKnowledge]);

  const filtered = useMemo(() => {
    const kw = keyword.trim();
    return articles.filter((a) => {
      const byKeyword = !kw || a.title.includes(kw) || a.category.includes(kw) || a.type.includes(kw);
      return a.category === category && byKeyword;
    });
  }, [articles, category, keyword]);

  return <PageTransition>
    <main className="bg-paper">
      {/* Hero：标题 + 搜索 + 数据条（满幅贴顶，与首页 Hero 同基准） */}
      <section className="relative overflow-hidden bg-brand-deep px-5 pb-20 pt-32 lg:px-8">
        <div className="grain-overlay" />
        {/* 背景图轮播：左右循环滑动（同首页 Hero 设计） */}
        <AnimatePresence initial={false} custom={heroDir}>
          <motion.img
            key={heroIdx}
            src={HERO_IMAGES[heroIdx]}
            alt=""
            custom={heroDir}
            variants={heroVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.7, ease: HERO_EASE }}
            className="absolute inset-x-0 top-0 h-full w-full object-cover opacity-45"
          />
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-b from-brand-deep via-brand-deep/40 to-brand-deep/20" />
        <div className="absolute inset-0 opacity-20">
          <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full border border-white/30" />
          <div className="absolute bottom-[-100px] left-1/4 h-72 w-72 rounded-full border border-gold/50" />
        </div>
        <div className="relative mx-auto max-w-7xl">
          <p className="text-caption font-semibold uppercase tracking-[.2em] text-gold">Knowledge space</p>
          <h1 className="mt-5 max-w-3xl font-display text-display font-bold leading-[1.04] tracking-[-.02em] text-white">
            知识空间，<br />
            <span className="text-brand-line">让经验流动起来。</span>
          </h1>
          <p className="mt-7 max-w-xl text-base leading-7 text-white/65">
            一处面向农业从业者的开放知识库。找到知识、工具和那些正在发生的真实故事。
          </p>

          <div className="mt-9 flex w-full max-w-xl items-center gap-2 rounded-full bg-white p-2 shadow-md">
            <Search className="ml-3 h-4 w-4 shrink-0 text-subtle" />
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索病虫害、土壤、行情…"
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-subtle"
            />
            {keyword && (
              <button onClick={() => setKeyword('')} className="rounded-full px-3 py-1.5 text-caption font-semibold text-muted transition hover:bg-brand-tint" aria-label="清空搜索">
                清空
              </button>
            )}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3 text-caption font-semibold text-white/55">
            <span className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-brand-line" />{articles.length} 篇一线笔记</span>
            <span className="flex items-center gap-2"><Newspaper className="h-4 w-4 text-brand-line" />{categories.length} 大主题</span>
            <span className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-brand-line" />持续更新中</span>
          </div>
        </div>
        <div className="relative mx-auto mt-9 flex max-w-7xl gap-2 px-5 lg:px-8">
          {HERO_IMAGES.map((_, i) => (
            <button
              key={i}
              onClick={() => goHero(i)}
              aria-label={`切换到第 ${i + 1} 张背景图`}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === heroIdx ? 'w-8 bg-gold' : 'w-3 bg-white/30 hover:bg-white/60'}`}
            />
          ))}
        </div>
      </section>

      {/* 精选内容：分类筛选 + 文章卡片 */}
      <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <AnimatedSection>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-display text-h2 font-bold tracking-[-.015em] text-ink">精选内容</h2>
              <button
                type="button"
                onClick={() => refreshKnowledge()}
                aria-label="刷新实时文章"
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-caption font-bold transition ${newsReal ? 'bg-brand-tint text-brand hover:bg-brand hover:text-white' : 'bg-gold-soft text-gold-deep'}`}
              >
                <RefreshCw className={`h-3 w-3 ${newsRefreshing ? 'animate-spin' : ''}`} />
                {newsReal ? `原文 · 农业农村部${newsAt ? ` · 获取于 ${newsAt}` : ''}` : newsRefreshing ? '加载中…' : '本地资料'}
              </button>
            </div>
            <p className="mt-2 text-sm text-muted">从一线经验出发，继续理解土地。</p>
          </AnimatedSection>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {categories.map((item) => (
              <button
                key={item}
                onClick={() => setCategory(item)}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-caption font-semibold transition ${
                  category === item
                    ? 'bg-brand text-white'
                    : 'border border-faint bg-white text-muted hover:border-brand-line hover:text-brand'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {filtered.length > 0 ? (
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {filtered.map((article, index) => {
              const card = (
                <motion.article
                  key={article.title}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  role={!article.url ? 'button' : undefined}
                  tabIndex={!article.url ? 0 : undefined}
                  onClick={!article.url ? () => setSelectedArticle(article) : undefined}
                  onKeyDown={!article.url ? (event) => { if (event.key === 'Enter' || event.key === ' ') setSelectedArticle(article); } : undefined}
                  className={`group relative h-full overflow-hidden rounded-3xl ${article.size === 'large' ? 'min-h-[440px]' : 'min-h-[300px]'}`}
                >
                  <img src={article.image} alt={article.title} className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-brand-deep/90 via-brand-deep/15 to-transparent" />
                <div className="relative flex h-full min-h-[inherit] flex-col justify-end p-6 md:p-8">
                  <div className="mb-auto flex items-start justify-between">
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-white/15 px-3 py-1.5 text-caption font-bold text-white backdrop-blur">{article.type}</span>
                      {article.featured && (
                        <span className="flex items-center gap-1 rounded-full bg-gold px-3 py-1.5 text-caption font-bold text-gold-deep">
                          <Sparkles className="h-3 w-3" />编辑精选
                        </span>
                      )}
                    </div>
                    <span className="text-4xl font-bold text-white/25">0{index + 1}</span>
                  </div>
                  <div>
                    <p className="text-caption font-semibold text-gold">{article.category}</p>
                    <h3 className={`mt-2 font-display font-bold leading-tight tracking-[-.015em] text-white ${article.size === 'large' ? 'max-w-xl text-3xl md:text-4xl' : 'text-xl'}`}>
                      {article.title}
                    </h3>
                    {article.summary && (
                      <p className={`mt-2 leading-6 text-white/70 ${article.size === 'large' ? 'max-w-xl text-sm' : 'line-clamp-2 text-caption'}`}>{article.summary}</p>
                    )}
                    <div className="mt-4 flex items-center justify-between">
                      <span className="flex items-center gap-3 text-caption text-white/60">
                        <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{article.date}</span>
                        <span className="flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />阅读 {article.minutes} 分钟</span>
                      </span>
                      <span className="inline-flex items-center gap-2 text-caption font-semibold text-white/80 transition group-hover:text-white">
                        阅读内容 <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                      </span>
                    </div>
                  </div>
                </div>
              </motion.article>
              );
              // 真实新闻外链原文（新窗口）；本地专栏直接渲染
              return article.url ? (
                <a key={article.title} href={article.url} target="_blank" rel="noreferrer" className="block h-full">
                  {card}
                </a>
              ) : (
                card
              );
            })}
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mt-10 flex flex-col items-center rounded-3xl border border-dashed border-brand-tint bg-white/60 px-6 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-tint text-brand">
              <MessageCircleQuestion className="h-7 w-7" />
            </span>
            <p className="mt-5 text-base font-bold text-ink">没有找到与「{keyword || category}」相关的内容</p>
            <p className="mt-2 max-w-sm text-sm leading-6 text-muted">知识空间正在持续更新。你也可以现在就把问题交给 AI 专家。</p>
            <Link to="/assistant" className="mt-6 inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-bold text-white shadow-md transition hover:bg-brand-deep">
              去问问智能助手 <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        )}
      </section>

      <AnimatePresence>
        {selectedArticle && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedArticle(null)}
          >
            <motion.article
              role="dialog"
              aria-modal="true"
              aria-label={selectedArticle.title}
              className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-paper p-6 shadow-2xl sm:p-8"
              initial={{ y: 18, scale: 0.98 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 18, scale: 0.98 }}
              onClick={(event) => event.stopPropagation()}
            >
              <p className="text-caption font-semibold uppercase tracking-[.18em] text-brand">本地资料 · {selectedArticle.category}</p>
              <h2 className="mt-3 font-display text-h3 font-bold leading-tight text-ink">{selectedArticle.title}</h2>
              <p className="mt-4 text-sm leading-7 text-muted">{selectedArticle.summary || '这是一条待补充正文的本地资料卡。比赛演示中应替换为经过审核的全文、来源和更新时间。'}</p>
              <button type="button" onClick={() => setSelectedArticle(null)} className="mt-6 rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-deep">关闭阅读</button>
            </motion.article>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 实用工具：真实可用的农事小工具 */}
      <section className="bg-white px-5 py-20 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <AnimatedSection>
            <p className="text-caption font-semibold uppercase tracking-[.2em] text-brand">Useful in the field</p>
            <h2 className="mt-4 font-display text-h1 font-bold tracking-[-.015em] text-ink">把工具带进你的日常</h2>
            <p className="mt-3 text-sm text-muted">点开即用的真实农事小工具，算完就能下地。</p>
          </AnimatedSection>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <ToolCard icon={Calculator} title="用药稀释计算器" text="按稀释倍数或亩用量，算出准确的兑水与用药量。" open={openTool === 'calc'} onToggle={() => setOpenTool(openTool === 'calc' ? null : 'calc')}>
              <DilutionPanel />
            </ToolCard>
            <ToolCard icon={CalendarDays} title="农事节气日历" text="当前节气、下一节气与倒计时，按历法实时计算。" open={openTool === 'calendar'} onToggle={() => setOpenTool(openTool === 'calendar' ? null : 'calendar')}>
              <FarmCalendarPanel />
            </ToolCard>
            <ToolCard icon={Users} title="种植收益测算器" text="面积 × 产量 × 价格 − 成本，算清每亩净利。" open={openTool === 'profit'} onToggle={() => setOpenTool(openTool === 'profit' ? null : 'profit')}>
              <ProfitPanel />
            </ToolCard>
          </div>
        </div>
      </section>

      {/* 订阅能力说明 */}
      <section className="bg-brand-tint px-5 py-16 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-7 md:flex-row md:items-center">
          <div>
            <p className="font-display text-h3 font-bold tracking-[-.015em] text-brand-deep">把新内容送到你的田间邮箱</p>
            <p className="mt-2 text-sm text-muted">邮件订阅需要服务端任务与用户授权，当前版本先展示可复现的知识阅读和农事工具。</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-bold text-brand shadow-sm"><Sparkles className="h-4 w-4" />服务端接入后开放</span>
        </div>
      </section>
    </main>
  </PageTransition>;
}

// —— 工具卡：点击展开功能面板 ——
function ToolCard({ icon: Icon, title, text, open, onToggle, children }: {
  icon: typeof Calculator; title: string; text: string; open: boolean; onToggle: () => void; children: ReactNode;
}) {
  return (
    <motion.div layout className={`rounded-2xl bg-paper transition-shadow ${open ? 'border border-brand-line shadow-lg' : 'border border-faint hover:shadow-lg'}`}>
      <button onClick={onToggle} className="w-full p-6 text-left" aria-expanded={open}>
        <span className="flex items-center justify-between">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-tint">
            <Icon className="h-6 w-6 text-brand" />
          </span>
          <ChevronRight className={`h-5 w-5 text-subtle transition-transform duration-300 ${open ? 'rotate-90' : ''}`} />
        </span>
        <span className="mt-4 block text-lg font-bold text-ink">{title}</span>
        <span className="mt-2 block text-sm leading-6 text-muted">{text}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28 }} className="overflow-hidden">
            <div className="border-t border-faint px-6 pb-6 pt-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const num = (s: string): number => { const v = parseFloat(s); return Number.isFinite(v) ? v : 0; };
const fmtWeight = (g: number): string => (g >= 1000 ? `${(g / 1000).toFixed(2)} kg` : `${Math.round(g * 100) / 100} g`);
const field = 'w-full rounded-xl border border-faint bg-white px-3 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20';
const resultBox = 'rounded-xl bg-brand-tint px-4 py-3 text-sm font-bold text-brand-deep';

// —— 面板 1：用药稀释计算器（倍数法 / 亩用量法，真实计算） ——
function DilutionPanel() {
  const [mode, setMode] = useState<'ratio' | 'perMu'>('ratio');
  const [water, setWater] = useState('15');
  const [ratio, setRatio] = useState('800');
  const [area, setArea] = useState('2');
  const [perMuDrug, setPerMuDrug] = useState('50');
  const [perMuWater, setPerMuWater] = useState('30');
  let drug = 0;
  let waterTotal = 0;
  if (mode === 'ratio') {
    waterTotal = num(water);
    drug = (waterTotal * 1000) / Math.max(1, num(ratio));
  } else {
    const a = Math.max(0, num(area));
    drug = num(perMuDrug) * a;
    waterTotal = num(perMuWater) * a;
  }
  return (
    <div className="space-y-3 text-sm">
      <div className="flex gap-1.5">
        <button onClick={() => setMode('ratio')} className={`flex-1 rounded-full px-3 py-1.5 text-caption font-semibold transition ${mode === 'ratio' ? 'bg-brand text-white' : 'border border-faint text-muted'}`}>按稀释倍数</button>
        <button onClick={() => setMode('perMu')} className={`flex-1 rounded-full px-3 py-1.5 text-caption font-semibold transition ${mode === 'perMu' ? 'bg-brand text-white' : 'border border-faint text-muted'}`}>按亩用量</button>
      </div>
      {mode === 'ratio' ? (
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1"><span className="text-caption text-muted">水量（升）</span><input value={water} onChange={(e) => setWater(e.target.value)} inputMode="decimal" className={field} /></label>
          <label className="space-y-1"><span className="text-caption text-muted">稀释倍数</span><input value={ratio} onChange={(e) => setRatio(e.target.value)} inputMode="decimal" className={field} /></label>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <label className="space-y-1"><span className="text-caption text-muted">面积（亩）</span><input value={area} onChange={(e) => setArea(e.target.value)} inputMode="decimal" className={field} /></label>
          <label className="space-y-1"><span className="text-caption text-muted">亩用药（克）</span><input value={perMuDrug} onChange={(e) => setPerMuDrug(e.target.value)} inputMode="decimal" className={field} /></label>
          <label className="space-y-1"><span className="text-caption text-muted">亩用水（升）</span><input value={perMuWater} onChange={(e) => setPerMuWater(e.target.value)} inputMode="decimal" className={field} /></label>
        </div>
      )}
      <div className={resultBox}>
        需药量 {fmtWeight(drug)} ｜ 兑水 {Math.round(waterTotal * 10) / 10} 升
      </div>
      <p className="text-caption leading-5 text-subtle">提示：先加一半水再入药搅匀（二次稀释法），全程戴手套口罩。</p>
    </div>
  );
}

// —— 面板 2：农事节气日历（lunar-typescript 实时计算） ——
function FarmCalendarPanel() {
  const data = useMemo(() => {
    const names = ['立春', '雨水', '惊蛰', '春分', '清明', '谷雨', '立夏', '小满', '芒种', '夏至', '小暑', '大暑', '立秋', '处暑', '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至', '小寒', '大寒'];
    const collect = (y: number) =>
      Object.entries(Lunar.fromDate(new Date(y, 5, 1)).getJieQiTable())
        .filter(([name]) => names.includes(name))
        .map(([name, solar]) => ({
          name,
          date: new Date(solar.getYear(), solar.getMonth() - 1, solar.getDay()),
        }));
    const now = new Date();
    const all = [...collect(now.getFullYear() - 1), ...collect(now.getFullYear()), ...collect(now.getFullYear() + 1)]
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    const seen = new Set<string>();
    const uniq = all.filter((t) => { const k = `${t.name}-${t.date.getTime()}`; if (seen.has(k)) return false; seen.add(k); return true; });
    let curIdx = 0;
    uniq.forEach((t, i) => { if (t.date.getTime() <= now.getTime()) curIdx = i; });
    const fmt = (d: Date) => `${d.getMonth() + 1} 月 ${d.getDate()} 日`;
    const todayTs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return {
      current: { ...uniq[curIdx], label: fmt(uniq[curIdx].date) },
      upcoming: uniq.slice(curIdx + 1, curIdx + 4).map((t) => ({
        ...t,
        label: fmt(t.date),
        days: Math.ceil((t.date.getTime() - todayTs) / 86400000),
      })),
    };
  }, []);
  return (
    <div className="space-y-3 text-sm">
      <div className={resultBox}>
        当前节气：<span className="font-black">{data.current.name}</span>
        <span className="ml-2 text-caption font-semibold text-muted">{data.current.label}</span>
      </div>
      <div className="space-y-2">
        <p className="text-caption font-bold uppercase tracking-wider text-subtle">即将到来</p>
        {data.upcoming.map((t) => (
          <div key={`${t.name}-${t.date.getTime()}`} className="flex items-center justify-between rounded-xl bg-brand-tint px-3 py-2">
            <span className="font-semibold text-brand-deep">{t.name}</span>
            <span className="text-xs text-muted">{t.label} · 还有 {t.days} 天</span>
          </div>
        ))}
      </div>
      <p className="text-caption leading-5 text-subtle">交节日期由历法库精确计算，每年自动更新。</p>
    </div>
  );
}

// —— 面板 3：种植收益测算器（真实计算） ——
function ProfitPanel() {
  const [area, setArea] = useState('10');
  const [yieldMu, setYieldMu] = useState('1200');
  const [price, setPrice] = useState('1.5');
  const [cost, setCost] = useState('8000');
  const a = Math.max(0, num(area));
  const totalYield = a * num(yieldMu);
  const revenue = totalYield * num(price);
  const profit = revenue - num(cost);
  const fmtMoney = (v: number) => `${Math.round(v).toLocaleString('zh-CN')} 元`;
  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1"><span className="text-caption text-muted">面积（亩）</span><input value={area} onChange={(e) => setArea(e.target.value)} inputMode="decimal" className={field} /></label>
        <label className="space-y-1"><span className="text-caption text-muted">亩产（斤）</span><input value={yieldMu} onChange={(e) => setYieldMu(e.target.value)} inputMode="decimal" className={field} /></label>
        <label className="space-y-1"><span className="text-caption text-muted">收购价（元/斤）</span><input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" className={field} /></label>
        <label className="space-y-1"><span className="text-caption text-muted">总成本（元）</span><input value={cost} onChange={(e) => setCost(e.target.value)} inputMode="decimal" className={field} /></label>
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-muted"><span>预计总产量</span><span className="font-bold">{Math.round(totalYield).toLocaleString('zh-CN')} 斤</span></div>
        <div className="flex justify-between text-xs text-muted"><span>预计总产值</span><span className="font-bold">{fmtMoney(revenue)}</span></div>
        <div className={resultBox + ' flex justify-between'}>
          <span>净利润</span><span>{fmtMoney(profit)}</span>
        </div>
        <div className="flex justify-between text-xs text-muted"><span>每亩净利</span><span className="font-bold text-brand">{a > 0 ? `${Math.round(profit / a).toLocaleString('zh-CN')} 元/亩` : '—'}</span></div>
      </div>
      <p className="text-caption leading-5 text-subtle">结果为静态测算，未含价格波动；行情判断可问「市场观察」专家。</p>
    </div>
  );
}
