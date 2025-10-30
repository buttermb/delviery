import { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, User } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { Card } from './ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

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
          .single();

        if (error) {
          console.error('Error creating session:', error);
          toast({
            title: "Error",
            description: "Failed to start chat session",
            variant: "destructive"
          });
          return;
        }

        setSessionId(data.id);
        
        // Send welcome message
        await supabase.from('chat_messages').insert({
          session_id: data.id,
          sender_type: 'ai',
          message: "👋 Hi! I'm your Bud Dash assistant. How can I help you today?"
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
        .select('*')
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
          setMessages(prev => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

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
      const { error } = await supabase.functions.invoke('customer-chat', {
        body: { sessionId, message: userMessage, mode }
      });

      if (error) throw error;

    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive"
      });
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

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 rounded-full w-14 h-14 shadow-lg z-50"
        size="icon"
      >
        <MessageCircle className="w-6 h-6" />
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-6 right-6 w-96 h-[600px] shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-primary text-primary-foreground rounded-t-lg">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5" />
          <div>
            <h3 className="font-semibold">Bud Dash Support</h3>
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
                  {new Date(msg.created_at).toLocaleTimeString()}
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

      {/* Input */}
      <div className="p-4 border-t space-y-2">
        {mode === 'ai' && (
          <Button
            variant="outline"
            size="sm"
            onClick={switchToHuman}
            className="w-full"
          >
            <User className="w-4 h-4 mr-2" />
            Speak to Real Person
          </Button>
        )}
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={mode === 'ai' ? 'Ask me anything...' : 'Type your message...'}
            disabled={loading}
          />
          <Button onClick={handleSend} disabled={loading || !input.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
};