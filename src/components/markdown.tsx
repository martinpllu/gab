import type { ComponentChildren, VNode } from 'preact';

// Lightweight markdown for agent response bubbles. The inline surface is small
// — bold, italic, inline code, and links — and composes with the bubble's
// `white-space: pre-wrap`, which handles line breaks and paragraph spacing.
// On top of that we recognise two block constructs that can't survive pre-wrap
// and so are lifted out into real markup: GitHub-flavoured tables and
// bullet/numbered lists. Everything else falls through as inline text untouched.

type Token =
  | { type: 'text'; value: string }
  | { type: 'code'; value: string }
  | { type: 'strong'; children: Token[] }
  | { type: 'em'; children: Token[] }
  | { type: 'link'; href: string; children: Token[] };

type Align = 'left' | 'center' | 'right' | null;

type Block =
  | { type: 'text'; value: string }
  | { type: 'table'; header: string[]; align: Align[]; rows: string[][] }
  | { type: 'list'; ordered: boolean; start: number; items: string[] };

/**
 * Render a string of markdown to Preact nodes. Recognises inline emphasis, GFM
 * tables, and bullet/numbered lists; all other text passes through verbatim.
 * Unmatched inline markers (a lone `*`, an unterminated `` ` ``) and malformed
 * blocks render as-is, so partial/streaming text never disappears.
 */
export function InlineMarkdown(props: { text: string }): VNode {
  return <>{splitBlocks(props.text).map(renderBlock)}</>;
}

// ─── block layer: split off GFM tables, leave the rest as inline text ─────────

function splitBlocks(src: string): Block[] {
  const lines = src.split('\n');
  const blocks: Block[] = [];
  let text: string[] = [];

  const flushText = () => {
    if (text.length) {
      blocks.push({ type: 'text', value: text.join('\n') });
      text = [];
    }
  };

  // Drop a trailing blank line from accumulated prose, then flush it, so a
  // lifted-out block doesn't leave a gap where its separating newline was.
  const flushBefore = () => {
    if (text.length && text[text.length - 1].trim() === '') text.pop();
    flushText();
  };

  let i = 0;
  while (i < lines.length) {
    const table = parseTable(lines, i);
    if (table) {
      flushBefore();
      blocks.push(table.block);
      i = table.next;
      if (i < lines.length && lines[i].trim() === '') i += 1;
      continue;
    }

    const list = parseList(lines, i);
    if (list) {
      flushBefore();
      blocks.push(list.block);
      i = list.next;
      if (i < lines.length && lines[i].trim() === '') i += 1;
      continue;
    }

    text.push(lines[i]);
    i += 1;
  }

  flushText();
  return blocks;
}

// Match a list item marker at the line start: `-`, `*`, `+` (unordered) or
// `N.` / `N)` (ordered), allowing up to three leading spaces. Capture groups:
// 1 = ordered number (undefined for bullets), 2 = item content.
const LIST_ITEM = /^ {0,3}(?:[-*+]|(\d{1,9})[.)])\s+(.*)$/;

// Parse a run of list items into one block. Mixed marker kinds aren't merged:
// the run ends when the ordered/unordered nature flips. Continuation/indented
// lines are out of scope — each item is a single line of inline markdown.
function parseList(
  lines: string[],
  start: number,
): { block: Extract<Block, { type: 'list' }>; next: number } | null {
  const first = LIST_ITEM.exec(lines[start]);
  if (!first) return null;
  const ordered = first[1] !== undefined;
  const startNum = ordered ? Number(first[1]) : 1;

  const items: string[] = [];
  let i = start;
  while (i < lines.length) {
    const m = LIST_ITEM.exec(lines[i]);
    if (!m) break;
    if ((m[1] !== undefined) !== ordered) break; // marker kind flipped
    items.push(m[2]);
    i += 1;
  }

  return {
    block: { type: 'list', ordered, start: startNum, items },
    next: i,
  };
}

