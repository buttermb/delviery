import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, ExternalLink, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface LinkCheck {
  url: string;
  status: 'checking' | 'valid' | 'broken' | 'external';
  statusCode?: number;
  text?: string;
  element?: string;
}

export default function LinkChecker() {
  const [checking, setChecking] = useState(false);
  const [results, setResults] = useState<LinkCheck[]>([]);

  const checkLinks = async () => {
    setChecking(true);
    setResults([]);

    try {
      const links = Array.from(document.querySelectorAll('a[href]'));
      const checks: LinkCheck[] = [];

      for (const link of links) {
        const href = link.getAttribute('href');
        if (!href) continue;

        const check: LinkCheck = {
          url: href,
          status: 'checking',
          text: link.textContent?.trim() || '',
          element: link.tagName
        };

        checks.push(check);
      }

      setResults([...checks]);

      for (let i = 0; i < checks.length; i++) {
        const check = checks[i];
        
        try {
          if (check.url.startsWith('http') && !check.url.includes(window.location.host)) {
            checks[i].status = 'external';
          } else {
            const response = await fetch(check.url, { method: 'HEAD' });
            checks[i].statusCode = response.status;
            checks[i].status = response.ok ? 'valid' : 'broken';
          }
        } catch (error) {
          checks[i].status = 'broken';
          checks[i].statusCode = 0;
        }

        setResults([...checks]);
      }

      const brokenCount = checks.filter(c => c.status === 'broken').length;
      const externalCount = checks.filter(c => c.status === 'external').length;
      const validCount = checks.filter(c => c.status === 'valid').length;

      toast.success(
        `Link check complete: ${validCount} valid, ${brokenCount} broken, ${externalCount} external`
      );
    } catch (error) {
      toast.error('Failed to check links');
      console.error(error);
    } finally {
      setChecking(false);
    }
  };

  const getStatusIcon = (status: LinkCheck['status']) => {
    switch (status) {
      case 'checking':
        return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
      case 'valid':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'broken':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case 'external':
        return <ExternalLink className="h-4 w-4 text-blue-500" />;
    }
  };

  const getStatusBadge = (status: LinkCheck['status']) => {
    const variants = {
      checking: 'outline',
      valid: 'default',
      broken: 'destructive',
      external: 'secondary'
    } as const;

    return (
      <Badge variant={variants[status]}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  const stats = {
    total: results.length,
    valid: results.filter(r => r.status === 'valid').length,
    broken: results.filter(r => r.status === 'broken').length,
    external: results.filter(r => r.status === 'external').length,
    checking: results.filter(r => r.status === 'checking').length,
  };

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Link Checker</CardTitle>
          <CardDescription>
            Test all links on the current page for broken or external links
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button
              onClick={checkLinks}
              disabled={checking}
              size="lg"
            >
              {checking ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Checking Links...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Start Link Check
                </>
              )}
            </Button>

            {results.length > 0 && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold">{stats.total}</div>
                      <div className="text-xs text-muted-foreground">Total Links</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-green-500">{stats.valid}</div>
                      <div className="text-xs text-muted-foreground">Valid</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-destructive">{stats.broken}</div>
                      <div className="text-xs text-muted-foreground">Broken</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-blue-500">{stats.external}</div>
                      <div className="text-xs text-muted-foreground">External</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-muted-foreground">{stats.checking}</div>
                      <div className="text-xs text-muted-foreground">Checking</div>
                    </CardContent>
                  </Card>
                </div>

                <div className="border rounded-lg divide-y max-h-[600px] overflow-auto">
                  {results.map((result, index) => (
                    <div
                      key={index}
                      className="p-4 hover:bg-muted/50 transition-colors flex items-start gap-3"
                    >
                      <div className="mt-1">
                        {getStatusIcon(result.status)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {getStatusBadge(result.status)}
                          {result.statusCode !== undefined && (
                            <Badge variant="outline">
                              {result.statusCode}
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm font-medium truncate mb-1">
                          {result.text || '(no text)'}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono truncate">
                          {result.url}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
