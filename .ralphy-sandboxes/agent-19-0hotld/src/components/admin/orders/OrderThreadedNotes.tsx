/**
 * Order Threaded Notes Component
 *
 * Internal notes section for order detail pages with:
 * - @mention support for team members
 * - Notification dispatch when users are mentioned
 * - Threaded comments display with user avatars
 * - Real-time updates via subscription
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import type { NotificationType } from '@/hooks/useNotificationDispatcher';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useNotificationDispatcher } from '@/hooks/useNotificationDispatcher';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import MessageSquare from 'lucide-react/dist/esm/icons/message-square';
import Send from 'lucide-react/dist/esm/icons/send';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import AtSign from 'lucide-react/dist/esm/icons/at-sign';
import Pin from 'lucide-react/dist/esm/icons/pin';
import PinOff from 'lucide-react/dist/esm/icons/pin-off';
import MoreVertical from 'lucide-react/dist/esm/icons/more-vertical';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { queryKeys } from '@/lib/queryKeys';
import type { PinReason } from '@/hooks/usePinnedOrderNotes';
import { getInitials } from '@/lib/utils/getInitials';

/** Team member for @mentions */
interface TeamMember {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  role: string;
}

/** Order note from the database */
interface OrderNote {
  id: string;
  tenant_id: string;
  order_id: string;
  user_id: string;
  content: string;
  mentioned_user_ids: string[];
  created_at: string;
  is_pinned?: boolean;
  pinned_at?: string | null;
  pinned_by?: string | null;
  pin_reason?: string | null;
  // Joined user info
  user?: {
    user_id: string;
    full_name: string | null;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
    email: string;
  } | null;
}

export interface OrderThreadedNotesProps {
  /** The order ID to display notes for */
  orderId: string;
  /** Order number for notification context */
  orderNumber?: string;
  /** Additional className */
  className?: string;
}

