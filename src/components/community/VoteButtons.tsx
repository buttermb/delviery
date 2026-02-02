/**
 * Vote Buttons Component
 * Upvote/downvote buttons for posts and comments
 */

import { Button } from '@/components/ui/button';
import ArrowUp from "lucide-react/dist/esm/icons/arrow-up";
import ArrowDown from "lucide-react/dist/esm/icons/arrow-down";
import { useVote, useUserVote } from '@/hooks/useVotes';
import { cn } from '@/lib/utils';

interface VoteButtonsProps {
  votableType: 'post' | 'comment';
  votableId: string;
  upvoteCount: number;
  downvoteCount: number;
}

export function VoteButtons({
  votableType,
  votableId,
  upvoteCount,
  downvoteCount,
}: VoteButtonsProps) {
  const { data: userVote } = useUserVote(votableType, votableId);
  const voteMutation = useVote();

  const handleVote = (vote: 1 | -1) => {
    voteMutation.mutate({ votableType, votableId, vote });
  };

  const score = upvoteCount - downvoteCount;

  return (
    <div className="w-12 bg-muted/30 flex flex-col items-center py-2 gap-1 rounded">
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'h-8 w-8 hover:bg-orange-500/10',
          userVote === 1 && 'text-orange-500'
        )}
        onClick={() => handleVote(1)}
        disabled={voteMutation.isPending}
      >
        <ArrowUp
          className={cn(
            'h-5 w-5',
            userVote === 1 && 'fill-orange-500'
          )}
        />
      </Button>

      <span
        className={cn(
          'font-bold text-sm min-w-[24px] text-center',
          score > 0 && 'text-orange-500',
          score < 0 && 'text-blue-500',
          score === 0 && 'text-muted-foreground'
        )}
      >
        {score}
      </span>

      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'h-8 w-8 hover:bg-blue-500/10',
          userVote === -1 && 'text-blue-500'
        )}
        onClick={() => handleVote(-1)}
        disabled={voteMutation.isPending}
      >
        <ArrowDown
          className={cn(
            'h-5 w-5',
            userVote === -1 && 'fill-blue-500'
          )}
        />
      </Button>
    </div>
  );
}

