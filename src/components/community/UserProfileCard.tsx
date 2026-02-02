/**
 * User Profile Card Component
 * Displays forum user profile information
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import Trophy from "lucide-react/dist/esm/icons/trophy";
import MessageSquare from "lucide-react/dist/esm/icons/message-square";
import FileText from "lucide-react/dist/esm/icons/file-text";
import type { ForumUserProfile, UserReputation } from '@/types/forum';

interface UserProfileCardProps {
  profile: ForumUserProfile;
  reputation?: UserReputation | null;
}

export function UserProfileCard({ profile, reputation }: UserProfileCardProps) {
  const displayName = profile.display_name || profile.username;
  const initials = displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={profile.avatar_url || undefined} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <CardTitle className="text-xl">{displayName}</CardTitle>
            <p className="text-sm text-muted-foreground">u/{profile.username}</p>
            {profile.bio && (
              <p className="text-sm mt-2">{profile.bio}</p>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {reputation && (
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-2xl font-bold text-orange-500">
                <Trophy className="h-5 w-5" />
                {reputation.total_karma}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Total Karma</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold">{reputation.post_karma}</div>
              <div className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                <FileText className="h-3 w-3" />
                Post Karma
              </div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold">{reputation.comment_karma}</div>
              <div className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                <MessageSquare className="h-3 w-3" />
                Comment Karma
              </div>
            </div>
          </div>
        )}
        {reputation && (
          <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Posts:</span>{' '}
              <span className="font-medium">{reputation.posts_created}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Comments:</span>{' '}
              <span className="font-medium">{reputation.comments_created}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

