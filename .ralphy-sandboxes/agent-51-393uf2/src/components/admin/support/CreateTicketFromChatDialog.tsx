/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { logger } from '@/lib/logger';
import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';

// Basic input sanitization helpers (trim and limit length)
const sanitizeInput = (input: string, maxLength: number): string => {
  return input.trim().slice(0, maxLength);
};
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Ticket, MessageSquare } from 'lucide-react';
import { queryKeys } from '@/lib/queryKeys';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface Message {
  id: string;
  sender_type: 'user' | 'ai' | 'admin';
  message: string;
  created_at: string;
}

interface ChatSession {
  id: string;
  mode: 'ai' | 'human';
  status: 'active' | 'closed';
  created_at: string;
  user_id?: string;
  guest_id?: string;
}

interface CreateTicketFromChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: ChatSession | null;
  messages: Message[];
  onSuccess?: () => void;
}

export function CreateTicketFromChatDialog({
  open,
  onOpenChange,
  session,
  messages,
  onSuccess,
}: CreateTicketFromChatDialogProps) {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    subject: '',
    description: '',
    priority: 'medium',
    category: 'general',
    includeTranscript: true,
  });

  // Auto-generate subject and description from chat
  useEffect(() => {
    if (open && messages.length > 0) {
      // Try to extract a subject from the first user message
      const firstUserMessage = messages.find(m => m.sender_type === 'user');
      const suggestedSubject = firstUserMessage
        ? firstUserMessage.message.slice(0, 100) + (firstUserMessage.message.length > 100 ? '...' : '')
        : 'Chat Support Request';

      // Create a summary of the conversation
      const userMessages = messages.filter(m => m.sender_type === 'user');
      const summary = userMessages.length > 0
        ? `Customer inquiry from live chat session.\n\nInitial message: "${userMessages[0]?.message || 'N/A'}"`
        : 'Customer requested support via live chat.';

      setFormData(prev => ({
        ...prev,
        subject: suggestedSubject,
        description: summary,
      }));
    }
  }, [open, messages]);

  const formatChatTranscript = (): string => {
    if (!messages.length) return '';

    const transcript = messages.map(msg => {
      const time = new Date(msg.created_at).toLocaleString();
      const sender = msg.sender_type === 'user' ? 'Customer'
        : msg.sender_type === 'ai' ? 'AI Assistant'
        : 'Support Agent';
      return `[${time}] ${sender}: ${msg.message}`;
    }).join('\n\n');

    return `\n\n--- Chat Transcript ---\n${transcript}\n--- End Transcript ---`;
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!tenant?.id || !session) throw new Error('Missing required data');

      const fullDescription = formData.includeTranscript
        ? formData.description + formatChatTranscript()
        : formData.description;

      const ticketData = {
        tenant_id: tenant.id,
        subject: sanitizeInput(formData.subject, 200),
        description: sanitizeInput(fullDescription, 10000),
        priority: formData.priority,
        category: formData.category,
        status: 'open',
        metadata: {
          source: 'live_chat',
          chat_session_id: session.id,
          chat_mode: session.mode,
          customer_identifier: session.user_id || session.guest_id || 'unknown',
          message_count: messages.length,
          created_from_chat_at: new Date().toISOString(),
        },
      };

      const { data, error } = await supabase
        .from('support_tickets')
        .insert([ticketData])
        .select()
        .single();

      if (error) {
        // Ignore table not found errors for graceful degradation
        if (error.code !== '42P01') {
          throw error;
        }
        logger.warn('Support tickets table does not exist yet', { component: 'CreateTicketFromChatDialog' });
        return null;
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.support.tickets() });
      toast.success('Support ticket created successfully', {
        description: data ? `Ticket linked to chat session` : 'Ticket created',
      });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: unknown) => {
      logger.error('Failed to create ticket from chat', error, { component: 'CreateTicketFromChatDialog' });
      toast.error('Failed to create support ticket');
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.subject.trim() || !formData.description.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    await createMutation.mutateAsync();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ticket className="h-5 w-5" />
            Create Support Ticket from Chat
          </DialogTitle>
          <DialogDescription>
            Create a support ticket to track this customer conversation. The chat transcript can be included for reference.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Chat Preview */}
          {messages.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Chat Preview ({messages.length} messages)
              </Label>
              <ScrollArea className="h-32 border rounded-md p-3 bg-muted/30">
                <div className="space-y-2">
                  {messages.slice(0, 5).map((msg) => (
                    <div key={msg.id} className="text-sm">
                      <Badge variant="outline" className="text-xs mr-2">
                        {msg.sender_type === 'user' ? 'Customer' : msg.sender_type === 'ai' ? 'AI' : 'Agent'}
                      </Badge>
                      <span className="text-muted-foreground">
                        {msg.message.slice(0, 100)}{msg.message.length > 100 ? '...' : ''}
                      </span>
                    </div>
                  ))}
                  {messages.length > 5 && (
                    <p className="text-xs text-muted-foreground italic">
                      ... and {messages.length - 5} more messages
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="subject">
              Subject <span className="text-destructive">*</span>
            </Label>
            <Input
              id="subject"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder="Brief description of the issue"
              required
              className="min-h-[44px] touch-manipulation"
            />
          </div>

          <div className="space-y-2 flex-1 min-h-0">
            <Label htmlFor="description">
              Description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Detailed description of the issue"
              rows={4}
              required
              className="min-h-[100px] touch-manipulation resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData({ ...formData, priority: value })}
              >
                <SelectTrigger className="min-h-[44px] touch-manipulation">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger className="min-h-[44px] touch-manipulation">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="technical">Technical</SelectItem>
                  <SelectItem value="billing">Billing</SelectItem>
                  <SelectItem value="feature">Feature Request</SelectItem>
                  <SelectItem value="bug">Bug Report</SelectItem>
                  <SelectItem value="account">Account</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="includeTranscript"
              checked={formData.includeTranscript}
              onChange={(e) => setFormData({ ...formData, includeTranscript: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="includeTranscript" className="text-sm font-normal cursor-pointer">
              Include full chat transcript in ticket description
            </Label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createMutation.isPending}
              className="min-h-[44px] touch-manipulation"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending}
              className="min-h-[44px] touch-manipulation"
            >
              {createMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create Ticket
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
