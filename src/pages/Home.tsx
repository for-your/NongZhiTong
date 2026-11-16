import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, ChevronLeft, ChevronRight, Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Droplets, MapPin, RefreshCw, ScanSearch, Sun, TrendingUp, Wind } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lunar } from 'lunar-typescript';
import { fetchChengduWeather, fetchWeatherAt, resolveLocation, type WeatherData } from '@/lib/weather';
import { fetchMoaNews, splitDate } from '@/lib/news';
import { useAutoRefresh } from '@/lib/useAutoRefresh';
import PageTransition from '@/components/layout/PageTransition';
import HeroSection from '@/components/ui/HeroSection';

// 24 节气农事提示（通用农谚知识，交节日期由 lunar-typescript 精确计算）
const termInfo: Record<string, { text: string; tips: [string, string] }> = {
  立春: { text: '东风解冻，春耕备耕开始。检修农具与灌溉设施，为全年开个好头。', tips: ['宜：备耕', '关注：倒春寒'] },
  雨水: { text: '降雨渐多，追肥松土正当时，低洼田块注意排涝防渍。', tips: ['宜：追肥', '关注：连阴雨'] },
  惊蛰: { text: '春雷始鸣，越冬虫害开始活跃，提前清园压低病虫基数。', tips: ['宜：清园防虫', '关注：病虫出蛰'] },
  春分: { text: '昼夜平分，早稻育秧、春播作物陆续下地，看天抢晴播种。', tips: ['宜：育秧播种', '关注：低温阴雨'] },
  清明: { text: '气清景明，春播定植正当时，茶园进入采摘高峰。', tips: ['宜：播种定植', '关注：晚霜'] },
  谷雨: { text: '雨生百谷，大田作物抢墒播种，湿度大时防湿害病害。', tips: ['宜：抢墒播种', '关注：湿害'] },
  立夏: { text: '夏季开始，田间管理进入旺季，及时中耕追肥促壮苗。', tips: ['宜：中耕追肥', '关注：干热风'] },
  小满: { text: '籽粒渐满，麦田防干热风，水稻分蘖期管好水浆。', tips: ['宜：水浆管理', '关注：干热风'] },
  芒种: { text: '有芒快收、有谷可种，三夏大忙，抢收抢种两头赶。', tips: ['宜：抢收抢种', '关注：连阴雨'] },
  夏至: { text: '白昼最长，作物生长旺盛，重点做好抗旱与防涝两手准备。', tips: ['宜：排灌调节', '关注：高温干旱'] },
  小暑: { text: '暑气上升，抗旱浇灌不能停，病虫防治要跟上。', tips: ['宜：抗旱浇灌', '关注：病虫害'] },
  大暑: { text: '一年最热，早稻抢收、晚稻抢栽，注意防暑降湿。', tips: ['宜：双抢', '关注：高温热害'] },
  立秋: { text: '秋粮进入产量形成期，追施穗肥，兼顾防秋旱。', tips: ['宜：追穗肥', '关注：秋旱'] },
  处暑: { text: '暑气渐退，昼夜温差加大。秋粮进入产量形成关键期，田里的每一天都算数。', tips: ['宜：灌溉', '关注：病虫害'] },
  白露: { text: '晨露渐白，暑气渐收，昼夜温差进一步拉大。抓紧准备秋收工具与晾晒场地。', tips: ['宜：秋收准备', '关注：早霜冻'] },
  秋分: { text: '昼夜再度平分，秋收秋种拉开序幕，抢晴收晒归仓。', tips: ['宜：秋收秋种', '关注：连阴雨'] },
  寒露: { text: '露气寒冷，晚稻灌浆壮籽，秋冬蔬菜播种育苗。', tips: ['宜：育苗', '关注：寒露风'] },
  霜降: { text: '初霜将至，抢晴收晒颗粒归仓，越冬作物开始防寒。', tips: ['宜：抢晴收晒', '关注：初霜冻'] },
  立冬: { text: '万物收藏，冬小麦查苗补苗，畜禽圈舍提前保温。', tips: ['宜：查苗补苗', '关注：寒潮'] },
  小雪: { text: '初雪将至，农田冬灌蓄墒，收获的粮食贮藏好。', tips: ['宜：冬灌蓄墒', '关注：低温'] },
  大雪: { text: '降雪增多，积雪保温保墒，检修加固温室大棚。', tips: ['宜：棚室加固', '关注：雪压'] },
  冬至: { text: '白昼最短，冬闲修农具、兴水利，规划来年种植结构。', tips: ['宜：农田水利', '关注：冻害'] },
  小寒: { text: '数九寒天，防寒防冻是重点，牲畜圈舍注意加温。', tips: ['宜：防寒防冻', '关注：寒潮冻害'] },
  大寒: { text: '一年最冷，备足来年农资，总结经验迎新春。', tips: ['宜：备农资', '关注：持续低温'] },
};
const TERM_NAMES = Object.keys(termInfo);

