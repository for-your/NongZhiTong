/**
 * 真实农业新闻：抓取农业农村部官网「部要闻」列表（经 Vite/后端代理解决跨域）
 * 解析规则基于官网列表结构：<li class="ztlb"><a title="标题" href="相对路径">…</a><span>日期</span></li>
 */

const MOA_LIST_URL = '/moa-news/xw/zwdt/';
const MOA_BASE = 'https://www.moa.gov.cn/xw/zwdt/';
const NEWS_SOURCE = '农业农村部';

export interface NewsItem {
  sourceKind: 'remote' | 'local';
  title: string;
  url: string;
  /** 原始日期，如 2026-08-28 */
  date: string;
  source: string;
  summary: string;
  tags: string[];
  image: string;
}

// 无图新闻的封面图：轮换使用农事主题图库
const coverImages = [
  'https://images.pexels.com/photos/9560384/pexels-photo-9560384.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  'https://images.pexels.com/photos/16678079/pexels-photo-16678079.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  'https://images.pexels.com/photos/36917505/pexels-photo-36917505.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  'https://images.pexels.com/photos/27793706/pexels-photo-27793706.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  'https://images.pexels.com/photos/36838598/pexels-photo-36838598.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
];

function coverFor(index: number): string {
  return coverImages[index % coverImages.length];
}

/**
 * 带并发上限的映射：同时最多启动 `limit` 个任务，结果按输入顺序返回。
 * 用于批量抓取时避免对上游（moa 代理）一次性打出过多并发请求。
 */
export async function mapWithLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const size = Math.max(1, Math.floor(limit) || 1);
  const results = new Array<R>(items.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index], index);
    }
  };
  const workers = Array.from({ length: Math.min(size, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/** 从新闻详情页提取正文配图与摘要（同一次抓取，两个用途），失败返回空结果 */
export async function extractArticleMeta(
  articleUrl: string,
  signal?: AbortSignal,
): Promise<{ image: string | null; summary: string }> {
  try {
    const path = articleUrl.replace('https://www.moa.gov.cn', '/moa-news');
    const res = await fetch(path, signal ? { signal } : undefined);
    if (!res.ok) return { image: null, summary: '' };
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const srcs = [...doc.querySelectorAll('img')].map((im) => im.getAttribute('src') ?? '');
    const hit = srcs.find((s) => s && !s.includes('/images/') && /\.(jpg|jpeg|png)/i.test(s));
    const image = hit ? new URL(hit, articleUrl).href : null;
    const meta =
      doc
        .querySelector('meta[name="Description"], meta[name="description"], meta[property="og:description"]')
        ?.getAttribute('content')
        ?.trim() || '';
    // meta 缺失时取正文段落：过滤 ICP 备案/版权等样板与混入 <p> 的 CSS 文本，取最长的（正文通常最长）
    const body =
      [...doc.querySelectorAll('p')]
        .map((p) => p.textContent?.trim() ?? '')
        .filter((t) => t.length > 30 && !/京ICP|主办单位|网站识别码|版权所有|Copyright|\{|\}/i.test(t))
        .sort((a, b) => b.length - a.length)[0] ?? '';
    return { image, summary: (meta || body).replace(/\s+/g, ' ').slice(0, 90) };
  } catch {
    return { image: null, summary: '' };
  }
}

/** 封面详情页抓取的并发上限：避免对 moa 代理一次性打出过多请求 */
const COVER_CONCURRENCY = 4;
/** 封面补全整体限时（毫秒），超时即中断仍在飞行的请求 */
const COVER_TIMEOUT_MS = 5000;

/**
 * 尽力为每条新闻提取原文配图与摘要（摘要供首页/知识空间卡片展示）。
 * - 走并发上限，避免知识空间多分类并行时对上游造成突发压力；
 * - 整体限时，超时会 abort 底层 fetch（而非仅仅不再等待），
 *   已拿不到图的项目保留原封面。
 */
export async function withCoverImages(
  items: NewsItem[],
  timeoutMs: number = COVER_TIMEOUT_MS,
): Promise<NewsItem[]> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<NewsItem[]>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(items);
    }, timeoutMs);
  });

  const mapped = mapWithLimit(items, COVER_CONCURRENCY, async (n) => {
    const meta = await extractArticleMeta(n.url, controller.signal);
    return { ...n, image: meta.image ?? n.image, summary: n.summary || meta.summary };
  });

  try {
    return await Promise.race([mapped, timeout]);
  } catch {
    return items;
  } finally {
    clearTimeout(timer);
    // 超时分支落败的 mapped 仍会 settle（abort 后 extractArticleImage 返回 null），
    // 这里兜底吞掉可能出现的 rejection，避免未处理拒绝。
    void mapped.catch(() => items);
  }
}