// Recognise a GFM table starting at `start`: a header row, a delimiter row
// (cells of dashes with optional leading/trailing colons), then zero or more
// body rows. Returns the parsed block and the index just past it, or null.
function parseTable(
  lines: string[],
  start: number,
): { block: Extract<Block, { type: 'table' }>; next: number } | null {
  if (start + 1 >= lines.length) return null;
  if (!looksLikeRow(lines[start])) return null;
  const align = parseDelimiter(lines[start + 1]);
  if (!align) return null;

  const header = splitRow(lines[start]);
  // The delimiter dictates column count; ragged header/body rows are padded or
  // clipped to it so we never index out of bounds while rendering.
  const cols = align.length;
  if (header.length !== cols) return null;

  const rows: string[][] = [];
  let i = start + 2;
  while (i < lines.length && looksLikeRow(lines[i])) {
    rows.push(fit(splitRow(lines[i]), cols));
    i += 1;
  }
  if (rows.length === 0) return null;

  return {
    block: { type: 'table', header: fit(header, cols), align, rows },
    next: i,
  };
}

// A plausible table row: contains a pipe that isn't escaped. (The delimiter
// row is validated separately, so the bar here is intentionally low.)
function looksLikeRow(line: string): boolean {
  return /(?:^|[^\\])\|/.test(line) && line.trim() !== '';
}

// Parse a delimiter row into per-column alignment, or null if it isn't one.
// Each cell must be dashes with optional surrounding colons: ---  :--  --:  :-:
function parseDelimiter(line: string): Align[] | null {
  const cells = splitRow(line);
  if (cells.length === 0) return null;
  const align: Align[] = [];
  for (const cell of cells) {
    const m = /^(:?)-+(:?)$/.exec(cell.trim());
    if (!m) return null;
    const left = m[1] === ':';
    const right = m[2] === ':';
    align.push(left && right ? 'center' : right ? 'right' : left ? 'left' : null);
  }
  return align;
}

// Split a table row into cells on unescaped pipes, dropping the optional
// leading/trailing pipe. A literal pipe in a cell is written `\|`.
function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);

  const cells: string[] = [];
  let buf = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && s[i + 1] === '|') {
      buf += '|';
      i += 1;
      continue;
    }
    if (s[i] === '|') {
      cells.push(buf.trim());
      buf = '';
      continue;
    }
    buf += s[i];
  }
  cells.push(buf.trim());
  return cells;
}

function fit(cells: string[], n: number): string[] {
  const out = cells.slice(0, n);
  while (out.length < n) out.push('');
  return out;
}

