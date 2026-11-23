/**
 * A small, safe reading view for Markdown notes such as HANDOFF.md. It recognises headings,
 * list items, code fences and paragraphs and returns plain text blocks; nothing is rendered
 * as HTML.
 */
export type MarkdownBlock =
  | { kind: "heading"; level: 1 | 2 | 3; text: string }
  | { kind: "item"; text: string; depth: number; checked: boolean | null }
  | { kind: "code"; text: string }
  | { kind: "paragraph"; text: string };

function inline(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

export function parseMarkdown(source: string, maxBlocks = 400): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  let paragraph: string[] = [];
  let code: string[] | null = null;

  const flush = () => {
    if (paragraph.length > 0) {
      blocks.push({ kind: "paragraph", text: inline(paragraph.join(" ")) });
      paragraph = [];
    }
  };

  for (const line of lines) {
    if (blocks.length >= maxBlocks) break;
    if (code !== null) {
      if (/^\s*```/.test(line)) {
        blocks.push({ kind: "code", text: code.join("\n") });
        code = null;
      } else {
        code.push(line);
      }
      continue;
    }
    if (/^\s*```/.test(line)) {
      flush();
      code = [];
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      const level = Math.min(heading[1].length, 3) as 1 | 2 | 3;
      blocks.push({ kind: "heading", level, text: inline(heading[2]) });
      continue;
    }
    const item = /^(\s*)(?:[-*+]|\d+[.)])\s+(?:\[([ xX])\]\s+)?(.*)$/.exec(line);
    if (item) {
      flush();
      blocks.push({
        kind: "item",
        depth: Math.min(Math.floor(item[1].replace(/\t/g, "  ").length / 2), 3),
        checked: item[2] === undefined ? null : item[2].toLowerCase() === "x",
        text: inline(item[3]),
      });
      continue;
    }
    if (line.trim() === "") {
      flush();
      continue;
    }
    paragraph.push(line.trim());
  }
  if (code !== null) blocks.push({ kind: "code", text: code.join("\n") });
  flush();
  return blocks.slice(0, maxBlocks);
}
