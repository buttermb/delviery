import { useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface FAQRatingProps {
  faqId: string;
}

export function FAQRating({ faqId }: FAQRatingProps) {
  const [voted, setVoted] = useState<'up' | 'down' | null>(null);

  const handleVote = (vote: 'up' | 'down') => {
    setVoted(vote);
    toast.success(vote === 'up' ? 'Glad we could help!' : 'Thanks for your feedback. We\'ll improve this answer.');
  };

  if (voted) {
    return (
      <div className="text-sm text-muted-foreground">
        Thanks for your feedback!
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Was this helpful?</span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleVote('up')}
        className="h-8 px-3"
      >
        <ThumbsUp className="h-4 w-4 mr-1" />
        Yes
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleVote('down')}
        className="h-8 px-3"
      >
        <ThumbsDown className="h-4 w-4 mr-1" />
        No
      </Button>
    </div>
  );
}
