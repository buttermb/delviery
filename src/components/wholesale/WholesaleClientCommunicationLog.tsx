/**
 * Wholesale Client Communication Log Component
 * Track all communications with wholesale clients
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Phone, Mail, FileText, Plus } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { formatSmartDate } from "@/lib/formatters";
import { Badge } from "@/components/ui/badge";

interface CommunicationEntry {
  id: string;
  type: 'email' | 'phone' | 'meeting' | 'note';
  content: string;
  created_at: string;
  created_by?: string;
}

interface WholesaleClientCommunicationLogProps {
  clientId: string;
}

export function WholesaleClientCommunicationLog({ clientId }: WholesaleClientCommunicationLogProps) {
  const [showForm, setShowForm] = useState(false);
  const [newEntry, setNewEntry] = useState({
    type: 'note' as CommunicationEntry['type'],
    content: '',
  });

  const queryClient = useQueryClient();

  const { data: communications = [], isLoading } = useQuery({
    queryKey: ['client-communications', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_communications')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as CommunicationEntry[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('client_communications')
        .insert({
          client_id: clientId,
          type: newEntry.type,
          content: newEntry.content,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Communication logged');
      queryClient.invalidateQueries({ queryKey: ['client-communications', clientId] });
      setNewEntry({ type: 'note', content: '' });
      setShowForm(false);
    },
    onError: (error) => {
      logger.error('Failed to log communication', { error });
      toast.error('Failed to log communication');
    },
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'phone':
        return <Phone className="h-4 w-4" />;
      case 'meeting':
        return <MessageSquare className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'email':
        return 'bg-blue-500/10 text-blue-700 border-blue-200';
      case 'phone':
        return 'bg-green-500/10 text-green-700 border-green-200';
      case 'meeting':
        return 'bg-purple-500/10 text-purple-700 border-purple-200';
      default:
        return 'bg-gray-500/10 text-gray-700 border-gray-200';
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Communication Log
        </CardTitle>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Entry
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
            <div className="space-y-2">
              <Label htmlFor="comm-type">Type</Label>
              <Select
                value={newEntry.type}
                onValueChange={(v) => setNewEntry({ ...newEntry, type: v as typeof newEntry.type })}
              >
                <SelectTrigger id="comm-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="phone">Phone Call</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="note">Note</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="comm-content">Notes</Label>
              <Textarea
                id="comm-content"
                placeholder="What was discussed?"
                value={newEntry.content}
                onChange={(e) => setNewEntry({ ...newEntry, content: e.target.value })}
                rows={3}
              />
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => addMutation.mutate()}
                disabled={!newEntry.content || addMutation.isPending}
              >
                Save Entry
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  setNewEntry({ type: 'note', content: '' });
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : communications.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No communications logged</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {communications.map((comm) => (
              <div key={comm.id} className="p-3 border rounded-lg bg-background">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={getTypeColor(comm.type)}>
                      {getTypeIcon(comm.type)}
                      <span className="ml-1 capitalize">{comm.type}</span>
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatSmartDate(comm.created_at)}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{comm.content}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
