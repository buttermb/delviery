import { useCallback, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, Check, Mail, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import type { PortalClient } from '@/types/portal';

export interface PortalHeaderProps {
  client: PortalClient;
}

export function PortalHeader({ client }: PortalHeaderProps) {
  const [copied, setCopied] = useState(false);

  const portalUrl = `${window.location.origin}/p/${client.portal_token}`;

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(portalUrl);
      setCopied(true);
      toast.success('Portal link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy link', { description: humanizeError(error) });
    }
  }, [portalUrl]);

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-2xl md:text-3xl font-bold">{client.business_name}</h1>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-muted-foreground">
              {client.contact_name && (
                <div className="flex items-center gap-2">
                  <span className="font-medium">{client.contact_name}</span>
                </div>
              )}
              {client.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  <span>{client.email}</span>
                </div>
              )}
              {client.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  <span>{client.phone}</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
              <input
                type="text"
                value={portalUrl}
                readOnly
                className="flex-1 bg-transparent border-none outline-none text-sm text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring rounded"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCopyLink}
                className="h-8 w-8 p-0"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <Badge variant="outline" className="self-start sm:self-center">
              Client Portal
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