const actions = [
  { tab: '智能预警', name: '农业智能预警专家', link: '/assistant?agent=warning', icon: CloudRain, description: 'AI 交叉研判天气、灾害与病虫害迁飞三条数据线，把提醒送达在风险来临之前。从暴雨高温到病虫害迁飞，有人替你盯紧每一块田，让季节的每个转折点都多一份从容。', main: 'https://images.pexels.com/photos/9560384/pexels-photo-9560384.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', sub: 'https://images.pexels.com/photos/27793706/pexels-photo-27793706.jpeg?auto=compress&cs=tinysrgb&h=650&w=940' },
  { tab: '科学诊断', name: '农业智能诊断专家', link: '/assistant?agent=diagnosis', icon: ScanSearch, description: '拍一张叶片照片，AI 秒级读懂病虫害与营养缺乏，给出能直接下地的防治方案。把农技员级别的判断力装进手机，让作物问题在最早阶段被解决。', main: 'https://images.pexels.com/photos/16678079/pexels-photo-16678079.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', sub: 'https://images.pexels.com/photos/36917505/pexels-photo-36917505.jpeg?auto=compress&cs=tinysrgb&h=650&w=940' },
  { tab: '合理销售', name: '农产品智能销售专家', link: '/assistant?agent=sales', icon: TrendingUp, description: '结合市场行情、物流与供需数据，算准销售时机与渠道，把好收成变成好收入。从产地到餐桌，让每一季的辛劳都卖出应有的价格。', main: 'https://images.pexels.com/photos/36838598/pexels-photo-36838598.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', sub: 'https://images.pexels.com/photos/27793706/pexels-photo-27793706.jpeg?auto=compress&cs=tinysrgb&h=650&w=940' },
];

// 本地精选内容：真实新闻源（农业农村部）不可用时的回落展示
const fallbackNews: NewsCardItem[] = [
  { day: '10', month: '2026.08', title: '秋粮作物中后期田间管理，重点关注水分与病虫害变化', summary: '秋粮进入产量形成关键期，管好水分、防住病虫害，是夺取秋收最踏实的路径。', tags: ['农技推广', '田间管理'], image: 'https://images.pexels.com/photos/9560384/pexels-photo-9560384.jpeg?auto=compress&cs=tinysrgb&h=650&w=940' },
  { day: '08', month: '2026.08', title: '从一张叶片照片开始，AI 如何帮助农户更早发现问题？', summary: '图像识别让病虫害诊断进入“看一眼”时代，农户在手机上就能获得专业的初步判断与防治建议。', tags: ['新技术', 'AI 诊断'], image: 'https://images.pexels.com/photos/16678079/pexels-photo-16678079.jpeg?auto=compress&cs=tinysrgb&h=650&w=940' },
  { day: '02', month: '2026.08', title: '新季水果上市前，如何找到最合适的销售窗口？', summary: '什么时候卖、走哪条渠道——把数据算清楚，好收成才真正变成好收入。', tags: ['市场观察', '销售建议'], image: 'https://images.pexels.com/photos/36838598/pexels-photo-36838598.jpeg?auto=compress&cs=tinysrgb&h=650&w=940' },
  { day: '28', month: '2026.07', title: '主汛期来临前，如何为农田筑起一道天气防线？', summary: '从降雨预报到排水调度，把预警信息变成一块块田里可执行的行动，是减少灾害损失最扎实的办法。', tags: ['智能预警', '防灾减灾'], image: 'https://images.pexels.com/photos/27793706/pexels-photo-27793706.jpeg?auto=compress&cs=tinysrgb&h=650&w=940' },
];

