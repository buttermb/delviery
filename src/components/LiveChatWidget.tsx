import { logger } from '@/lib/logger';
import { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, User } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { Card } from './ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { useKeyboardDetection } from '@/hooks/useKeyboardDetection';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  sender_type: 'user' | 'ai' | 'admin';
  message: string;
  created_at: string;
}

interface LiveChatWidgetProps {
  onClose?: () => void;
}

export const LiveChatWidget = ({ onClose }: LiveChatWidgetProps = {}) => {
  const [isOpen, setIsOpen] = useState(!!onClose);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [mode, setMode] = useState<'ai' | 'human'>('ai');
  const [loading, setLoading] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();
  const { isKeyboardOpen } = useKeyboardDetection();

  // Initialize session
  useEffect(() => {
    const initSession = async () => {
      if (isOpen && !sessionId) {
        const { data: { user } } = await supabase.auth.getUser();
        const guestId = !user ? `guest_${Date.now()}` : null;

        const { data, error } = await supabase
          .from('chat_sessions')
          .insert({
            user_id: user?.id,
            guest_id: guestId,
            mode: 'ai',
            status: 'active'
          })
          .select()
          .maybeSingle();

        if (error) {
          logger.error('Error creating session', error as Error, { component: 'LiveChatWidget' });
          toast.error("Failed to start chat session");
          return;
        }

        setSessionId(data.id);
        
        // Send welcome message
        await supabase.from('chat_messages').insert({
          session_id: data.id,
          sender_type: 'ai',
          message: "👋 Hi! I'm your support assistant. How can I help you today?"
        });
      }
    };

    initSession();
  }, [isOpen, sessionId]);

  // Load messages
  useEffect(() => {
    if (!sessionId) return;

    const loadMessages = async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('id, sender_type, message, created_at')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (data) setMessages(data as Message[]);
    };

    loadMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel(`chat_${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `session_id=eq.${sessionId}`
        },
        (payload) => {
          if (payload?.new) {
            setMessages(prev => [...prev, payload.new as Message]);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.debug('Successfully subscribed to chat messages', { component: 'LiveChatWidget' });
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logger.error('Failed to subscribe to chat messages', { status, component: 'LiveChatWidget' });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  // Auto scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !sessionId || loading) return;

    const userMessage = input.trim();
    setInput('');
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('customer-chat', {
        body: { sessionId, message: userMessage, mode }
      });

      if (error) throw error;

      // Check for error in response body (some edge functions return 200 with error)
      if (data && typeof data === 'object' && 'error' in data && data.error) {
        const errorMessage = typeof data.error === 'string' ? data.error : 'Failed to send message';
        throw new Error(errorMessage);
      }

    } catch (error) {
      logger.error('Error sending message', error as Error, { component: 'LiveChatWidget' });
      toast.error("Failed to send message");
    } finally {
      setLoading(false);
    }
  };

  const switchToHuman = async () => {
    if (!sessionId) return;

    await supabase
      .from('chat_sessions')
      .update({ mode: 'human' })
      .eq('id', sessionId);

    setMode('human');
    
    await supabase.from('chat_messages').insert({
      session_id: sessionId,
      sender_type: 'ai',
      message: "I'm connecting you with a support team member. They'll be with you shortly! 👨‍💼"
    });
  };

  // Handle mobile viewport adjustment when keyboard opens
  useEffect(() => {
    if (!isMobile || !isOpen) return;

    if (isInputFocused && inputRef.current) {
      // Scroll input into view when focused on mobile
      const scrollTimeout = setTimeout(() => {
        inputRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'nearest',
          inline: 'nearest'
        });
      }, 300);

      return () => clearTimeout(scrollTimeout);
    }
  }, [isInputFocused, isMobile, isOpen, isKeyboardOpen]);

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed rounded-full w-14 h-14 shadow-lg z-sticky touch-target",
          isMobile ? "bottom-20 right-4 safe-area-bottom" : "bottom-6 right-6"
        )}
        size="icon"
        aria-label="Open chat"
      >
        <MessageCircle className="w-6 h-6" />
      </Button>
    );
  }

  return (
    <Card 
      className={cn(
        "fixed shadow-2xl flex flex-col z-modal",
        isMobile 
          ? "bottom-0 left-0 right-0 top-auto h-[calc(100vh-4rem)] max-h-[600px] rounded-t-2xl rounded-b-none safe-area-bottom"
          : "bottom-6 right-6 w-96 h-[600px] rounded-lg"
      )}
      data-chat-widget="main"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-primary text-primary-foreground rounded-t-lg">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5" />
          <div>
            <h3 className="font-semibold">Customer Support</h3>
            <p className="text-xs opacity-90">
              {mode === 'ai' ? '🤖 AI Assistant' : '👨‍💼 Live Support'}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            setIsOpen(false);
            onClose?.();
          }}
          className="hover:bg-primary-foreground/10"
          aria-label="Close chat"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${
                msg.sender_type === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  msg.sender_type === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                <p className="text-xs opacity-70 mt-1">
                  {new Date(msg.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg p-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce delay-100" />
                  <div className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce delay-200" />
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input - Mobile optimized with proper z-index */}
      <div
        className={cn(
          "border-t space-y-2 bg-background chat-input-container z-[1]",
          isMobile ? "p-3 pb-safe sticky bottom-0" : "p-4"
        )}
        data-chat-widget="input-container"
      >
        {mode === 'ai' && (
          <Button
            variant="outline"
            size="sm"
            onClick={switchToHuman}
            className="w-full min-h-[44px] touch-target"
          >
            <User className="w-4 h-4 mr-2" />
            Speak to Real Person
          </Button>
        )}
        <div className="flex gap-2 items-end">
          <Input
            ref={inputRef}
            value={input}
            aria-label="Type a message"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            onFocus={() => {
              setIsInputFocused(true);
              if (isMobile && inputRef.current) {
                setTimeout(() => {
                  inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 300);
              }
            }}
            onBlur={() => setIsInputFocused(false)}
            placeholder={mode === 'ai' ? 'Ask me anything...' : 'Type your message...'}
            disabled={loading}
            className={cn(
              "min-h-[44px] text-base flex-1 mobile-input-container",
              isMobile && "text-base",
              isMobile && isInputFocused && "relative z-[1]"
            )}
          />
          <Button 
            onClick={handleSend} 
            disabled={loading || !input.trim()}
            className="min-h-[44px] min-w-[44px] touch-target shrink-0"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
};