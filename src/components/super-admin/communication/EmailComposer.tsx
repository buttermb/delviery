/**
 * Email Composer Component
 * Compose and send emails to tenants
 * Inspired by Mailchimp and SendGrid
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Mail, Send, Save, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface EmailDraft {
  subject: string;
  body: string;
  recipientType: 'all' | 'active' | 'trial' | 'specific';
  scheduledAt: string | null;
}

export function EmailComposer() {
  const { toast } = useToast();
  const [draft, setDraft] = useState<EmailDraft>({
    subject: '',
    body: '',
    recipientType: 'all',
    scheduledAt: null,
  });

  const handleSend = () => {
    if (!draft.subject || !draft.body) {
      toast({
        title: 'Error',
        description: 'Please fill in subject and body',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Email Sent',
      description: `Email will be sent to ${draft.recipientType} tenants`,
    });
  };

  const handleSaveDraft = () => {
    toast({
      title: 'Draft Saved',
      description: 'Email draft has been saved',
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Compose Email
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Recipients</Label>
          <Select
            value={draft.recipientType}
            onValueChange={(value: any) =>
              setDraft({ ...draft, recipientType: value })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tenants</SelectItem>
              <SelectItem value="active">Active Tenants Only</SelectItem>
              <SelectItem value="trial">Trial Tenants Only</SelectItem>
              <SelectItem value="specific">Specific Tenants</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email-subject">Subject</Label>
          <Input
            id="email-subject"
            value={draft.subject}
            onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
            placeholder="Email subject..."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email-body">Body</Label>
          <Textarea
            id="email-body"
            value={draft.body}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            placeholder="Email body..."
            className="min-h-[300px] font-mono text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label>Schedule</Label>
          <Input
            type="datetime-local"
            value={draft.scheduledAt || ''}
            onChange={(e) =>
              setDraft({ ...draft, scheduledAt: e.target.value || null })
            }
          />
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSend}>
            <Send className="h-4 w-4 mr-2" />
            {draft.scheduledAt ? 'Schedule' : 'Send Now'}
          </Button>
          <Button variant="outline" onClick={handleSaveDraft}>
            <Save className="h-4 w-4 mr-2" />
            Save Draft
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

