import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { getRelatedFAQs } from '@/lib/faq-data';

interface FAQRelatedProps {
  faqId: string;
}

export function FAQRelated({ faqId }: FAQRelatedProps) {
  const relatedFAQs = getRelatedFAQs(faqId);

  if (relatedFAQs.length === 0) return null;

  return (
    <Card>
      <CardContent className="pt-6">
        <h3 className="font-semibold text-lg mb-4">Related Questions</h3>
        <div className="space-y-2">
          {relatedFAQs.map((faq) => (
            <Link
              key={faq.id}
              to={`/faq#${faq.id}`}
              className="flex items-start gap-2 p-3 rounded-lg hover:bg-accent transition-colors group"
            >
              <ArrowRight className="h-4 w-4 text-primary mt-0.5 flex-shrink-0 group-hover:translate-x-1 transition-transform" />
              <span className="text-sm text-foreground group-hover:text-primary">
                {faq.question}
              </span>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