export function OrderThreadedNotes({
  orderId,
  orderNumber,
  className,
}: OrderThreadedNotesProps) {
  const { tenant, admin } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const { dispatchNotification } = useNotificationDispatcher();

  const [noteContent, setNoteContent] = useState('');
  const [mentionSearch, setMentionSearch] = useState('');
  const [showMentionPopover, setShowMentionPopover] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const tenantId = tenant?.id;
  const currentUserId = admin?.id;

  // Query key for notes - memoized to prevent useEffect dependency changes
  const notesQueryKey = useMemo(() => ['order-notes', orderId, tenantId], [orderId, tenantId]);

  // Fetch team members for @mentions
  const { data: teamMembers = [] } = useQuery({
    queryKey: queryKeys.orderThreadedNotes.teamMembers(tenantId),
    queryFn: async (): Promise<TeamMember[]> => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('tenant_users')
        .select('id, user_id, email, full_name, first_name, last_name, avatar_url, role')
        .eq('tenant_id', tenantId)
        .eq('status', 'active');

      if (error) {
        logger.error('Failed to fetch team members', error, {
          component: 'OrderThreadedNotes',
        });
        return [];
      }

      return (data ?? []) as unknown as TeamMember[];
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Fetch order notes
  const { data: notes = [], isLoading } = useQuery({
    queryKey: notesQueryKey,
    queryFn: async (): Promise<OrderNote[]> => {
      if (!tenantId || !orderId) return [];

      // Query order_notes with user info joined
      const { data, error } = await supabase
        .from('order_notes')
        .select(`
          id,
          tenant_id,
          order_id,
          user_id,
          content,
          mentioned_user_ids,
          created_at,
          is_pinned,
          pinned_at,
          pinned_by,
          pin_reason,
          user:tenant_users!order_notes_user_id_fkey(user_id, full_name, first_name, last_name, avatar_url, email)
        `)
        .eq('order_id', orderId)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: true });

      if (error) {
        // Table might not exist yet
        if ((error as { code?: string }).code === '42P01') {
          logger.debug('order_notes table does not exist yet', {
            component: 'OrderThreadedNotes',
          });
          return [];
        }
        logger.error('Failed to fetch order notes', error as Error, {
          component: 'OrderThreadedNotes',
          orderId,
        });
        return [];
      }

      return (data ?? []) as unknown as OrderNote[];
    },
    enabled: !!tenantId && !!orderId,
  });

  // Create note mutation
  const createNoteMutation = useMutation({
    mutationFn: async (content: string): Promise<OrderNote> => {
      if (!tenantId || !currentUserId || !orderId) {
        throw new Error('Missing required data');
      }

      // Extract mentioned user IDs from content
      const mentionPattern = /@\[([^\]]+)\]\(([^)]+)\)/g;
      const mentionedUserIds: string[] = [];
      let match: RegExpExecArray | null;

      while ((match = mentionPattern.exec(content)) !== null) {
        mentionedUserIds.push(match[2]); // match[2] is the user_id
      }

      // Convert display mentions to plain @names for storage
      const plainContent = content.replace(mentionPattern, '@$1');

      const { data, error } = await supabase
        .from('order_notes')
        .insert({
          tenant_id: tenantId,
          order_id: orderId,
          user_id: currentUserId,
          content: plainContent,
          mentioned_user_ids: mentionedUserIds,
        })
        .select(`
          id,
          tenant_id,
          order_id,
          user_id,
          content,
          mentioned_user_ids,
          created_at
        `)
        .maybeSingle();

      if (error) throw error;

      return data as unknown as OrderNote;
    },
    onSuccess: async (newNote) => {
      // Invalidate notes query
      queryClient.invalidateQueries({ queryKey: notesQueryKey });

      // Send notifications to mentioned users
      if (newNote.mentioned_user_ids && newNote.mentioned_user_ids.length > 0) {
        for (const mentionedUserId of newNote.mentioned_user_ids) {
          // Don't notify yourself
          if (mentionedUserId === currentUserId) continue;

          try {
            await dispatchNotification({
              userId: mentionedUserId,
              title: 'You were mentioned in an order note',
              message: `You were mentioned in a note on order ${orderNumber || orderId.slice(0, 8)}`,
              type: 'info' as NotificationType,
              entityType: 'order',
              entityId: orderId,
            });

            logger.debug('Sent mention notification', {
              component: 'OrderThreadedNotes',
              mentionedUserId,
              orderId,
            });
          } catch (notifError) {
            logger.error('Failed to send mention notification', notifError as Error, {
              component: 'OrderThreadedNotes',
              mentionedUserId,
            });
          }
        }
      }

      // Clear input
      setNoteContent('');
      toast.success('Note added');
    },
    onError: (error) => {
      logger.error('Failed to create order note', error, {
        component: 'OrderThreadedNotes',
        orderId,
      });
      toast.error('Failed to add note', { description: humanizeError(error) });
    },
  });

  // Pin note mutation
  const pinNoteMutation = useMutation({
    mutationFn: async ({ noteId, reason }: { noteId: string; reason?: PinReason }): Promise<void> => {
      if (!tenantId || !currentUserId) {
        throw new Error('Missing required data');
      }

      const { error: updateError } = await supabase
        .from('order_notes')
        .update({
          is_pinned: true,
          pinned_at: new Date().toISOString(),
          pinned_by: currentUserId,
          pin_reason: reason || null,
        })
        .eq('id', noteId)
        .eq('tenant_id', tenantId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notesQueryKey });
      queryClient.invalidateQueries({ queryKey: queryKeys.orderNotes.pinned(tenantId) });
      toast.success('Note pinned to dashboard');
    },
    onError: (err) => {
      logger.error('Failed to pin order note', err, {
        component: 'OrderThreadedNotes',
      });
      toast.error('Failed to pin note', { description: humanizeError(err) });
    },
  });

  // Unpin note mutation
  const unpinNoteMutation = useMutation({
    mutationFn: async (noteId: string): Promise<void> => {
      if (!tenantId) {
        throw new Error('Missing tenant ID');
      }

      const { error: updateError } = await supabase
        .from('order_notes')
        .update({
          is_pinned: false,
          pinned_at: null,
          pinned_by: null,
          pin_reason: null,
        })
        .eq('id', noteId)
        .eq('tenant_id', tenantId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notesQueryKey });
      queryClient.invalidateQueries({ queryKey: queryKeys.orderNotes.pinned(tenantId) });
      toast.success('Note unpinned from dashboard');
    },
    onError: (err) => {
      logger.error('Failed to unpin order note', err, {
        component: 'OrderThreadedNotes',
      });
      toast.error('Failed to unpin note', { description: humanizeError(err) });
    },
  });

  // State for pin reason dialog
  const [_pinningNoteId, setPinningNoteId] = useState<string | null>(null);
  const [_selectedPinReason, _setSelectedPinReason] = useState<PinReason>('custom');

  const handlePinNote = (noteId: string, reason?: PinReason) => {
    pinNoteMutation.mutate({ noteId, reason });
    setPinningNoteId(null);
  };

  const handleUnpinNote = (noteId: string) => {
    unpinNoteMutation.mutate(noteId);
  };

  // Handle textarea change and detect @mentions
  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      const position = e.target.selectionStart ?? 0;

      setNoteContent(value);
      setCursorPosition(position);

      // Detect if we're in a mention context (typing after @)
      const textBeforeCursor = value.slice(0, position);
      const atMatch = textBeforeCursor.match(/@(\w*)$/);

      if (atMatch) {
        setMentionSearch(atMatch[1].toLowerCase());
        setShowMentionPopover(true);
      } else {
        setShowMentionPopover(false);
        setMentionSearch('');
      }
    },
    []
  );

  // Filter team members for mention dropdown
  const filteredMembers = useMemo(() => {
    if (!mentionSearch) return teamMembers;

    return teamMembers.filter((member) => {
      const name = (member.full_name || (member.email ?? '')).toLowerCase();
      const email = member.email.toLowerCase();
      return name.includes(mentionSearch) || email.includes(mentionSearch);
    });
  }, [teamMembers, mentionSearch]);

  // Handle selecting a team member for mention
  const handleSelectMention = useCallback(
    (member: TeamMember) => {
      const displayName = member.full_name || member.email.split('@')[0];

      // Find the @ position before cursor
      const textBeforeCursor = noteContent.slice(0, cursorPosition);
      const atIndex = textBeforeCursor.lastIndexOf('@');

      if (atIndex !== -1) {
        // Replace @search with @[name](user_id)
        const before = noteContent.slice(0, atIndex);
        const after = noteContent.slice(cursorPosition);
        const mentionText = `@[${displayName}](${member.user_id}) `;

        const newContent = before + mentionText + after;
        setNoteContent(newContent);

        // Focus textarea and set cursor after mention
        setTimeout(() => {
          if (textareaRef.current) {
            const newPosition = before.length + mentionText.length;
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(newPosition, newPosition);
          }
        }, 0);
      }

      setShowMentionPopover(false);
      setMentionSearch('');
    },
    [noteContent, cursorPosition]
  );

  // Handle form submit
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      const trimmedContent = noteContent.trim();
      if (!trimmedContent) return;

      createNoteMutation.mutate(trimmedContent);
    },
    [noteContent, createNoteMutation]
  );


  // Format note content with highlighted mentions
  const formatNoteContent = (content: string): React.ReactNode => {
    // Match @name patterns
    const parts = content.split(/(@\w+)/g);

    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        return (
          <span
            key={index}
            className="text-primary font-medium bg-primary/10 px-1 rounded"
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  // Set up realtime subscription
  useEffect(() => {
    if (!tenantId || !orderId) return;

    const channel = supabase
      .channel(`order-notes-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_notes',
          filter: `order_id=eq.${orderId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: notesQueryKey });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, orderId, queryClient, notesQueryKey]);

  if (!tenantId) {
    return null;
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Internal Notes
          {notes.length > 0 && (
            <span className="text-xs text-muted-foreground font-normal">
              ({notes.length})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Notes List */}
        <div className="space-y-4 max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : notes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No notes yet</p>
              <p className="text-xs">
                Add internal notes about this order. Use @mentions to notify team members.
              </p>
            </div>
          ) : (
            notes.map((note) => {
              const userName =
                note.user?.full_name ||
                (note.user?.first_name && note.user?.last_name
                  ? `${note.user.first_name} ${note.user.last_name}`
                  : null) ||
                note.user?.email ||
                'Unknown';

              return (
                <div
                  key={note.id}
                  className={cn(
                    'flex gap-3 group p-2 -mx-2 rounded-lg transition-colors',
                    note.is_pinned && 'bg-orange-50/50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800'
                  )}
                >
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarImage src={note.user?.avatar_url || undefined} alt={note.user?.full_name || note.user?.email || "User"} />
                    <AvatarFallback className="text-xs">
                      {getInitials(
                        note.user?.full_name || null,
                        note.user?.email
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">
                        {userName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(note.created_at), {
                          addSuffix: true,
                        })}
                      </span>
                      {note.is_pinned && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-700">
                          <Pin className="h-2.5 w-2.5 mr-1" />
                          Pinned
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 text-sm whitespace-pre-wrap break-words">
                      {formatNoteContent(note.content)}
                    </div>
                  </div>
                  {/* Pin/Unpin Action Menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                        aria-label="More options"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {note.is_pinned ? (
                        <DropdownMenuItem
                          onClick={() => handleUnpinNote(note.id)}
                          disabled={unpinNoteMutation.isPending}
                        >
                          <PinOff className="h-4 w-4 mr-2" />
                          Unpin from Dashboard
                        </DropdownMenuItem>
                      ) : (
                        <>
                          <DropdownMenuItem
                            onClick={() => handlePinNote(note.id, 'wrong_address')}
                            disabled={pinNoteMutation.isPending}
                          >
                            <Pin className="h-4 w-4 mr-2 text-red-500" />
                            Pin: Wrong Address
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handlePinNote(note.id, 'callback_needed')}
                            disabled={pinNoteMutation.isPending}
                          >
                            <Pin className="h-4 w-4 mr-2 text-orange-500" />
                            Pin: Callback Needed
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handlePinNote(note.id, 'substitution_required')}
                            disabled={pinNoteMutation.isPending}
                          >
                            <Pin className="h-4 w-4 mr-2 text-yellow-500" />
                            Pin: Substitution Required
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handlePinNote(note.id, 'custom')}
                            disabled={pinNoteMutation.isPending}
                          >
                            <Pin className="h-4 w-4 mr-2" />
                            Pin to Dashboard
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })
          )}
        </div>

        {/* Add Note Form */}
        <form onSubmit={handleSubmit} className="space-y-3 pt-3 border-t">
          <div className="relative">
            <Popover open={showMentionPopover} onOpenChange={setShowMentionPopover}>
              <PopoverTrigger asChild>
                <Textarea
                  ref={textareaRef}
                  value={noteContent}
                  onChange={handleContentChange}
                  placeholder="Add a note... Use @ to mention team members"
                  aria-label="Add order note"
                  rows={3}
                  className="resize-none pr-10"
                  disabled={createNoteMutation.isPending}
                />
              </PopoverTrigger>
              <PopoverContent
                className="w-64 p-0"
                align="start"
                side="top"
                sideOffset={5}
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <Command>
                  <CommandList>
                    <CommandEmpty>No team members found</CommandEmpty>
                    <CommandGroup heading="Team Members">
                      {filteredMembers.slice(0, 5).map((member) => (
                        <CommandItem
                          key={member.user_id}
                          value={member.user_id}
                          onSelect={() => handleSelectMention(member)}
                          className="cursor-pointer"
                        >
                          <Avatar className="h-6 w-6 mr-2">
                            <AvatarImage src={member.avatar_url || undefined} alt={member.full_name || member.email} />
                            <AvatarFallback className="text-xs">
                              {getInitials(member.full_name, member.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="text-sm">
                              {member.full_name || member.email.split('@')[0]}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {member.role}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2 h-6 w-6"
              aria-label="Mention"
              onClick={() => {
                if (textareaRef.current) {
                  const position = textareaRef.current.selectionStart || noteContent.length;
                  const before = noteContent.slice(0, position);
                  const after = noteContent.slice(position);
                  setNoteContent(before + '@' + after);
                  setCursorPosition(position + 1);
                  setShowMentionPopover(true);
                  setMentionSearch('');

                  setTimeout(() => {
                    textareaRef.current?.focus();
                    textareaRef.current?.setSelectionRange(position + 1, position + 1);
                  }, 0);
                }
              }}
              title="Mention team member"
            >
              <AtSign className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>

          <div className="flex justify-between items-center">
            <p className="text-xs text-muted-foreground">
              Only visible to your team
            </p>
            <Button
              type="submit"
              size="sm"
              disabled={!noteContent.trim() || createNoteMutation.isPending}
            >
              {createNoteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-1" />
                  Add Note
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default OrderThreadedNotes;
