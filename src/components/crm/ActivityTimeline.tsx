/**
 * Activity Timeline Component
 * Inspired by Twenty CRM - displays customer activities in chronological order
 */

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import {
  Phone,
  Mail,
  Calendar,
  FileText,
  ShoppingBag,
  CreditCard,
  CheckSquare,
  User,
  MessageSquare,
  Clock,
  Plus,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Activity {
  id: string;
  customer_id: string;
  tenant_id: string;
  activity_type: 'call' | 'email' | 'meeting' | 'note' | 'order' | 'payment' | 'task';
  title: string;
  description: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
  created_by: string;
  profiles?: {
    full_name: string | null;
    email: string | null;
  };
}

interface ActivityTimelineProps {
  customerId: string;
  tenantId: string;
}

const activityIcons = {
  call: Phone,
  email: Mail,
  meeting: Calendar,
  note: FileText,
  order: ShoppingBag,
  payment: CreditCard,
  task: CheckSquare,
};

const activityColors = {
  call: 'text-blue-500 bg-blue-50',
  email: 'text-purple-500 bg-purple-50',
  meeting: 'text-orange-500 bg-orange-50',
  note: 'text-gray-500 bg-gray-50',
  order: 'text-green-500 bg-green-50',
  payment: 'text-emerald-500 bg-emerald-50',
  task: 'text-yellow-500 bg-yellow-50',
};

export function ActivityTimeline({ customerId, tenantId }: ActivityTimelineProps) {
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newActivity, setNewActivity] = useState({
    activity_type: 'note' as Activity['activity_type'],
    title: '',
    description: '',
  });

  // Fetch activities
  const { data: activities, isLoading, refetch } = useQuery<Activity[]>({
    queryKey: ['customer-activities', customerId, tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_activities')
        .select(`
          *,
          profiles:created_by(full_name, email)
        `)
        .eq('customer_id', customerId)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        // Table might not exist yet
        if (error.code === '42P01') {
          return [];
        }
        throw error;
      }

      return data || [];
    },
    enabled: !!customerId && !!tenantId,
  });

  // Group activities by date
  const groupedActivities = activities?.reduce((acc, activity) => {
    const date = format(new Date(activity.created_at), 'yyyy-MM-dd');
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(activity);
    return acc;
  }, {} as Record<string, Activity[]>) || {};

  const handleCreateActivity = async () => {
    if (!newActivity.title.trim()) {
      toast({
        title: 'Title required',
        description: 'Please enter an activity title',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('customer_activities')
        .insert({
          customer_id: customerId,
          tenant_id: tenantId,
          activity_type: newActivity.activity_type,
          title: newActivity.title,
          description: newActivity.description || null,
          metadata: {},
          created_by: user.id,
        });

      if (error) {
        if (error.code === '42P01') {
          toast({
            title: 'Activity tracking not available',
            description: 'Please run the database migration to enable activity tracking',
            variant: 'destructive',
          });
          return;
        }
        throw error;
      }

      toast({
        title: 'Activity created',
        description: 'Activity has been added to the timeline',
      });

      setNewActivity({ activity_type: 'note', title: '', description: '' });
      setCreateDialogOpen(false);
      refetch();
    } catch (error: any) {
      toast({
        title: 'Failed to create activity',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground py-8">Loading activities...</div>
        </CardContent>
      </Card>
    );
  }

  const activityList = Object.entries(groupedActivities).sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Activity Timeline
        </CardTitle>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Add Activity
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Activity</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label>Activity Type</Label>
                <Select
                  value={newActivity.activity_type}
                  onValueChange={(value: Activity['activity_type']) =>
                    setNewActivity({ ...newActivity, activity_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="note">Note</SelectItem>
                    <SelectItem value="call">Call</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="task">Task</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Title *</Label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="Activity title"
                  value={newActivity.title}
                  onChange={(e) => setNewActivity({ ...newActivity, title: e.target.value })}
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  placeholder="Add details about this activity..."
                  value={newActivity.description}
                  onChange={(e) => setNewActivity({ ...newActivity, description: e.target.value })}
                  rows={4}
                />
              </div>
              <Button onClick={handleCreateActivity} className="w-full">
                Create Activity
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {activityList.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No activities yet</p>
            <p className="text-sm mt-2">Start tracking customer interactions</p>
          </div>
        ) : (
          <div className="space-y-6">
            {activityList.map(([date, dateActivities]) => (
              <div key={date} className="relative">
                {/* Date Header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-px bg-border flex-1" />
                  <span className="text-sm font-medium text-muted-foreground">
                    {format(new Date(date), 'MMMM d, yyyy')}
                  </span>
                  <div className="h-px bg-border flex-1" />
                </div>

                {/* Activities for this date */}
                <div className="space-y-4 pl-6 border-l-2 border-border">
                  {dateActivities.map((activity) => {
                    const Icon = activityIcons[activity.activity_type] || FileText;
                    const colorClass = activityColors[activity.activity_type] || 'text-gray-500 bg-gray-50';

                    return (
                      <div key={activity.id} className="relative flex gap-4">
                        {/* Timeline dot */}
                        <div className={`absolute -left-[29px] top-1 w-4 h-4 rounded-full border-2 border-background ${colorClass.replace('text-', 'bg-').replace('bg-', 'border-')} flex items-center justify-center`}>
                          <Icon className={`h-3 w-3 ${colorClass.split(' ')[0]}`} />
                        </div>

                        {/* Activity content */}
                        <div className="flex-1 space-y-1 pb-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {activity.activity_type}
                              </Badge>
                              <span className="font-medium text-sm">{activity.title}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(activity.created_at), 'h:mm a')}
                            </span>
                          </div>
                          {activity.description && (
                            <p className="text-sm text-muted-foreground">{activity.description}</p>
                          )}
                          {activity.profiles && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <User className="h-3 w-3" />
                              <span>{activity.profiles.full_name || activity.profiles.email || 'Unknown'}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

