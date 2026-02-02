/**
 * Empty State Component
 * Reusable empty states for forum pages
 */

import MessageSquare from "lucide-react/dist/esm/icons/message-square";
import Search from "lucide-react/dist/esm/icons/search";
import FileQuestion from "lucide-react/dist/esm/icons/file-question";
import Users from "lucide-react/dist/esm/icons/users";
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

interface EmptyStateProps {
  type: 'posts' | 'comments' | 'search' | 'profile';
  message?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}

export function EmptyState({ type, message, actionLabel, actionHref, onAction }: EmptyStateProps) {
  const configs = {
    posts: {
      icon: MessageSquare,
      title: 'No posts yet',
      defaultMessage: 'Be the first to share something with the community!',
      defaultAction: 'Create Post',
      defaultHref: '/community/create',
    },
    comments: {
      icon: MessageSquare,
      title: 'No comments yet',
      defaultMessage: 'Be the first to comment on this post!',
      defaultAction: 'Add Comment',
    },
    search: {
      icon: Search,
      title: 'No results found',
      defaultMessage: 'Try adjusting your search terms.',
      defaultAction: 'Clear Search',
    },
    profile: {
      icon: Users,
      title: 'No posts',
      defaultMessage: 'This user hasn\'t posted anything yet.',
    },
  };

  const config = configs[type];
  const Icon = config.icon;
  const displayMessage = message || config.defaultMessage;
  const displayAction = actionLabel || ('defaultAction' in config ? config.defaultAction : undefined);
  const displayHref = actionHref || ('defaultHref' in config ? config.defaultHref : undefined);

  return (
    <div className="text-center py-12 px-4">
      <div className="flex justify-center mb-4">
        <div className="rounded-full bg-muted p-4">
          <Icon className="h-8 w-8 text-muted-foreground" />
        </div>
      </div>
      <h3 className="text-lg font-semibold mb-2">{config.title}</h3>
      <p className="text-muted-foreground mb-6 max-w-md mx-auto">{displayMessage}</p>
      {(displayHref || onAction) && displayAction && (
        <div>
          {displayHref ? (
            <Button asChild>
              <Link to={displayHref}>{displayAction}</Link>
            </Button>
          ) : (
            <Button onClick={onAction}>{displayAction}</Button>
          )}
        </div>
      )}
    </div>
  );
}

