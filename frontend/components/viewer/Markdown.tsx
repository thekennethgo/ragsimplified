import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Markdown as elements. Raw HTML stays off (react-markdown's default); links open in a new tab. */
export default function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ node, ...props }) => {
          void node;
          return <a {...props} target="_blank" rel="noopener noreferrer" />;
        },
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
