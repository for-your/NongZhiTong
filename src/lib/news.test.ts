import { describe, expect, it } from 'vitest';
import { extractArticleMeta, fetchKnowledgeArticles, KNOWLEDGE_CATEGORIES, mapWithLimit, withCoverImages, type NewsItem } from '@/lib/news';

const makeItem = (i: number): NewsItem => ({
  sourceKind: 'remote',
  title: `t${i}`,
  url: `https://www.moa.gov.cn/x${i}.htm`,
  date: '',
  source: '',
  summary: '',
  tags: [],
  image: `fallback-${i}`,
});

describe('mapWithLimit：带并发上限的映射', () => {
  it('同时进行中的任务数不超过上限', async () => {
    let running = 0;
    let peak = 0;
    const task = async (n: number) => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 5));
      running -= 1;
      return n * 2;
    };

    const out = await mapWithLimit([1, 2, 3, 4, 5, 6, 7, 8], 3, task);

    expect(peak).toBeLessThanOrEqual(3);
    expect(out).toEqual([2, 4, 6, 8, 10, 12, 14, 16]);
  });

  it('结果顺序与输入顺序一致（即便完成顺序不同）', async () => {
    const out = await mapWithLimit([30, 10, 20], 3, async (n) => {
      await new Promise((r) => setTimeout(r, n));
      return n + 1;
    });

    expect(out).toEqual([31, 11, 21]);
  });

  it('空数组直接返回空结果', async () => {
    expect(await mapWithLimit([], 4, async () => 1)).toEqual([]);
  });

  it('上限大于任务数时不会多启动 worker', async () => {
    let calls = 0;
    const out = await mapWithLimit([1, 2], 10, async (n) => {
      calls += 1;
      return n;
    });

    expect(out).toEqual([1, 2]);
    expect(calls).toBe(2);
  });
});

