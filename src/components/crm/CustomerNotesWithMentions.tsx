import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, AtSign, Trash2, Edit2, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/hooks/useTenantAdminAuth';
import { queryKeys } from '@/lib/queryKeys';
import { formatDistanceToNow } from 'date-fns';

interface CustomerNote {
  id: string;
  customer_id: string;
  content: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  mentions: string[] | null;
  author_name?: string;
}

interface TeamMember {
  user_id: string;
  full_name: string | null;
  email: string | null;
}

interface CustomerNotesWithMentionsProps {
  customerId: string;
  customerName: string;
}

/**
 * CustomerNotesWithMentions component
 *
 * Allows team members to add notes to customer records with @mentions functionality.
 * Mentioned users are highlighted and tracked.
 */
export function CustomerNotesWithMentions({
  customerId,
  customerName,
}: CustomerNotesWithMentionsProps) {
  const { tenant, admin } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [noteContent, setNoteContent] = useState('');
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch team members for mentions
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['tenants', 'members', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];

      const { data, error } = await supabase
        .from('tenant_users')
        .select(`
          user_id,
          profiles:user_id (
            full_name,
            email
          )
        `)
        .eq('tenant_id', tenant.id);

      if (error) throw error;

      return (data || []).map((tu: any) => ({
        user_id: tu.user_id,
        full_name: tu.profiles?.full_name || null,
        email: tu.profiles?.email || null,
      })) as TeamMember[];
    },
    enabled: !!tenant?.id,
  });

  // Fetch notes
  const { data: notes = [], isLoading } = useQuery({
    queryKey: queryKeys.customers.detail(customerId, 'notes'),
    queryFn: async () => {
      if (!tenant?.id) return [];

      const { data, error } = await (supabase as any)
        .from('customer_notes')
        .select(`
          *,
          profiles:created_by (
            full_name
          )
        `)
        .eq('tenant_id', tenant.id)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((note: any) => ({
        ...note,
        author_name: note.profiles?.full_name || 'Unknown',
      })) as CustomerNote[];
    },
    enabled: !!tenant?.id && !!customerId,
  });

  // Extract mentions from text
  const extractMentions = (text: string): string[] => {
    const mentionRegex = /@(\w+)/g;
    const matches = text.match(mentionRegex);
    if (!matches) return [];

    return matches
      .map((m) => m.substring(1).toLowerCase())
      .map((username) => {
        const member = teamMembers.find(
          (tm) =>
            tm.full_name?.toLowerCase().includes(username) ||
            tm.email?.toLowerCase().includes(username)
        );
        return member?.user_id;
      })
      .filter((id): id is string => !!id);
  };

  // Add note mutation
  const addNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!tenant?.id || !admin?.id) throw new Error('Not authenticated');

      const mentions = extractMentions(content);

      const { error } = await (supabase as any)
        .from('customer_notes')
        .insert({
          tenant_id: tenant.id,
          customer_id: customerId,
          content,
          created_by: admin?.id,
          mentions: mentions.length > 0 ? mentions : null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Note added');
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.detail(customerId, 'notes') });
      setNoteContent('');
    },
    onError: (error: Error) => {
      toast.error(`Failed to add note: ${error.message}`);
    },
  });

  // Update note mutation
  const updateNoteMutation = useMutation({
    mutationFn: async ({ noteId, content }: { noteId: string; content: string }) => {
      if (!tenant?.id) throw new Error('Not authenticated');

      const mentions = extractMentions(content);

      const { error } = await (supabase as any)
        .from('customer_notes')
        .update({
          content,
          mentions: mentions.length > 0 ? mentions : null,
        })
        .eq('id', noteId)
        .eq('tenant_id', tenant.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Note updated');
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.detail(customerId, 'notes') });
      setEditingNoteId(null);
      setEditContent('');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update note: ${error.message}`);
    },
  });

  // Delete note mutation
  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      if (!tenant?.id) throw new Error('Not authenticated');

      const { error } = await (supabase as any)
        .from('customer_notes')
        .delete()
        .eq('id', noteId)
        .eq('tenant_id', tenant.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Note deleted');
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.detail(customerId, 'notes') });
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete note: ${error.message}`);
    },
  });

  const handleNoteChange = (value: string) => {
    setNoteContent(value);

    // Check for @ mentions
    const lastAtIndex = value.lastIndexOf('@');
    if (lastAtIndex !== -1 && lastAtIndex === value.length - 1) {
      setShowMentionSuggestions(true);
      setMentionQuery('');
    } else if (lastAtIndex !== -1) {
      const query = value.substring(lastAtIndex + 1);
      if (!query.includes(' ')) {
        setMentionQuery(query);
        setShowMentionSuggestions(true);
      } else {
        setShowMentionSuggestions(false);
      }
    } else {
      setShowMentionSuggestions(false);
    }
  };

  const handleMentionSelect = (member: TeamMember) => {
    const lastAtIndex = noteContent.lastIndexOf('@');
    const beforeMention = noteContent.substring(0, lastAtIndex);
    const mentionText = member.full_name || member.email || 'user';
    setNoteContent(beforeMention + '@' + mentionText + ' ');
    setShowMentionSuggestions(false);
    textareaRef.current?.focus();
  };

  const handleAddNote = () => {
    if (!noteContent.trim()) {
      toast.error('Please enter a note');
      return;
    }
    addNoteMutation.mutate(noteContent);
  };

  const handleUpdateNote = (noteId: string) => {
    if (!editContent.trim()) {
      toast.error('Please enter a note');
      return;
    }
    updateNoteMutation.mutate({ noteId, content: editContent });
  };

  const filteredMembers = teamMembers.filter(
    (m) =>
      m.full_name?.toLowerCase().includes(mentionQuery.toLowerCase()) ||
      m.email?.toLowerCase().includes(mentionQuery.toLowerCase())
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notes</CardTitle>
        <CardDescription>Add notes and mention team members with @</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Note */}
        <div className="relative">
          <Textarea
            ref={textareaRef}
            placeholder="Add a note... Use @ to mention team members"
            value={noteContent}
            onChange={(e) => handleNoteChange(e.target.value)}
            maxLength={2000}
            rows={3}
          />
          {showMentionSuggestions && filteredMembers.length > 0 && (
            <div className="absolute bottom-full left-0 mb-2 w-full bg-popover border rounded-md shadow-lg z-10 max-h-40 overflow-y-auto">
              {filteredMembers.map((member) => (
                <button
                  key={member.user_id}
                  onClick={() => handleMentionSelect(member)}
                  className="w-full px-3 py-2 text-left hover:bg-accent flex items-center gap-2"
                >
                  <AtSign className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {member.full_name || member.email || 'Unknown'}
                  </span>
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-muted-foreground">{noteContent.length}/2000</span>
            <Button
              onClick={handleAddNote}
              disabled={addNoteMutation.isPending || !noteContent.trim()}
              size="sm"
            >
              {addNoteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Add Note
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Notes List */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : notes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No notes yet</p>
          ) : (
            notes.map((note) => (
              <div key={note.id} className="p-4 rounded-lg border bg-card">
                <div className="flex items-start gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      {note.author_name?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">{note.author_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                      </span>
                      {note.mentions && note.mentions.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          <AtSign className="h-3 w-3 mr-1" />
                          {note.mentions.length}
                        </Badge>
                      )}
                    </div>
                    {editingNoteId === note.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          maxLength={2000}
                          rows={3}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleUpdateNote(note.id)}
                            disabled={updateNoteMutation.isPending}
                          >
                            {updateNoteMutation.isPending ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              'Save'
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingNoteId(null);
                              setEditContent('');
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {note.content}
                      </p>
                    )}
                  </div>
                  {note.created_by === admin?.id && editingNoteId !== note.id && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingNoteId(note.id);
                          setEditContent(note.content);
                        }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteNoteMutation.mutate(note.id)}
                        disabled={deleteNoteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