/** 抓取农业农村部「部要闻」，解析失败或为空时抛错（由调用方回落本地内容） */
export async function fetchMoaNews(limit = 8): Promise<NewsItem[]> {
  // no-store：绕过浏览器 HTTP 缓存，保证列表每次都是最新的（实时刷新的前提）
  const res = await fetch(MOA_LIST_URL, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const items: NewsItem[] = [];
  doc.querySelectorAll('li.ztlb').forEach((li, i) => {
    if (items.length >= limit) return;
    const a = li.querySelector('a');
    const href = a?.getAttribute('href') ?? '';
    const title = (a?.getAttribute('title') || a?.textContent || '').trim();
    if (!a || !href || !title) return;
    const url = new URL(href, MOA_BASE).href;
    const date = (li.querySelector('span')?.textContent ?? '').trim();
    items.push({
      sourceKind: 'remote',
      title,
      url,
      date,
      source: NEWS_SOURCE,
      summary: '',
      tags: [NEWS_SOURCE],
      image: coverFor(i),
    });
  });
  if (!items.length) throw new Error('未解析到新闻列表');
  return withCoverImages(items);
}

/** "2026-08-28" → { day: '28', month: '2026.08' } */
export function splitDate(date: string): { day: string; month: string } {
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return { day: '', month: '' };
  return { day: m[3], month: `${m[1]}.${m[2]}` };
}

// —— 知识空间：按栏目抓取，保证每个分类都有真实文章 ——

/** 知识空间分类（顺序即展示顺序：市场观察默认第一） */
export const KNOWLEDGE_CATEGORIES = ['市场观察', '病虫害防治', '土壤管理', '气候适应', '新技术'] as const;

/** 分类 → 农业农村部栏目列表页（相对 MOA_BASE） */
const CATEGORY_CHANNELS: Record<string, string[]> = {
  市场观察: ['ztzl/szcpxx/scxxfb/'],
  新技术: ['ztzl/zhnyzxd/'],
  土壤管理: ['ztzl/dscqgtrpc/'],
  病虫害防治: [],
  气候适应: [],
};

/** 分类 → 相关主题真实摄影图（按分类固定，替代随机轮换） */
const CATEGORY_COVERS: Record<string, string[]> = {
  "市场观察": [
    "https://images.pexels.com/photos/264537/pexels-photo-264537.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
    "https://images.pexels.com/photos/2252584/pexels-photo-2252584.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
    "https://images.pexels.com/photos/27793706/pexels-photo-27793706.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
    "https://images.pexels.com/photos/36838598/pexels-photo-36838598.jpeg?auto=compress&cs=tinysrgb&h=650&w=940"
  ],
  "病虫害防治": [
    "https://images.pexels.com/photos/16678079/pexels-photo-16678079.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
    "https://images.pexels.com/photos/2132250/pexels-photo-2132250.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
    "https://images.pexels.com/photos/326082/pexels-photo-326082.jpeg?auto=compress&cs=tinysrgb&h=650&w=940"
  ],
  "土壤管理": [
    "https://images.pexels.com/photos/9560384/pexels-photo-9560384.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
    "https://images.pexels.com/photos/2131784/pexels-photo-2131784.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
    "https://images.pexels.com/photos/2589457/pexels-photo-2589457.jpeg?auto=compress&cs=tinysrgb&h=650&w=940"
  ],
  "气候适应": [
    "https://images.pexels.com/photos/533982/pexels-photo-533982.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
    "https://images.pexels.com/photos/1824261/pexels-photo-1824261.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
    "https://images.pexels.com/photos/2589457/pexels-photo-2589457.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
    "https://images.pexels.com/photos/326082/pexels-photo-326082.jpeg?auto=compress&cs=tinysrgb&h=650&w=940"
  ],
  "新技术": [
    "https://images.pexels.com/photos/36917505/pexels-photo-36917505.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
    "https://images.pexels.com/photos/2933243/pexels-photo-2933243.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
    "https://images.pexels.com/photos/1595104/pexels-photo-1595104.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
    "https://images.pexels.com/photos/442587/pexels-photo-442587.jpeg?auto=compress&cs=tinysrgb&h=650&w=940"
  ]
};

/** 知识空间 Hero 轮播图（农业场景大图） */
export const HERO_IMAGES: string[] = [
  "https://images.pexels.com/photos/9560384/pexels-photo-9560384.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
  "https://images.pexels.com/photos/1595104/pexels-photo-1595104.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
  "https://images.pexels.com/photos/2131784/pexels-photo-2131784.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
  "https://images.pexels.com/photos/264537/pexels-photo-264537.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
  "https://images.pexels.com/photos/2589457/pexels-photo-2589457.jpeg?auto=compress&cs=tinysrgb&h=650&w=940"
];


/** 抓取单个栏目页的新闻列表 */
async function fetchMoaChannel(path: string, limit = 8): Promise<NewsItem[]> {
  const res = await fetch(`/moa-news/${path}`, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const items: NewsItem[] = [];
  doc.querySelectorAll('li.ztlb, li').forEach((li) => {
    if (items.length >= limit) return;
    const a = li.querySelector('a');
    const href = a?.getAttribute('href') ?? '';
    const title = (a?.getAttribute('title') || a?.textContent || '').trim();
    if (!a || !href.includes('.htm') || !title) return;
    // 相对链接必须按**当前栏目页**的 URL 解析（栏目不在 xw/zwdt/ 下，用 MOA_BASE 会拼出 404 地址）
    const url = new URL(href, `https://www.moa.gov.cn/${path}`).href;
    if (!url.includes('.htm')) return;
    const date = (li.querySelector('span')?.textContent ?? '').trim();
    items.push({ sourceKind: 'remote', title, url, date, source: NEWS_SOURCE, summary: '', tags: [NEWS_SOURCE], image: '' });
  });
  return withCoverImages(items);
}

export interface CategoryArticle {
  sourceKind: 'remote' | 'local';
  title: string;
  url?: string;
  date: string;
  image: string;
  /** 原文摘要（详情页 meta 提取；专栏为自带简介） */
  summary?: string;
}

/** 分类栏目抓取的并发上限：分类之间也需限流，否则 5 类叠加会把并发推到 20+ */
const CATEGORY_CONCURRENCY = 2;
/** 每个分类展示的文章数（真实栏目优先，不足用通用专栏补齐） */
const ARTICLES_PER_CATEGORY = 6;

/**
 * 知识空间文章：按分类栏目抓取真实部要闻，每类补齐 6 篇
 * 栏目抓取失败/数量不足的分类，使用分类相关图库封面的通用专栏文章补齐
 */
export async function fetchKnowledgeArticles(
  generalPool: Record<string, Array<{ title: string; summary: string }>>,
): Promise<Record<string, CategoryArticle[]>> {
  const result: Record<string, CategoryArticle[]> = {};
  await mapWithLimit(KNOWLEDGE_CATEGORIES, CATEGORY_CONCURRENCY, async (category) => {
    const covers = CATEGORY_COVERS[category] ?? coverImages;
    const paths = CATEGORY_CHANNELS[category] ?? [];
    let real: NewsItem[] = [];
    for (const p of paths) {
      try {
        real = await fetchMoaChannel(p, ARTICLES_PER_CATEGORY);
        if (real.length >= ARTICLES_PER_CATEGORY) break;
      } catch {
        /* 尝试下一路径 */
      }
    }
    // 部要闻兜底：从综合要闻里按关键词归类补足
    if (real.length < ARTICLES_PER_CATEGORY && (category === '病虫害防治' || category === '气候适应')) {
      try {
        const main = await fetchMoaNews(20);
        const kw = category === '病虫害防治' ? /病|虫|害|药|防治/ : /天气|雨|汛|旱|霜|灾|温|气/;
        const hit = main.filter((n) => kw.test(n.title) && !real.some((r) => r.url === n.url));
        real = [...real, ...hit].slice(0, ARTICLES_PER_CATEGORY);
      } catch {
        /* 忽略 */
      }
    }
    const general = generalPool[category] ?? [];
    const articles: CategoryArticle[] = [];
    real.slice(0, ARTICLES_PER_CATEGORY).forEach((n) => {
      articles.push({ sourceKind: 'remote', title: n.title, url: n.url, date: n.date, image: n.image || covers[articles.length % covers.length] || covers[0], summary: n.summary });
    });
    // 不足 → 通用专栏补齐（常设知识内容，标注「专栏」非新闻）
    for (let g = 0; articles.length < ARTICLES_PER_CATEGORY && g < general.length; g++) {
      articles.push({
        sourceKind: 'local',
        title: general[g].title,
        summary: general[g].summary,
        date: '',
        image: covers[articles.length % covers.length] ?? covers[0],
      });
    }
    result[category] = articles;
  });
  return result;
}
