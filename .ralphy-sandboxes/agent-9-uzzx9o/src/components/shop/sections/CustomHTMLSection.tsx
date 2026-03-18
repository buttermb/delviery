import { sanitizeHtml } from '@/lib/utils/sanitize';

export interface CustomHTMLSectionProps {
    content: {
        html_content: string;
        section_title?: string;
    };
    styles: {
        background_color: string;
        text_color: string;
        padding_y: string;
        max_width: string;
    };
}

export function CustomHTMLSection({ content, styles }: CustomHTMLSectionProps) {
    const {
        html_content = '',
        section_title = '',
    } = content || {};

    const {
        background_color = '#ffffff',
        text_color = '#000000',
        padding_y = '4rem',
        max_width = '1200px',
    } = styles || {};

    // Sanitize the HTML content to prevent XSS
    const sanitizedHtml = sanitizeHtml(html_content);

    return (
        <section
            className="w-full"
            style={{
                backgroundColor: background_color,
                color: text_color,
                paddingTop: padding_y,
                paddingBottom: padding_y,
            }}
        >
            <div
                className="mx-auto px-6"
                style={{ maxWidth: max_width }}
            >
                {section_title && (
                    <h2
                        className="text-2xl md:text-3xl font-semibold mb-8 text-center"
                        style={{ color: text_color }}
                    >
                        {section_title}
                    </h2>
                )}
                <div
                    className="prose prose-lg max-w-none"
                    style={{ color: text_color }}
                    dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                />
            </div>
        </section>
    );
}