interface NewsCardItem {
  day: string;
  month: string;
  title: string;
  summary: string;
  tags: string[];
  image: string;
  /** 真实新闻的原文链接（存在时新窗口打开） */
  url?: string;
}

export default function Home() {
  // 持续关注：真实新闻（农业农村部「部要闻」）优先，失败回落本地精选；
  // 每 5 分钟自动刷新 + 回到前台补刷 + 徽标点击手动刷新（实时链路）
  const [news, setNews] = useState<NewsCardItem[]>(fallbackNews);
  const [newsReal, setNewsReal] = useState(false);
  const [newsAt, setNewsAt] = useState('');
  const [newsRefreshing, setNewsRefreshing] = useState(false);
  const newsSeq = useRef(0);
  const loadNews = useCallback(() => {
    const seq = ++newsSeq.current;
    setNewsRefreshing(true);
    fetchMoaNews(6)
      .then((list) => {
        // 下方固定渲染 news[0..3] 四张卡，条数不足 4 时必须整体回落到本地精选，
        // 否则 news[3] 为 undefined 会让 NewsCard 读取 item.image 时整页崩溃
        if (seq !== newsSeq.current || list.length < 4) return;
        setNewsReal(true);
        setNews(list.slice(0, 4).map((n) => {
          const { day, month } = splitDate(n.date);
          return { day, month, title: n.title, summary: n.summary || `来源：${n.source} · 点击阅读原文`, tags: [n.source, '部要闻'], image: n.image, url: n.url };
        }));
        setNewsAt(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }));
      })
      .catch(() => { /* 回落本地精选 */ })
      .finally(() => { if (seq === newsSeq.current) setNewsRefreshing(false); });
  }, []);
  const refreshNews = useAutoRefresh(loadNews);
  useEffect(() => {
    loadNews();
  }, [loadNews]);
  return <PageTransition><main className="overflow-hidden bg-paper text-ink">
    <HeroSection />

    {/* Section 2: 日历 + 天气卡片模块 */}
    <section className="px-4 py-16 sm:px-8 lg:px-12 lg:py-24">
      <div className="mx-auto max-w-[1280px]">
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.5 }} className="grid gap-6 lg:grid-cols-[1fr_1.15fr] lg:items-stretch">
          <CalendarCard />
          <WeatherCard />
        </motion.div>
      </div>
    </section>

    {/* Section 3: 持续关注模块 — 草稿图交错图片卡 + 绿色和平式 hover 反色 */}
    <section className="bg-white px-4 py-20 sm:px-8 lg:px-12 lg:py-28">
      <div className="mx-auto max-w-[1280px]">
        <div className="grid gap-6 md:grid-cols-2 md:gap-10">
          <div className="flex flex-col gap-6">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.5 }} className="flex items-end justify-between border-b-2 border-ink pb-5">
              <div>
                <p className="text-caption font-semibold uppercase tracking-[.22em] text-brand">Keep an eye on</p>
                <h2 className="mt-3 font-display text-h1 font-bold tracking-[-.015em] text-ink">持续关注</h2>
                <button
                  type="button"
                  onClick={() => refreshNews()}
                  aria-label="刷新实时新闻"
                  className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-caption font-bold transition ${newsReal ? 'bg-brand-tint text-brand hover:bg-brand hover:text-white' : 'bg-gold-soft text-gold-deep'}`}
                >
                  <RefreshCw className={`h-3 w-3 ${newsRefreshing ? 'animate-spin' : ''}`} />
                  {newsReal ? `原文 · 农业农村部${newsAt ? ` · 获取于 ${newsAt}` : ''}` : newsRefreshing ? '加载中…' : '本地精选资料'}
                </button>
              </div>
              <Link to="/space" className="flex items-center gap-1 text-sm font-bold text-brand transition hover:gap-2">查看更多 <ChevronRight className="h-4 w-4" /></Link>
            </motion.div>
            <NewsCard item={news[0]} />
            <NewsCard item={news[2]} />
          </div>
          <div className="flex flex-col gap-6">
            <NewsCard item={news[1]} />
            <NewsCard item={news[3]} />
            <Link to="/space" className="group mt-auto flex items-center justify-center gap-2.5 rounded-full bg-brand px-8 py-4 text-small font-bold uppercase tracking-[.14em] text-white shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:bg-brand-deep hover:shadow-md">
              了解更多故事
              <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>

    {/* Section 4: 我们的行动模块 — 深色交互式切换模块 */}
    <ActionsSection />
  </main></PageTransition>;
}

function CalendarCard() {
  // 日期取真实系统时间，避免展示过期或编造的日期
  const now = new Date();
  // 农历由浏览器内置中文历（Intl）实时换算（含闰月），时间活页可在未来 7 天间翻页
  const [datePage, setDatePage] = useState(0);
  const [page, setPage] = useState(0);
  const datePageData = (offset: number) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const wd = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
    const full = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', { dateStyle: 'long' }).format(d).replace(/^\d+/, '');
    return { year: d.getFullYear(), date: `${d.getMonth() + 1}/${d.getDate()}`, wd, lunar: full.slice(full.indexOf('年') + 1), label: offset === 0 ? '今天' : offset === 1 ? '明天' : offset === 2 ? '后天' : `+${offset} 天` };
  };
  const dayPages = [0, 1, 2, 3, 4, 5, 6].map(datePageData);
  const day = dayPages[datePage];
  // 节气活页：由 lunar-typescript 精确计算 24 节气，自动定位当前节气，可循环翻看一年
  const collectTerms = (d: Date) =>
    Object.entries(Lunar.fromDate(d).getJieQiTable())
      .filter(([name]) => TERM_NAMES.includes(name))
      .map(([name, s]) => ({ name, ts: new Date(s.getYear(), s.getMonth() - 1, s.getDay()).getTime() }))
      .map((t) => ({ ...t, m: new Date(t.ts).getMonth() + 1, d: new Date(t.ts).getDate() }));
  const nowTs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const seen = new Set<string>();
  const allTerms = [...collectTerms(now), ...collectTerms(new Date(now.getFullYear() + 1, 5, 1))]
    .sort((a, b) => a.ts - b.ts)
    .filter((t) => { const k = `${t.name}-${t.ts}`; if (seen.has(k)) return false; seen.add(k); return true; });
  let currentIdx = 0;
  allTerms.forEach((t, i) => { if (t.ts <= nowTs) currentIdx = i; });
  const termPages = allTerms.slice(currentIdx, currentIdx + 24).map((t, i) => {
    const info = termInfo[t.name];
    const date = `${t.m}月${t.d}日`;
    return { term: t.name, tag: i === 0 ? '当前节气' : i === 1 ? `下一个节气 · ${date}` : `${date} 交节`, text: info.text, tips: info.tips };
  });
  const current = termPages[page];
  return <motion.aside whileHover={{ y: -4, boxShadow: '0 18px 36px rgba(45,122,79,.12)' }} className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-brand-line bg-brand-tint p-5 transition-colors hover:bg-brand-tint sm:p-6 lg:p-7">
    <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full border border-brand-line transition-transform duration-700 group-hover:rotate-45" />
    <span className="relative w-fit rounded-xl bg-white/75 px-5 py-2 text-caption font-semibold text-brand shadow-sm">日历</span>
    <div className="relative mt-5 grid flex-1 items-stretch gap-3 sm:grid-cols-[minmax(150px,1fr)_minmax(220px,1.4fr)]">
      {/* 左侧活页：阳历+星期 / 农历，可在今天、明天、后天间翻页 */}
      <div className="relative flex flex-col rounded-lg border border-brand-line bg-white/60 px-4 pb-2 pt-3">
        <div className="absolute -top-1.5 left-1/2 flex -translate-x-1/2 gap-8">
          <span className="h-3 w-3 rounded-full border-2 border-brand-line bg-brand-tint" />
          <span className="h-3 w-3 rounded-full border-2 border-brand-line bg-brand-tint" />
        </div>
        <div style={{ perspective: 900 }} className="flex flex-1 items-center overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={datePage}
              initial={{ rotateX: 55, opacity: 0 }}
              animate={{ rotateX: 0, opacity: 1 }}
              exit={{ rotateX: -55, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              style={{ transformOrigin: '50% 0%' }}
              className="w-full py-1"
            >
              <div className="flex items-center justify-between">
                <p className="text-caption font-bold tracking-wider text-muted">阳历 · {day.year}</p>
                <span className="rounded-full bg-gold-soft px-2 py-0.5 text-caption font-bold text-gold-deep">{day.label}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                <p className="text-4xl font-bold leading-none tracking-[-.045em] text-brand-deep">{day.date}</p>
                <p className="text-sm font-bold text-brand">星期{day.wd}</p>
              </div>
              <div className="my-2 h-px shrink-0 bg-brand-line" />
              <p className="text-caption font-bold tracking-wider text-muted">农历</p>
              <p className="mt-1 text-xl font-bold leading-none tracking-[-.02em] text-brand">{day.lunar}</p>
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="absolute bottom-0 left-1/2 h-2.5 w-10 -translate-x-1/2 rounded-t-full bg-brand-tint" />
        <div className="relative flex items-center justify-between border-t border-brand-line pt-1.5">
          <p className="text-caption font-bold tabular-nums text-muted">{datePage + 1} / {dayPages.length}</p>
          <div className="flex gap-1">
            <button onClick={() => setDatePage((p) => (p + dayPages.length - 1) % dayPages.length)} className="flex h-6 w-6 items-center justify-center rounded-lg text-muted transition hover:bg-brand-tint hover:text-brand" aria-label="上一页">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => setDatePage((p) => (p + 1) % dayPages.length)} className="flex h-6 w-6 items-center justify-center rounded-lg text-muted transition hover:bg-brand-tint hover:text-brand" aria-label="下一页">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
      {/* 右侧活页：节气纸页，可翻页 */}
      <div className="relative flex flex-col rounded-lg border border-brand-line bg-white/60 px-4 pb-2 pt-3">
        {/* 装订环 */}
        <div className="absolute -top-1.5 left-1/2 flex -translate-x-1/2 gap-8">
          <span className="h-3 w-3 rounded-full border-2 border-brand-line bg-brand-tint" />
          <span className="h-3 w-3 rounded-full border-2 border-brand-line bg-brand-tint" />
        </div>
        <div style={{ perspective: 900 }} className="flex flex-1 items-center overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={page}
              initial={{ rotateX: 55, opacity: 0 }}
              animate={{ rotateX: 0, opacity: 1 }}
              exit={{ rotateX: -55, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              style={{ transformOrigin: '50% 0%' }}
              className="flex w-full items-center gap-3.5 py-2"
            >
              <div className="flex shrink-0 items-center justify-center self-stretch rounded-2xl bg-brand px-2.5 py-3 shadow-md">
                <span className="text-[15px] font-bold tracking-[.3em] text-white [writing-mode:vertical-rl]">{current.term}</span>
              </div>
              <div className="min-w-0">
                <p className="text-caption font-bold tracking-wider text-gold-deep">{current.tag}</p>
                <p className="mt-1 text-small leading-6 text-ink-soft">{current.text}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {current.tips.map((tip) => (
                    <span key={tip} className={`rounded-full px-2 py-1 text-caption ${tip.startsWith('宜') ? 'bg-brand-tint text-brand' : 'bg-gold-soft text-gold-deep'}`}>{tip}</span>
                  ))}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
        {/* 撕页凹口 + 翻页控制 */}
        <div className="absolute bottom-0 left-1/2 h-2.5 w-10 -translate-x-1/2 rounded-t-full bg-brand-tint" />
        <div className="relative flex items-center justify-between border-t border-brand-line pt-1.5">
          <p className="text-caption font-bold tabular-nums text-muted">{page + 1} / {termPages.length}</p>
          <div className="flex gap-1">
            <button onClick={() => setPage((p) => (p + termPages.length - 1) % termPages.length)} className="flex h-6 w-6 items-center justify-center rounded-lg text-muted transition hover:bg-brand-tint hover:text-brand" aria-label="上一页">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => setPage((p) => (p + 1) % termPages.length)} className="flex h-6 w-6 items-center justify-center rounded-lg text-muted transition hover:bg-brand-tint hover:text-brand" aria-label="下一页">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </motion.aside>;
}

// WMO 天气码分类 → lucide 图标
const kindIcons = {
  sun: Sun, 'cloud-sun': CloudSun, cloud: Cloud, 'cloud-rain': CloudRain, 'cloud-snow': CloudSnow, 'cloud-lightning': CloudLightning, 'cloud-fog': CloudFog,
} as const;

function WeatherCard() {
  // 真实天气：浏览器定位 → 按坐标查 Open-Meteo；拒绝授权/失败时回落成都示例数据
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [failed, setFailed] = useState(false);
  const [location, setLocation] = useState('四川省 · 成都市');
  const [locating, setLocating] = useState(true);
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const loc = await resolveLocation();
        if (!alive) return;
        if (loc) {
          setLocation(loc.label);
          const data = await fetchWeatherAt(loc.lat, loc.lon);
          if (!alive) return;
          setWeather(data);
          return;
        }
      } catch {
        /* 定位失败回落默认城市 */
      } finally {
        if (alive) setLocating(false);
      }
      try {
        if (alive) setLocation('四川省 · 成都市');
        const data = await fetchChengduWeather();
        if (alive) setWeather(data);
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => { alive = false; };
  }, []);

  // 失败回落时的示例数据
  const demo: WeatherData = {
    now: { temperature: 28, humidity: 62, windLabel: '西南风 2 级', kind: 'sun', label: '晴' },
    days: [
      { label: '今天', kind: 'sun', label_text: '晴', max: 28, min: 19 },
      { label: '明天', kind: 'cloud-rain', label_text: '雨', max: 30, min: 21 },
      { label: '后天', kind: 'cloud-rain', label_text: '小雨', max: 27, min: 20 },
    ],
  };
  const w = weather ?? demo;
  const NowIcon = kindIcons[w.now.kind];

  return <motion.div whileHover={{ y: -3 }} className="group flex h-full flex-col rounded-xl border border-faint bg-white p-5 shadow-md sm:p-6 lg:p-7">
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 rounded-xl bg-brand-tint px-5 py-2 text-caption font-semibold text-brand">
        天气
        <span className={`rounded-full px-2 py-0.5 text-caption font-semibold ${weather ? 'bg-brand-tint text-brand' : 'bg-gold-soft text-gold-deep'}`}>
          {weather ? '实时数据' : failed ? '示例数据' : '加载中…'}
        </span>
      </span>
      <span className="flex items-center gap-1.5 rounded-xl bg-paper-warm px-4 py-2 text-caption font-semibold text-muted">
        <MapPin className="h-3.5 w-3.5 text-brand" />
        {locating ? '定位中…' : location}
      </span>
    </div>
    <div className="relative mt-5 grid flex-1 gap-3 sm:grid-cols-[minmax(170px,1fr)_minmax(220px,1.2fr)] sm:items-stretch">
      <div className="flex flex-col rounded-lg border border-faint bg-paper-warm p-4">
        <div className="flex items-center justify-between">
          <p className="text-small font-bold tracking-[-.01em] text-brand-deep">今天</p>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold-soft transition-transform duration-700 group-hover:rotate-90"><NowIcon className="h-5 w-5 text-gold" /></div>
        </div>
        <div className="my-2 flex flex-1 flex-col items-center justify-center text-center">
          <p className="text-[3.25rem] font-bold leading-none tracking-[-.04em] text-brand-deep">{w.now.temperature}°</p>
          <p className="mt-1.5 text-caption font-semibold text-ink-soft">{w.now.label} · {w.now.temperature >= 30 ? '注意防暑' : '适合下地'}</p>
        </div>
        <div className="flex gap-1.5">
          <span className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-faint bg-white py-1.5 text-caption text-muted"><Droplets className="h-3 w-3 text-brand" />湿度 {w.now.humidity}%</span>
          <span className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-faint bg-white py-1.5 text-caption text-muted"><Wind className="h-3 w-3 text-muted" />{w.now.windLabel}</span>
        </div>
      </div>
      <div className="flex flex-col rounded-lg border border-faint bg-paper-warm p-4">
        <p className="text-small font-bold tracking-[-.01em] text-brand-deep">预报</p>
        <div className="mt-2 flex h-[70px] items-center"><svg viewBox="0 0 420 70" className="h-full w-full" preserveAspectRatio="none"><path d="M0 52 C45 42 65 18 108 26 C148 35 165 14 214 22 C255 28 278 44 320 20 C355 6 382 18 420 10" fill="none" stroke="#2d7a4f" strokeWidth="3" /><path d="M0 60 C58 54 78 40 112 48 C164 56 183 38 225 44 C285 52 307 36 346 42 C377 48 397 36 420 34" fill="none" stroke="#e4ba65" strokeWidth="2" strokeDasharray="5 6" />{[[108,26],[214,22],[320,20],[420,10]].map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="4" fill="#fff" stroke="#2d7a4f" strokeWidth="2" />)}</svg></div>
        <div className="mt-1.5 grid grid-cols-3 gap-1.5">
          {w.days.map((d) => {
            const DayIcon = kindIcons[d.kind];
            return (
              <div key={d.label} className="flex flex-col items-center rounded-xl border border-faint bg-white py-2">
                <DayIcon className="h-5 w-5 text-gold" />
                <b className="mt-1 text-caption font-bold text-brand-deep">{d.label}</b>
                <span className="text-caption text-muted">{d.label_text}</span>
                <span className="mt-0.5 text-caption font-bold text-brand-deep">{d.max}°/{d.min}°</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  </motion.div>;
}

function NewsCard({ item }: { item: NewsCardItem }) {
  const inner = <>
    <div className="overflow-hidden">
      <img src={item.image} alt={item.title} className="h-60 w-full object-cover transition duration-700 group-hover:scale-105" />
    </div>
    <div className="absolute left-6 top-60 z-10 -translate-y-1/2 bg-brand px-5 py-3 text-white shadow-md transition-colors duration-300 group-hover:bg-brand-deep">
      <span className="block text-3xl font-bold leading-none tracking-[-.03em]">{item.day}</span>
      <span className="mt-1 block text-caption font-semibold tracking-wider">{item.month}</span>
    </div>
    <div className="px-6 pb-8 pt-12">
      <h3 className="font-display text-h3 font-bold leading-snug tracking-[-.01em] text-ink transition-colors duration-300 group-hover:text-brand-deep">{item.title}</h3>
      <p className="mt-3 text-sm leading-7 text-muted transition-colors duration-300 group-hover:text-brand">{item.summary}</p>
      <div className="mt-5 flex flex-wrap gap-2">{item.tags.map(tag => <span key={tag} className="border border-brand px-3 py-1.5 text-caption font-semibold text-brand transition-colors duration-300 group-hover:border-brand-deep group-hover:bg-brand-deep group-hover:text-white">#{tag}</span>)}</div>
    </div>
  </>;
  // 真实新闻外链原文（新窗口）；本地精选跳知识空间
  return item.url
    ? <a href={item.url} target="_blank" rel="noreferrer" className="group relative block bg-white transition-colors duration-300 hover:bg-brand-tint">{inner}</a>
    : <Link to="/space" className="group relative block bg-white transition-colors duration-300 hover:bg-brand-tint">{inner}</Link>;
}

function ActionsSection() {
  const [active, setActive] = useState(0);
  const current = actions[active];
  const Icon = current.icon;
  // 自动轮播：每 5 秒切换一次，手动点击后重置计时
  useEffect(() => {
    const t = setInterval(() => setActive(a => (a + 1) % actions.length), 5000);
    return () => clearInterval(t);
  }, [active]);
  return <section id="actions" className="relative bg-ink px-4 pb-28 pt-24 sm:px-8 lg:px-12 lg:pb-36">
    <div className="grain-overlay" />
    <div className="relative mx-auto max-w-[1280px]">
      <div className="grid gap-16 lg:grid-cols-[1fr_1.15fr]">
        {/* 左列：凸出标题块 + 大字 tabs（上左）+ 简介沉底 */}
        <div className="flex flex-col">
          <motion.div initial={{ opacity: 0, y: -16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.5 }} className="-mt-40 w-fit bg-brand px-10 py-8 shadow-lg">
            <p className="text-caption font-semibold uppercase tracking-[.22em] text-white/60">The way we help</p>
            <h2 className="mt-3 font-display text-h1 font-bold tracking-[-.015em] text-white">我们的行动</h2>
          </motion.div>
          {/* 大字 tabs：往右中靠（左列内右对齐），不挤压图片 */}
          <div className="mt-16 flex w-fit flex-col gap-8 lg:ml-auto lg:mr-8">
            {actions.map((a, i) => <button key={a.tab} type="button" onClick={() => setActive(i)} className={`text-left font-display text-h1 font-bold tracking-[-.02em] transition-colors duration-500 ${i === active ? 'text-white' : 'text-ink/35 hover:text-white/40'}`}>{a.tab}</button>)}
          </div>
          <div className="mt-14 lg:mt-auto lg:pt-14">
            <div className="rounded-xl border border-white/10 bg-white/5 p-8">
              <AnimatePresence mode="wait">
                <motion.div key={active} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.3 }}>
                  <div className="flex items-center gap-3">
                    <Icon className="h-6 w-6 text-brand-tint" />
                    <h3 className="font-display text-h2 font-bold tracking-[-.02em] text-white">{current.name}</h3>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-white/60">{current.description}</p>
                  <Link to={current.link} className="mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-brand-tint transition-all hover:gap-3">和专家聊聊 <ChevronRight className="h-4 w-4" /></Link>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
        {/* 右列：叠放双图（图1 长矩形 + 图2 右下角正方形） */}
        <div className="relative">
          <AnimatePresence mode="wait">
            <motion.div key={active} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.35 }} className="relative mr-4 lg:mr-8">
              <div className="border-[10px] border-ink-soft">
                <img src={current.main} alt={current.name} className="h-[420px] w-full object-cover lg:h-[560px]" />
              </div>
              <div className="absolute -bottom-14 -right-10 aspect-square w-[56%] border-[10px] border-ink-soft shadow-lg">
                <img src={current.sub} alt="" className="h-full w-full object-cover" />
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  </section>;
}
