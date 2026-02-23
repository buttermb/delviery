/**
 * Context-Aware Support Button
 * Captures current page, user info, and device context for support tickets
 */

import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  LifeBuoy,
  MessageSquare,
  Bug,
  Lightbulb,
  HelpCircle,
  Monitor,
  MapPin,
  Clock,
  User,
  Copy,
  Check,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface SupportContext {
  currentPage: string;
  pageTitle: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
  timestamp: string;
  timezone: string;
  browser: string;
  os: string;
  screenSize: string;
  recentActions?: string[];
}

interface ContextAwareSupportButtonProps {
  userId?: string;
  userEmail?: string;
  userName?: string;
  onSubmitTicket?: (ticket: SupportTicket) => Promise<void>;
  position?: 'bottom-right' | 'bottom-left';
  className?: string;
}

interface SupportTicket {
  type: 'question' | 'bug' | 'feature' | 'feedback';
  subject: string;
  description: string;
  context: SupportContext;
  priority: 'low' | 'medium' | 'high';
}

function gatherContext(userId?: string, userEmail?: string, userName?: string): SupportContext {
  const location = window.location;
  
  // Get browser info
  const userAgent = navigator.userAgent;
  let browser = 'Unknown';
  if (userAgent.includes('Chrome')) browser = 'Chrome';
  else if (userAgent.includes('Firefox')) browser = 'Firefox';
  else if (userAgent.includes('Safari')) browser = 'Safari';
  else if (userAgent.includes('Edge')) browser = 'Edge';

  // Get OS info
  let os = 'Unknown';
  if (userAgent.includes('Windows')) os = 'Windows';
  else if (userAgent.includes('Mac')) os = 'macOS';
  else if (userAgent.includes('Linux')) os = 'Linux';
  else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) os = 'iOS';
  else if (userAgent.includes('Android')) os = 'Android';

  return {
    currentPage: location.pathname + location.search,
    pageTitle: document.title,
    userId,
    userEmail,
    userName,
    timestamp: new Date().toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    browser: `${browser} ${navigator.userAgent.match(/Chrome\/(\d+)/)?.[1] || ''}`,
    os,
    screenSize: `${window.innerWidth}x${window.innerHeight}`,
  };
}

export function ContextAwareSupportButton({
  userId,
  userEmail,
  userName,
  onSubmitTicket,
  position = 'bottom-right',
  className,
}: ContextAwareSupportButtonProps) {
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [ticketType, setTicketType] = useState<SupportTicket['type']>('question');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  const _location = useLocation();
  const navigate = useNavigate();

  const context = gatherContext(userId, userEmail, userName);

  const ticketTypes = [
    { type: 'question' as const, label: 'Question', icon: HelpCircle, color: 'text-blue-500 dark:text-blue-400' },
    { type: 'bug' as const, label: 'Report Bug', icon: Bug, color: 'text-red-500 dark:text-red-400' },
    { type: 'feature' as const, label: 'Feature Request', icon: Lightbulb, color: 'text-amber-500 dark:text-amber-400' },
    { type: 'feedback' as const, label: 'Feedback', icon: MessageSquare, color: 'text-green-500 dark:text-green-400' },
  ];

  const handleTypeSelect = (type: SupportTicket['type']) => {
    setTicketType(type);
    setOpen(false);
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!subject.trim() || !description.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const ticket: SupportTicket = {
        type: ticketType,
        subject,
        description,
        context,
        priority: ticketType === 'bug' ? 'high' : 'medium',
      };

      if (onSubmitTicket) {
        await onSubmitTicket(ticket);
      }

      toast.success('Support ticket submitted', {
        description: 'We\'ll get back to you soon.',
      });

      setDialogOpen(false);
      setSubject('');
      setDescription('');
    } catch {
      toast.error('Failed to submit ticket');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyContext = () => {
    const contextText = `
Page: ${context.currentPage}
Title: ${context.pageTitle}
User: ${context.userName || 'N/A'} (${context.userEmail || 'N/A'})
Time: ${context.timestamp}
Timezone: ${context.timezone}
Browser: ${context.browser}
OS: ${context.os}
Screen: ${context.screenSize}
    `.trim();

    navigator.clipboard.writeText(contextText);
    setCopied(true);
    toast.success('Support context copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="default"
            size="icon"
            className={cn(
              'fixed z-50 h-12 w-12 rounded-full shadow-lg',
              position === 'bottom-right' ? 'bottom-4 right-4' : 'bottom-4 left-4',
              className
            )}
          >
            <LifeBuoy className="h-5 w-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align={position === 'bottom-right' ? 'end' : 'start'}
          className="w-64 p-2"
        >
          <div className="space-y-1">
            <p className="text-sm font-medium px-2 py-1.5 text-muted-foreground">
              How can we help?
            </p>
            {ticketTypes.map(({ type, label, icon: Icon, color }) => (
              <button
                key={type}
                onClick={() => handleTypeSelect(type)}
                className="w-full flex items-center gap-3 px-2 py-2 rounded-md hover:bg-muted transition-colors text-left"
              >
                <Icon className={cn('h-4 w-4', color)} />
                <span className="text-sm">{label}</span>
                <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" />
              </button>
            ))}
          </div>

          <div className="border-t mt-2 pt-2">
            <button
              onClick={() => navigate('/support/faq')}
              className="w-full flex items-center gap-3 px-2 py-2 rounded-md hover:bg-muted transition-colors text-left"
            >
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Browse FAQ</span>
            </button>
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {ticketTypes.find(t => t.type === ticketType)?.icon && (
                React.createElement(ticketTypes.find(t => t.type === ticketType)!.icon, {
                  className: cn('h-5 w-5', ticketTypes.find(t => t.type === ticketType)?.color),
                })
              )}
              {ticketTypes.find(t => t.type === ticketType)?.label}
            </DialogTitle>
            <DialogDescription>
              We'll include your current context to help resolve this faster.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                placeholder="Brief summary of your issue"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Please describe in detail..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
              />
            </div>

            {/* Context preview */}
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Context (auto-captured)</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={copyContext}
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 mr-1" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  <span className="truncate">{context.currentPage}</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Monitor className="h-3 w-3" />
                  <span>{context.browser} / {context.os}</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{context.timezone}</span>
                </div>
                {context.userEmail && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span className="truncate">{context.userEmail}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Submit Ticket'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Simplified inline support link
export function SupportLink({ children, className }: { children: React.ReactNode; className?: string }) {
  const context = gatherContext();
  const params = new URLSearchParams({
    page: context.currentPage,
    browser: context.browser,
    os: context.os,
  });

  return (
    <a
      href={`/support/new?${params.toString()}`}
      className={cn('inline-flex items-center gap-1 text-primary hover:underline', className)}
    >
      <LifeBuoy className="h-3.5 w-3.5" />
      {children}
    </a>
  );
}
