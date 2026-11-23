import { useMemo } from "react";
import { Icon } from "../widgets/icons";
import { parseMarkdown } from "./markdown";

/** Reads a Markdown note as plain text blocks. Nothing is injected as HTML. */
export function MarkdownView({ source }: { source: string }) {
  const blocks = useMemo(() => parseMarkdown(source), [source]);
  return (
    <div className="markdown-view">
      {blocks.map((block, index) => {
        switch (block.kind) {
          case "heading": {
            const Tag = block.level === 1 ? "h2" : block.level === 2 ? "h3" : "h4";
            return <Tag key={index}>{block.text}</Tag>;
          }
          case "item":
            return (
              <p key={index} className={`markdown-item depth-${block.depth}`}>
                <span className={`markdown-bullet ${block.checked === null ? "" : "is-box"}`} aria-hidden>
                  {block.checked === null ? "•" : block.checked ? <Icon name="check" size={10} /> : null}
                </span>
                {block.checked === null ? null : <span className="visually-hidden">{block.checked ? "Done: " : "To do: "}</span>}
                {block.text}
              </p>
            );
          case "code":
            return (
              <pre key={index} className="markdown-code mono">
                {block.text}
              </pre>
            );
          default:
            return <p key={index}>{block.text}</p>;
        }
      })}
    </div>
  );
}
