import { useState } from 'react';
import { Copy, Check, ExternalLink, RefreshCw, Trash2, FileText, Package, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useStaticMenuPages, useDeleteStaticMenuPage } from '@/hooks/useStaticMenuPages';

interface StaticMenuPagesListProps {
  onRegenerate: (menuName?: string) => void;
}

function buildPageUrl(token: string): string {
  return `${window.location.origin}/page/${token}`;
}

export function StaticMenuPagesList({ onRegenerate }: StaticMenuPagesListProps) {
  const { tenant } = useTenantAdminAuth();
  const { data: pages = [], isLoading, refetch } = useStaticMenuPages(tenant?.id);
  const deleteMutation = useDeleteStaticMenuPage();

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const handleCopy = async (id: string, token: string) => {
    const url = buildPageUrl(token);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      toast.success('URL copied to clipboard');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('Failed to copy URL');
      logger.error('Clipboard write failed', { component: 'StaticMenuPagesList' });
    }
  };

  const handleOpen = (token: string) => {
    window.open(buildPageUrl(token), '_blank', 'noopener,noreferrer');
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteMutation.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  if (pages.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
          <p className="font-medium text-muted-foreground">No menu pages yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Generate a static menu page to share with your clients
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => onRegenerate()}
          >
            <FileText className="h-4 w-4 mr-2" />
            Generate Menu Page
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Generated Pages
            </h3>
            <Badge variant="secondary" className="h-5 px-1.5 text-xs">
              {pages.length}
            </Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* List */}
        <Card>
          <CardContent className="p-0 divide-y">
            {pages.map((page) => {
              const url = buildPageUrl(page.encrypted_url_token);
              const isCopied = copiedId === page.id;

              return (
                <div
                  key={page.id}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-muted/50 transition-colors"
                >
                  {/* Title & meta */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{page.name}</div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-muted-foreground truncate max-w-[240px]">
                        {url}
                      </span>
                      <Badge variant="outline" className="shrink-0 text-xs gap-1">
                        <Package className="h-3 w-3" />
                        {page.product_count}
                      </Badge>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatDistanceToNow(new Date(page.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleCopy(page.id, page.encrypted_url_token)}
                        >
                          {isCopied ? (
                            <Check className="h-4 w-4 text-success" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Copy URL</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleOpen(page.encrypted_url_token)}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Open page</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => onRegenerate(page.name)}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Regenerate</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget({ id: page.id, name: page.name })}
                        >
                          {deleteMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <ConfirmDeleteDialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          onConfirm={handleDelete}
          title="Delete Menu Page"
          description={`Are you sure you want to delete "${deleteTarget?.name}"? The URL will stop working immediately.`}
          itemType="menu page"
          isLoading={deleteMutation.isPending}
        />
      </div>
    </TooltipProvider>
  );
}
