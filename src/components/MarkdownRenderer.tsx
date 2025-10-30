import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div
      className={cn(
        'prose prose-sm max-w-none',
        'prose-headings:font-bold prose-headings:text-foreground',
        'prose-p:text-muted-foreground prose-p:leading-relaxed',
        'prose-a:text-primary prose-a:no-underline hover:prose-a:underline',
        'prose-strong:text-foreground prose-strong:font-semibold',
        'prose-ul:list-disc prose-ul:pl-6 prose-ul:text-muted-foreground',
        'prose-ol:list-decimal prose-ol:pl-6 prose-ol:text-muted-foreground',
        'prose-li:my-1',
        'prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm',
        'prose-pre:bg-muted prose-pre:p-4 prose-pre:rounded-lg prose-pre:overflow-x-auto',
        'prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:pl-4 prose-blockquote:italic',
        'prose-img:rounded-lg prose-img:shadow-md',
        className
      )}
    >
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