function renderBlock(block: Block, key: number): ComponentChildren {
  if (block.type === 'text') {
    return <span key={key}>{render(tokenize(block.value))}</span>;
  }
  if (block.type === 'list') {
    const items = block.items.map((item, n) => (
      <li key={n}>{render(tokenize(item))}</li>
    ));
    return block.ordered ? (
      <ol class="md-list" start={block.start} key={key}>{items}</ol>
    ) : (
      <ul class="md-list" key={key}>{items}</ul>
    );
  }
  return (
    <table class="md-table" key={key}>
      <thead>
        <tr>
          {block.header.map((cell, c) => (
            <th key={c} style={alignStyle(block.align[c])}>
              {render(tokenize(cell))}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {block.rows.map((row, r) => (
          <tr key={r}>
            {row.map((cell, c) => (
              <td key={c} style={alignStyle(block.align[c])}>
                {render(tokenize(cell))}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function alignStyle(a: Align): { textAlign: Align } | undefined {
  return a ? { textAlign: a } : undefined;
}

// ─── inline layer ─────────────────────────────────────────────────────────────

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let buf = '';
  let i = 0;

  const flush = () => {
    if (buf) {
      tokens.push({ type: 'text', value: buf });
      buf = '';
    }
  };

  while (i < len(src)) {
    const ch = src[i];

    // Backslash escape: the next char is taken literally.
    if (ch === '\\' && i + 1 < len(src)) {
      buf += src[i + 1];
      i += 2;
      continue;
    }

    // Inline code — spans to the next matching run of backticks, no nesting.
    if (ch === '`') {
      const fence = runLength(src, i, '`');
      const close = findClose(src, i + fence, '`'.repeat(fence));
      if (close !== -1) {
        flush();
        tokens.push({ type: 'code', value: src.slice(i + fence, close) });
        i = close + fence;
        continue;
      }
    }

    // Links — [label](href). Falls through to literal text if malformed.
    if (ch === '[') {
      const link = parseLink(src, i);
      if (link) {
        flush();
        tokens.push(link.token);
        i = link.next;
        continue;
      }
    }

    // Strong (** or __) takes precedence over emphasis (* or _). Underscore
    // markers must sit on a word boundary so identifiers like snake_case_word
    // are left alone — this mirrors CommonMark's intraword `_` rule, while `*`
    // is allowed mid-word.
    if ((ch === '*' || ch === '_') && canOpenMarker(src, i, ch)) {
      const isDouble = src[i + 1] === ch;
      const marker = isDouble ? ch + ch : ch;
      const close = findClose(src, i + marker.length, marker);
      if (close !== -1 && close > i + marker.length) {
        flush();
        const inner = tokenize(src.slice(i + marker.length, close));
        tokens.push({ type: isDouble ? 'strong' : 'em', children: inner });
        i = close + marker.length;
        continue;
      }
    }

    buf += ch;
    i += 1;
  }

  flush();
  return tokens;
}

function parseLink(
  src: string,
  start: number,
): { token: Token; next: number } | null {
  const labelEnd = findClose(src, start + 1, ']');
  if (labelEnd === -1 || src[labelEnd + 1] !== '(') return null;
  const hrefEnd = findClose(src, labelEnd + 2, ')');
  if (hrefEnd === -1) return null;
  const href = src.slice(labelEnd + 2, hrefEnd).trim();
  if (!isSafeHref(href)) return null;
  return {
    token: {
      type: 'link',
      href,
      children: tokenize(src.slice(start + 1, labelEnd)),
    },
    next: hrefEnd + 1,
  };
}

// Only http(s) and mailto links open as anchors; anything else (notably
// javascript:) renders as plain text so the markup can't smuggle a scheme.
function isSafeHref(href: string): boolean {
  return /^(https?:\/\/|mailto:)/i.test(href);
}

function render(tokens: Token[]): ComponentChildren {
  return tokens.map((t, key) => {
    switch (t.type) {
      case 'text':
        return t.value;
      case 'code':
        return <code class="md-code" key={key}>{t.value}</code>;
      case 'strong':
        return <strong key={key}>{render(t.children)}</strong>;
      case 'em':
        return <em key={key}>{render(t.children)}</em>;
      case 'link':
        return (
          <a
            key={key}
            href={t.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            {render(t.children)}
          </a>
        );
    }
  });
}

// Index of the start of the next occurrence of `needle` at or after `from`,
// honoring backslash escapes; -1 if none.
function findClose(src: string, from: number, needle: string): number {
  let i = from;
  while (i < len(src)) {
    if (src[i] === '\\') {
      i += 2;
      continue;
    }
    if (src.startsWith(needle, i)) return i;
    i += 1;
  }
  return -1;
}

// Whether an emphasis marker may open here. `*` always may; `_` only when the
// preceding char isn't alphanumeric, so intraword underscores stay literal.
function canOpenMarker(src: string, i: number, ch: string): boolean {
  if (ch === '*') return true;
  const prev = src[i - 1];
  return prev === undefined || !/[A-Za-z0-9]/.test(prev);
}

function runLength(src: string, from: number, ch: string): number {
  let n = 0;
  while (from + n < len(src) && src[from + n] === ch) n += 1;
  return n;
}

function len(s: string): number {
  return s.length;
}
