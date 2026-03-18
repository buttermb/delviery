/**
 * AnnouncementBar Component
 * Admin-manageable announcement bar for storefront
 * - Set text, link, background color, schedule
 * - Multiple announcements rotate
 * - Dismiss tracking per session
 * - Real-time updates via Supabase subscriptions
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import {
  Plus,
  Trash2,
  Edit,
  MoveUp,
  MoveDown,
  Megaphone,
  Link as LinkIcon,
  Eye,
  EyeOff,
  Loader2,
  Calendar,
  Palette,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import { formatSmartDate } from '@/lib/formatters';
import { queryKeys } from '@/lib/queryKeys';

interface Announcement {
  id: string;
  tenant_id: string;
  text: string;
  link_url: string | null;
  link_text: string | null;
  background_color: string;
  text_color: string;
  display_order: number;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

interface AnnouncementFormData {
  text: string;
  link_url: string;
  link_text: string;
  background_color: string;
  text_color: string;
  is_active: boolean;
  start_date: string;
  end_date: string;
}

const DEFAULT_FORM_DATA: AnnouncementFormData = {
  text: '',
  link_url: '',
  link_text: '',
  background_color: '#3b82f6',
  text_color: '#ffffff',
  is_active: true,
  start_date: '',
  end_date: '',
};

interface AnnouncementBarProps {
  storeId?: string;
}

export function AnnouncementBar({ storeId }: AnnouncementBarProps) {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<AnnouncementFormData>(DEFAULT_FORM_DATA);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [announcementToDelete, setAnnouncementToDelete] = useState<Announcement | null>(null);

  const tenantId = tenant?.id;

  // Fetch announcements for this tenant
  const { data: announcements = [], isLoading, error } = useQuery({
    queryKey: queryKeys.storefrontAnnouncements.byTenantStore(tenantId, storeId),
    queryFn: async () => {
      if (!tenantId) return [];

      let query = supabase
        .from('storefront_announcements')
        .select('id, tenant_id, text, link_url, link_text, background_color, text_color, display_order, is_active, start_date, end_date, created_at, updated_at')
        .eq('tenant_id', tenantId)
        .order('display_order', { ascending: true });

      if (storeId) {
        query = query.eq('store_id', storeId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        logger.error('Failed to fetch announcements', fetchError, {
          component: 'AnnouncementBar',
        });
        throw fetchError;
      }

      return (data ?? []) as Announcement[];
    },
    enabled: !!tenantId,
  });

  // Real-time subscription for announcements
  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel(`announcements-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'storefront_announcements',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: queryKeys.storefrontAnnouncements.byTenantStore(tenantId, storeId),
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, storeId, queryClient]);

  // Create/Update announcement mutation
  const saveMutation = useMutation({
    mutationFn: async (data: AnnouncementFormData) => {
      if (!tenantId) throw new Error('No tenant ID');

      const payload = {
        tenant_id: tenantId,
        store_id: storeId || null,
        text: data.text,
        link_url: data.link_url || null,
        link_text: data.link_text || null,
        background_color: data.background_color,
        text_color: data.text_color,
        is_active: data.is_active,
        start_date: data.start_date || null,
        end_date: data.end_date || null,
      };

      if (editingAnnouncement) {
        const { error: updateError } = await supabase
          .from('storefront_announcements')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editingAnnouncement.id)
          .eq('tenant_id', tenantId);

        if (updateError) throw updateError;
      } else {
        // Get max display order for new items
        const maxOrder = announcements.length > 0
          ? Math.max(...announcements.map(a => a.display_order))
          : -1;

        const { error: insertError } = await supabase
          .from('storefront_announcements')
          .insert({
            ...payload,
            display_order: maxOrder + 1,
          });

        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.storefrontAnnouncements.byTenantStore(tenantId, storeId),
      });
      toast.success(editingAnnouncement ? 'Announcement updated!' : 'Announcement created!');
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (err) => {
      logger.error('Failed to save announcement', err, {
        component: 'AnnouncementBar',
      });
      toast.error("Error saving announcement", { description: humanizeError(err) });
    },
  });

  // Delete announcement mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!tenantId) throw new Error('No tenant ID');

      const { error: deleteError } = await supabase
        .from('storefront_announcements')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenantId);

      if (deleteError) throw deleteError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.storefrontAnnouncements.byTenantStore(tenantId, storeId),
      });
      toast.success("Announcement deleted");
    },
    onError: (err) => {
      logger.error('Failed to delete announcement', err, {
        component: 'AnnouncementBar',
      });
      toast.error("Error deleting announcement", { description: humanizeError(err) });
    },
  });

  // Reorder announcement mutation
  const reorderMutation = useMutation({
    mutationFn: async ({ id, newOrder }: { id: string; newOrder: number }) => {
      if (!tenantId) throw new Error('No tenant ID');

      const { error: updateError } = await supabase
        .from('storefront_announcements')
        .update({ display_order: newOrder })
        .eq('id', id)
        .eq('tenant_id', tenantId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.storefrontAnnouncements.byTenantStore(tenantId, storeId),
      });
    },
  });

  // Toggle active status
  const toggleActive = async (announcement: Announcement) => {
    if (!tenantId) return;

    const { error: updateError } = await supabase
      .from('storefront_announcements')
      .update({ is_active: !announcement.is_active })
      .eq('id', announcement.id)
      .eq('tenant_id', tenantId);

    if (updateError) {
      toast.error("Error updating status");
      return;
    }

    queryClient.invalidateQueries({
      queryKey: queryKeys.storefrontAnnouncements.byTenantStore(tenantId, storeId),
    });
  };

  const moveAnnouncement = async (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === announcements.length - 1) return;

    const currentAnnouncement = announcements[index];
    const swapAnnouncement = announcements[direction === 'up' ? index - 1 : index + 1];

    reorderMutation.mutate({ id: currentAnnouncement.id, newOrder: swapAnnouncement.display_order });
    reorderMutation.mutate({ id: swapAnnouncement.id, newOrder: currentAnnouncement.display_order });
  };

  const resetForm = useCallback(() => {
    setFormData(DEFAULT_FORM_DATA);
    setEditingAnnouncement(null);
  }, []);

  const openEdit = (announcement: Announcement) => {
    setEditingAnnouncement(announcement);
    setFormData({
      text: announcement.text,
      link_url: announcement.link_url ?? '',
      link_text: announcement.link_text ?? '',
      background_color: announcement.background_color,
      text_color: announcement.text_color,
      is_active: announcement.is_active,
      start_date: announcement.start_date ? announcement.start_date.split('T')[0] : '',
      end_date: announcement.end_date ? announcement.end_date.split('T')[0] : '',
    });
    setIsDialogOpen(true);
  };

  const isScheduled = (announcement: Announcement) => {
    const now = new Date();
    if (announcement.start_date && new Date(announcement.start_date) > now) return 'scheduled';
    if (announcement.end_date && new Date(announcement.end_date) < now) return 'expired';
    return 'active';
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 flex flex-col items-center gap-2 text-destructive">
          <AlertCircle className="h-8 w-8" />
          <p>Failed to load announcements</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Megaphone className="h-5 w-5" />
                Announcement Bar
              </CardTitle>
              <CardDescription>
                Manage rotating announcements for promotions, launches, and notices
              </CardDescription>
            </div>
            <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              New Announcement
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {announcements.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Megaphone className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No announcements yet</p>
              <p className="text-sm">Create your first announcement to display on your storefront</p>
            </div>
          ) : (
            <div className="space-y-4">
              {announcements.map((announcement, index) => {
                const scheduleStatus = isScheduled(announcement);
                return (
                  <div
                    key={announcement.id}
                    className={cn(
                      'flex flex-col md:flex-row items-start md:items-center gap-4 p-4 rounded-lg border bg-card',
                      !announcement.is_active && 'opacity-60'
                    )}
                  >
                    {/* Reorder Controls */}
                    <div className="flex md:flex-col gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        disabled={index === 0}
                        onClick={() => moveAnnouncement(index, 'up')}
                        aria-label="Move up"
                      >
                        <MoveUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        disabled={index === announcements.length - 1}
                        onClick={() => moveAnnouncement(index, 'down')}
                        aria-label="Move down"
                      >
                        <MoveDown className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Preview Bar */}
                    <div
                      className="w-full md:w-48 h-10 rounded-md flex items-center justify-center px-3 text-xs font-medium truncate"
                      style={{
                        backgroundColor: announcement.background_color,
                        color: announcement.text_color,
                      }}
                    >
                      {announcement.text.substring(0, 30)}
                      {announcement.text.length > 30 && '...'}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{announcement.text}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        {announcement.link_url && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <LinkIcon className="h-3 w-3" />
                            {announcement.link_text || 'Link'}
                          </span>
                        )}
                        {(announcement.start_date || announcement.end_date) && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {announcement.start_date && `From ${formatSmartDate(announcement.start_date)}`}
                            {announcement.start_date && announcement.end_date && ' - '}
                            {announcement.end_date && `Until ${formatSmartDate(announcement.end_date)}`}
                          </span>
                        )}
                        {scheduleStatus === 'scheduled' && (
                          <Badge variant="secondary" className="text-[10px]">Scheduled</Badge>
                        )}
                        {scheduleStatus === 'expired' && (
                          <Badge variant="destructive" className="text-[10px]">Expired</Badge>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleActive(announcement)}
                        className={announcement.is_active ? 'text-green-600' : 'text-muted-foreground'}
                      >
                        {announcement.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(announcement)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => { setAnnouncementToDelete(announcement); setDeleteDialogOpen(true); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Rotation Info */}
          {announcements.filter(a => a.is_active).length > 1 && (
            <div className="mt-4 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
              <strong>{announcements.filter(a => a.is_active).length} active announcements</strong> will rotate automatically on your storefront.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => {
          if (announcementToDelete) {
            deleteMutation.mutate(announcementToDelete.id);
            setDeleteDialogOpen(false);
            setAnnouncementToDelete(null);
          }
        }}
        itemName={announcementToDelete?.text?.substring(0, 50)}
        itemType="announcement"
        isLoading={deleteMutation.isPending}
      />

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingAnnouncement ? 'Edit Announcement' : 'Create New Announcement'}
            </DialogTitle>
            <DialogDescription>
              Configure the content, style, and schedule for this announcement
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto px-1">
            {/* Preview */}
            <div className="space-y-2">
              <Label>Preview</Label>
              <div
                className="w-full py-2 px-4 rounded-md flex items-center justify-center gap-2 text-sm font-medium"
                style={{
                  backgroundColor: formData.background_color,
                  color: formData.text_color,
                }}
              >
                {formData.text || 'Your announcement text here'}
                {formData.link_url && (
                  <ExternalLink className="h-3 w-3 ml-1" />
                )}
              </div>
            </div>

            {/* Text */}
            <div className="space-y-2">
              <Label>Announcement Text *</Label>
              <Textarea
                placeholder="e.g., Free shipping on orders over $50! Use code FREESHIP"
                value={formData.text}
                onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                rows={2}
              />
            </div>

            {/* Link */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Link URL</Label>
                <Input
                  type="url"
                  placeholder="https://example.com/deals"
                  value={formData.link_url}
                  onChange={(e) => setFormData({ ...formData, link_url: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Link Text</Label>
                <Input
                  placeholder="Shop Now"
                  value={formData.link_text}
                  onChange={(e) => setFormData({ ...formData, link_text: e.target.value })}
                />
              </div>
            </div>

            {/* Colors */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Palette className="h-3 w-3" />
                  Background Color
                </Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    className="w-10 h-10 p-1 cursor-pointer"
                    value={formData.background_color}
                    onChange={(e) => setFormData({ ...formData, background_color: e.target.value })}
                  />
                  <Input
                    className="flex-1 font-mono text-sm"
                    value={formData.background_color}
                    onChange={(e) => setFormData({ ...formData, background_color: e.target.value })}
                    placeholder="#3b82f6"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Palette className="h-3 w-3" />
                  Text Color
                </Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    className="w-10 h-10 p-1 cursor-pointer"
                    value={formData.text_color}
                    onChange={(e) => setFormData({ ...formData, text_color: e.target.value })}
                  />
                  <Input
                    className="flex-1 font-mono text-sm"
                    value={formData.text_color}
                    onChange={(e) => setFormData({ ...formData, text_color: e.target.value })}
                    placeholder="#ffffff"
                  />
                </div>
              </div>
            </div>

            {/* Schedule */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Start Date (Optional)
                </Label>
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  End Date (Optional)
                </Label>
                <Input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
            </div>

            {/* Active Toggle */}
            <div className="flex items-center gap-2 mt-2">
              <Switch
                id="announcement-active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="announcement-active">Announcement is visible</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => saveMutation.mutate(formData)}
              disabled={saveMutation.isPending || !formData.text.trim()}
            >
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Announcement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
