import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, AlertCircle, DollarSign, Package, Plus, Loader2 } from "lucide-react";
import { showSuccessToast, showErrorToast } from "@/utils/toastHelpers";
import { formatSmartDate } from "@/lib/formatters";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ClientNotesPanelProps {
  clientId: string;
}

interface ClientNote {
  id: string;
  note: string;
  note_type: string;
  created_at: string;
  created_by: string;
  is_internal: boolean;
}

export function ClientNotesPanel({ clientId }: ClientNotesPanelProps) {
  const queryClient = useQueryClient();
  const [newNote, setNewNote] = useState("");
  const [noteType, setNoteType] = useState("general");
  const [isAdding, setIsAdding] = useState(false);

  // Fetch notes
  const { data: notes = [], isLoading } = useQuery({
    queryKey: queryKeys.clientNotes.byClient(clientId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wholesale_client_notes")
        .select('id, note, note_type, created_at, created_by, is_internal')
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as ClientNote[];
    },
  });

  // Add note mutation
  const addNoteMutation = useMutation({
    mutationFn: async ({ note, type }: { note: string; type: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("wholesale_client_notes")
        .insert({
          client_id: clientId,
          note,
          note_type: type,
          created_by: user?.id,
          is_internal: true,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clientNotes.byClient(clientId) });
      setNewNote("");
      setNoteType("general");
      setIsAdding(false);
      showSuccessToast("Success", "Note added successfully");
    },
    onError: (error) => {
      showErrorToast("Error", error instanceof Error ? error.message : "Failed to add note");
    },
  });

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    addNoteMutation.mutate({ note: newNote, type: noteType });
  };

  const getNoteIcon = (type: string) => {
    switch (type) {
      case "payment":
        return <DollarSign className="h-4 w-4" />;
      case "order":
        return <Package className="h-4 w-4" />;
      case "warning":
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getNoteColor = (type: string) => {
    switch (type) {
      case "payment":
        return "bg-success/10 text-success border-success/20";
      case "order":
        return "bg-info/10 text-info border-info/20";
      case "warning":
        return "bg-destructive/10 text-destructive border-destructive/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Internal Notes</h3>
          <Badge variant="outline">{notes.length}</Badge>
        </div>
        <Button
          size="sm"
          onClick={() => setIsAdding(!isAdding)}
          variant={isAdding ? "outline" : "default"}
        >
          <Plus className="h-4 w-4 mr-1" />
          {isAdding ? "Cancel" : "Add Note"}
        </Button>
      </div>

      {isAdding && (
        <div className="mb-4 p-4 border rounded-lg bg-muted/30 space-y-3">
          <Select value={noteType} onValueChange={setNoteType}>
            <SelectTrigger aria-label="Note type">
              <SelectValue placeholder="Note type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general">General</SelectItem>
              <SelectItem value="payment">Payment</SelectItem>
              <SelectItem value="order">Order</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
            </SelectContent>
          </Select>

          <Textarea
            placeholder="Add internal note about this client..."
            aria-label="Add internal note about this client"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            maxLength={1000}
            className="min-h-[100px]"
          />

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsAdding(false);
                setNewNote("");
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAddNote}
              disabled={!newNote.trim() || addNoteMutation.isPending}
            >
              {addNoteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {addNoteMutation.isPending ? "Saving..." : "Save Note"}
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading notes...
          </div>
        ) : notes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No notes yet</p>
            <p className="text-sm">Add notes to track conversations and important info</p>
          </div>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className="p-4 border rounded-lg bg-background hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <Badge className={getNoteColor(note.note_type)}>
                  {getNoteIcon(note.note_type)}
                  <span className="ml-1 capitalize">{note.note_type}</span>
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {formatSmartDate(note.created_at, { includeTime: true })}
                </span>
              </div>
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {note.note}
              </p>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
