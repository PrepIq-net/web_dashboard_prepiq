import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function isSafeHref(href?: string): href is string {
  return Boolean(
    href &&
      (href.startsWith("/") || href.startsWith("https://") || href.startsWith("http://")),
  );
}

/**
 * Compact markdown renderer for AI-generated text — assistant chat replies
 * and the Today briefing narrative. Replaces the older hand-rolled
 * bold/bullet/table parser with real markdown (links, italics, nested lists,
 * code, etc.) while staying safe: react-markdown never executes embedded
 * HTML unless rehype-raw is added, which it deliberately isn't here, and
 * links are re-validated the same way the old renderer did.
 */
export function AssistantMarkdown({ content }: { content: string }) {
  return (
    <div className="space-y-1.5 break-words [&_p]:m-0 [&_ul]:m-0 [&_ol]:m-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p>{children}</p>,
          strong: ({ children }) => (
            <strong className="font-semibold text-text-primary">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          a: ({ href, children }) =>
            isSafeHref(href) ? (
              <a
                href={href}
                target={href.startsWith("/") ? undefined : "_blank"}
                rel="noopener noreferrer"
                className="text-brand-gold underline underline-offset-2 hover:opacity-80"
              >
                {children}
              </a>
            ) : (
              <>{children}</>
            ),
          ul: ({ children }) => (
            <ul className="list-disc space-y-1 pl-4 marker:text-brand-gold">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal space-y-1 pl-4 marker:text-brand-gold">{children}</ol>
          ),
          li: ({ children }) => <li className="pl-0.5">{children}</li>,
          h1: ({ children }) => (
            <p className="mt-1.5 font-semibold text-text-primary">{children}</p>
          ),
          h2: ({ children }) => (
            <p className="mt-1.5 font-semibold text-text-primary">{children}</p>
          ),
          h3: ({ children }) => (
            <p className="mt-1.5 font-semibold text-text-primary">{children}</p>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-brand-gold/50 pl-2.5 text-text-secondary">
              {children}
            </blockquote>
          ),
          code: ({ className, children }) => {
            const isBlock = Boolean(className?.startsWith("language-"));
            return isBlock ? (
              <code className="block overflow-x-auto font-mono text-[12px] leading-relaxed">
                {children}
              </code>
            ) : (
              <code className="rounded border border-surface-4 bg-surface-3 px-1 py-0.5 font-mono text-[0.85em]">
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="overflow-x-auto rounded-lg border border-surface-4 bg-surface-3 p-2.5">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto rounded-lg border border-surface-4 scrollbar-thin">
              <table className="w-full border-collapse text-xs">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-surface-3">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="border-b border-surface-4 px-2.5 py-1.5 text-left font-semibold text-text-primary">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-surface-4/60 px-2.5 py-1.5 text-text-secondary">
              {children}
            </td>
          ),
          hr: () => <hr className="border-surface-4/60" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
