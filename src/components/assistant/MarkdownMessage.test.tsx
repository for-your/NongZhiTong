import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import MarkdownMessage from '@/components/assistant/MarkdownMessage';

// 素材来自女娲真实回答（截图复现的粘连问题）
const realAnswer = `## 🌧 明天天气概况

成都明天有中雨，局部大雨，气温 18~24℃。

| 项目 | 情况 |
|------|------|
| 降水 | 中雨 |
| 气温 | 18~24℃ |

### 建议

1. 暂停喷药
2. 疏通排水沟

明天**不适合**大水漫灌，优先改用\`滴灌\`。`;

describe('MarkdownMessage 渲染女娲实际输出', () => {
  it('## 标题渲染为标题，不落进正文段落', () => {
    const { container } = render(<MarkdownMessage content="## 🌧 明天天气概况" />);
    expect(container.querySelector('p.font-bold')?.textContent).toContain('明天天气概况');
  });

  it('表格渲染为真正的 table（表头 + 数据行），不再出现 | 粘连', () => {
    const { container } = render(<MarkdownMessage content={realAnswer} />);
    const table = container.querySelector('table');
    expect(table).not.toBeNull();
    expect(container.textContent).not.toContain('|'); // 管道符全部被消费
    expect(container.textContent).not.toContain('------');
    const headers = [...container.querySelectorAll('th')].map((th) => th.textContent);
    expect(headers).toEqual(['项目', '情况']);
    expect(container.textContent).toContain('中雨');
  });

  it('有序列表、无序列表、行内代码、加粗各自成立，段落不粘连', () => {
    const { container } = render(<MarkdownMessage content={realAnswer} />);
    expect(container.querySelectorAll('ol li')).toHaveLength(2);
    expect(container.querySelector('code')?.textContent).toBe('滴灌');
    expect(container.querySelector('strong')?.textContent).toBe('不适合');
    // 相邻段落保持独立（旧版把空行行 join('') 拼成一堵墙）
    const text = container.textContent ?? '';
    expect(text).not.toContain('中雨，局部大雨，气温 18~24℃。###');
    expect(text).not.toContain('℃ |降水');
  });

  it('空内容流式态渲染光标，非流式态返回空', () => {
    const { container } = render(<MarkdownMessage content="" streaming />);
    expect(container.querySelector('.animate-pulse')).not.toBeNull();
    const empty = render(<MarkdownMessage content="" />);
    expect(empty.container.textContent).toBe('');
  });
});
