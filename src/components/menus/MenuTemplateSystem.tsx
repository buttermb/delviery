import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { FileText, Plus, Copy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

interface MenuTemplate {
  id: string;
  name: string;
  description: string | null;
  item_count: number;
  created_at: string;
}

export function MenuTemplateSystem() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');

  const { data: templates, isLoading } = useQuery({
    queryKey: queryKeys.menuTemplates.byTenant(tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from('menu_templates')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as MenuTemplate[];
    },
    enabled: !!tenant?.id,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!tenant?.id) throw new Error('No tenant');
      const { data, error } = await supabase
        .from('menu_templates')
        .insert({
          tenant_id: tenant.id,
          name: templateName,
          description: templateDescription,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.menuTemplates.byTenant(tenant?.id) });
      toast.success('Template created');
      setShowCreateDialog(false);
      setTemplateName('');
      setTemplateDescription('');
    },
    onError: (error) => {
      logger.error('Failed to create template', error);
      toast.error('Failed to create template');
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Menu Templates</h3>
        <Button onClick={() => setShowCreateDialog(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          New Template
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates?.map((template) => (
          <Card key={template.id}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {template.name}
              </CardTitle>
              {template.description && (
                <CardDescription>{template.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <Badge variant="secondary">{template.item_count || 0} items</Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Menu Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g. Weekend Special"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                placeholder="Optional description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => createMutation.mutate()} disabled={!templateName || createMutation.isPending}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