describe('withCoverImages：封面抓取的并发与超时取消', () => {
  it('并发抓取详情页的请求数不超过 4', async () => {
    const original = globalThis.fetch;
    let running = 0;
    let peak = 0;
    globalThis.fetch = (async () => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 5));
      running -= 1;
      throw new Error('no image');
    }) as unknown as typeof fetch;

    try {
      const items = Array.from({ length: 12 }, (_, i) => makeItem(i));
      await withCoverImages(items, 5000);
      expect(peak).toBeLessThanOrEqual(4);
    } finally {
      globalThis.fetch = original;
    }
  });

  it('超时后复用原封面，并真正中断仍在飞行的请求', async () => {
    const original = globalThis.fetch;
    const signals: AbortSignal[] = [];
    globalThis.fetch = ((_url: string, init?: RequestInit) => {
      if (init?.signal) signals.push(init.signal);
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError')),
        );
      });
    }) as unknown as typeof fetch;

    try {
      const out = await withCoverImages([makeItem(1)], 20);

      expect(out[0].image).toBe('fallback-1');
      expect(signals.length).toBeGreaterThan(0);
      expect(signals.every((s) => s.aborted)).toBe(true);
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe('fetchKnowledgeArticles：全站抓取的总并发受控', () => {
  it('同时飞行的请求数不超过 8（列表页 + 详情页合计）', async () => {
    const original = globalThis.fetch;
    let running = 0;
    let peak = 0;

    const listHtml =
      '<html><body><ul>' +
      Array.from(
        { length: 6 },
        (_, i) => `<li class="ztlb"><a title="要闻${i}" href="x${i}.htm">要闻${i}</a><span>2026-09-0${i + 1}</span></li>`,
      ).join('') +
      '</ul></body></html>';

    globalThis.fetch = (async () => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 5));
      running -= 1;
      return {
        ok: true,
        status: 200,
        text: async () => listHtml,
      } as unknown as Response;
    }) as unknown as typeof fetch;

    try {
      await fetchKnowledgeArticles({});
      expect(peak).toBeLessThanOrEqual(8);
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe('extractArticleMeta：详情页配图与摘要一次提取', () => {
  it('读取 meta description 与正文配图', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () => ({
      ok: true,
      status: 200,
      text: async () =>
        '<html><head><meta name="Description" content="  农业农村部部署秋粮田间管理重点工作。  "></head>' +
        '<body><img src="https://www.moa.gov.cn/P020261005abc.jpg"><img src="/images/logo.png"></body></html>',
    })) as unknown as typeof fetch;

    try {
      const meta = await extractArticleMeta('https://www.moa.gov.cn/xw/zwdt/1.htm');
      expect(meta.summary).toBe('农业农村部部署秋粮田间管理重点工作。');
      expect(meta.image).toBe('https://www.moa.gov.cn/P020261005abc.jpg'); // 装饰图被过滤
    } finally {
      globalThis.fetch = original;
    }
  });

  it('无 meta 时回落首个长正文段落，失败返回空结果', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () => ({
      ok: true,
      status: 200,
      text: async () => '<html><body><p>.TRS_Editor P{margin-top:5px;font-family:--系统字体--;}混入正文的CSS样式文本</p><p>这是一段足够长的正文内容，用来充当新闻摘要的兜底来源，覆盖了新闻核心信息。</p></body></html>',
    })) as unknown as typeof fetch;
    try {
      const meta = await extractArticleMeta('https://www.moa.gov.cn/x.htm');
      expect(meta.summary).toContain('这是一段足够长的正文内容');
      expect(meta.image).toBeNull();
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe('withCoverImages：顺带补全原文摘要', () => {
  it('详情页抓取成功时回填 summary', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () => ({
      ok: true,
      status: 200,
      text: async () => '<html><head><meta name="Description" content="新闻摘要内容在这里。"></head><body></body></html>',
    })) as unknown as typeof fetch;
    try {
      const out = await withCoverImages([makeItem(1)], 5000);
      expect(out[0].summary).toBe('新闻摘要内容在这里。');
      expect(out[0].image).toBe('fallback-1'); // 无配图保留原封面
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe('fetchKnowledgeArticles：内容丰富度', () => {
  it('每个分类补齐 6 篇，真实新闻带原文链接，专栏带简介', async () => {
    const original = globalThis.fetch;
    const listHtml =
      '<html><body><ul>' +
      Array.from(
        { length: 6 },
        (_, i) => `<li class="ztlb"><a title="要闻${i}" href="x${i}.htm">要闻${i}</a><span>2026-10-0${i + 1}</span></li>`,
      ).join('') +
      '</ul></body></html>';
    globalThis.fetch = (async () => ({
      ok: true,
      status: 200,
      text: async () => listHtml,
    })) as unknown as typeof fetch;

    const pool = Object.fromEntries(
      KNOWLEDGE_CATEGORIES.map((c) => [c, Array.from({ length: 6 }, (_, i) => ({ title: `${c}-专栏${i + 1}`, summary: `简介${i + 1}` }))]),
    );

    try {
      const out = await fetchKnowledgeArticles(pool);
      for (const cat of KNOWLEDGE_CATEGORIES) {
        expect(out[cat].length).toBe(6);
      }
      // 有栏目的分类（市场观察）走真实要闻
      expect(out.市场观察[0].url).toContain('moa.gov.cn');
      // 无栏目的分类（病虫害防治）由通用专栏补齐，且带简介
      const column = out.病虫害防治.find((a) => !a.url);
      expect(column?.summary).toBeTruthy();
    } finally {
      globalThis.fetch = original;
    }
  });

  it('远程抓取全部失败时，补齐文章明确标记为本地资料', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;
    const pool = Object.fromEntries(
      KNOWLEDGE_CATEGORIES.map((category) => [category, [{ title: `${category}本地资料`, summary: '离线简介' }]]),
    );
    try {
      const out = await fetchKnowledgeArticles(pool);
      expect(Object.values(out).flat().every((article) => article.sourceKind === 'local')).toBe(true);
    } finally {
      globalThis.fetch = original;
    }
  });
});
