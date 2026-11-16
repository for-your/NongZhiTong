import { Fragment, type ReactNode } from 'react';

/** 行内解析：**加粗**、`行内代码`，零依赖 */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((seg, i) => {
    if (seg.length > 4 && seg.startsWith('**') && seg.endsWith('**')) {
      return <strong key={`${keyPrefix}-${i}`} className="font-bold text-brand-deep">{seg.slice(2, -2)}</strong>;
    }
    if (seg.length > 2 && seg.startsWith('`') && seg.endsWith('`')) {
      return (
        <code key={`${keyPrefix}-${i}`} className="rounded bg-brand-tint px-1.5 py-0.5 text-[0.9em] text-brand-deep">
          {seg.slice(1, -1)}
        </code>
      );
    }
    return <span key={`${keyPrefix}-${i}`}>{seg}</span>;
  });
}

interface HeadingBlock { type: 'h'; level: number; text: string }
interface ListBlock { type: 'ul' | 'ol'; lines: string[] }
interface TipBlock { type: 'tip'; lines: string[] }
interface TableBlock { type: 'table'; rows: string[][] }
interface PBlock { type: 'p'; lines: string[] }
interface HrBlock { type: 'hr' }
type Block = HeadingBlock | ListBlock | TipBlock | TableBlock | PBlock | HrBlock;

const isTableRow = (line: string) => line.startsWith('|') && line.includes('|', 1);

const splitRow = (line: string): string[] => {
  const body = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return body.split('|').map((c) => c.trim());
};

const isSeparatorRow = (cells: string[]) =>
  cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c));

/** 解析女娲实际输出的 Markdown 子集：#~#### 标题、表格、有序/无序列表、> 提示、--- 分隔线、段落 */
function parseBlocks(content: string): Block[] {
  const blocks: Block[] = [];
  const closeP = () => { /* p 在 push 前持续累积，无需显式关闭 */ };
  const last = () => blocks[blocks.length - 1];

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      closeP();
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      blocks.push({ type: 'h', level: heading[1].length, text: heading[2] });
      continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      blocks.push({ type: 'hr' });
      continue;
    }
    if (isTableRow(line)) {
      const block = last();
      if (block?.type === 'table') block.rows.push(splitRow(line));
      else blocks.push({ type: 'table', rows: [splitRow(line)] });
      continue;
    }
    const ul = line.match(/^[-*]\s+(.*)$/);
    if (ul) {
      const item = ul[1];
      if (!item.trim()) continue; // 流式中间态：列表项内容未打出时不渲染空圆点
      const block = last();
      if (block?.type === 'ul') block.lines.push(item);
      else blocks.push({ type: 'ul', lines: [item] });
      continue;
    }
    const ol = line.match(/^\d+[.、]\s+(.*)$/);
    if (ol) {
      const item = ol[1];
      if (!item.trim()) continue;
      const block = last();
      if (block?.type === 'ol') block.lines.push(item);
      else blocks.push({ type: 'ol', lines: [item] });
      continue;
    }
    if (line.startsWith('>')) {
      const text = line.replace(/^>\s?/, '');
      const block = last();
      if (block?.type === 'tip') block.lines.push(text);
      else blocks.push({ type: 'tip', lines: [text] });
      continue;
    }

    // 表格块后面紧跟的非表格行要另起段落，不能拼进表格
    const block = last();
    if (block?.type === 'p') block.lines.push(line);
    else blocks.push({ type: 'p', lines: [line] });
  }
  return blocks;
}

/** 清洗女娲流中夹带的系统标签与 HTML 输出（<agent-info/>、<p> 等），转为纯文本/Markdown 渲染 */
const sanitize = (s: string): string =>
  s
    .replace(/\r\n?/g, '\n')
    .replace(/<agent-info[^>]*(\/>|<\/agent-info>)/g, '')
    .replace(/<agent-info[^<]*$/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|ul|ol|table|tr)>/gi, '\n')
    .replace(/<(p|div|h[1-6]|li|ul|ol|table|tr|td|th)[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n');

function TableView({ rows }: { rows: string[][] }) {
  if (!rows.length) return null;
  // 首行是表头；第二行若是分隔行（|---|---|）则丢弃。无表头（首行即分隔行）时全部作为数据行
  let header: string[] | null = null;
  let body = rows;
  if (rows.length > 1 && isSeparatorRow(rows[1])) {
    header = rows[0];
    body = rows.slice(2);
  } else if (isSeparatorRow(rows[0])) {
    body = rows.slice(1);
  } else {
    header = rows[0];
    body = rows.slice(1);
  }
  const cols = Math.max(header?.length ?? 0, ...body.map((r) => r.length), 1);
  const cell = (text: string, i: number) => (
    <td key={i} className="border border-faint px-3 py-2 align-top text-small leading-6 text-ink-soft">
      {renderInline(text, `td-${i}`)}
    </td>
  );
  return (
    <div className="overflow-x-auto rounded-lg border border-faint">
      <table className="w-full border-collapse text-left">
        {header && (
          <thead>
            <tr className="bg-brand-tint">
              {Array.from({ length: cols }, (_, i) => (
                <th key={i} className="border border-faint px-3 py-2 text-small font-bold text-brand-deep">
                  {renderInline(header![i] ?? '', `th-${i}`)}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {body.map((row, ri) => (
            <tr key={ri} className={ri % 2 ? 'bg-paper/60' : undefined}>
              {Array.from({ length: cols }, (_, ci) => cell(row[ci] ?? '', ci))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Markdown 子集渲染器：标题 / 表格 / 有序与无序列表 / > 提示块 / --- 分隔线 / 段落（保留换行）/ **加粗**、`代码` */
export default function MarkdownMessage({ content, streaming = false }: { content: string; streaming?: boolean }) {
  const cleaned = sanitize(content);
  if (!cleaned.trim()) return streaming ? <span className="inline-block h-4 w-[3px] animate-pulse rounded-full bg-brand align-middle" /> : null;
  const blocks = parseBlocks(cleaned);
  return (
    <div className="space-y-3">
      {blocks.map((block, bi) => {
        const isLast = bi === blocks.length - 1;
        const caret = streaming && isLast && block.type === 'p' && (
          <span className="ml-1 inline-block h-4 w-[3px] animate-pulse rounded-full bg-brand align-middle" />
        );
        switch (block.type) {
          case 'h': {
            const cls =
              block.level <= 2
                ? 'font-display text-[15px] font-bold text-brand-deep'
                : block.level === 3
                  ? 'font-display text-small font-bold text-ink'
                  : 'text-small font-bold text-ink';
            return (
              <p key={bi} className={`${cls} tracking-[-.005em]`}>
                {renderInline(block.text, `h-${bi}`)}
              </p>
            );
          }
          case 'hr':
            return <hr key={bi} className="border-faint" />;
          case 'table':
            return <TableView key={bi} rows={block.rows} />;
          case 'ul':
            return (
              <ul key={bi} className="space-y-2">
                {block.lines.map((line, li) => (
                  <li key={li} className="flex gap-2">
                    <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                    <span className="flex-1">{renderInline(line, `${bi}-${li}`)}</span>
                  </li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={bi} className="ml-1 space-y-2">
                {block.lines.map((line, li) => (
                  <li key={li} className="flex gap-2.5">
                    <span className="mt-px w-5 shrink-0 text-small font-bold text-brand">{li + 1}.</span>
                    <span className="flex-1">{renderInline(line, `${bi}-${li}`)}</span>
                  </li>
                ))}
              </ol>
            );
          case 'tip':
            return (
              <div key={bi} className="flex gap-2.5 rounded-lg border border-gold-soft bg-gold-soft px-3.5 py-2.5">
                <span className="text-sm leading-6">💡</span>
                <div className="flex-1 space-y-1 text-small leading-6 text-gold-deep">
                  {block.lines.map((line, li) => <p key={li}>{renderInline(line, `${bi}-${li}`)}</p>)}
                </div>
              </div>
            );
          default:
            // 段落保留模型的原始换行（soft break），不再把相邻行拼成一堵墙
            return (
              <p key={bi} className="whitespace-pre-wrap">
                {block.lines.map((line, li) => (
                  <Fragment key={li}>
                    {li > 0 && '\n'}
                    {renderInline(line, `${bi}-${li}`)}
                  </Fragment>
                ))}
                {caret}
              </p>
            );
        }
      })}
    </div>
  );
}
