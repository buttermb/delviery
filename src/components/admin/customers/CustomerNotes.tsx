/**
 * CustomerNotes Component
 *
 * Internal notes timeline on customer detail page.
 * Features:
 * - Staff can add notes with tags (general/complaint/preference/followup)
 * - Notes show author, timestamp, and tag
 * - Pin important notes
 * - Searchable
 * - Connected to order notes - shows order-specific notes in timeline
 */

import { useState, useMemo } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { MessageSquare, Pin, PinOff, Search, Plus, Edit2, Trash2, X, Save, ShoppingBag, AlertCircle, Heart, Flag, Clock, Filter } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import {
  useCustomerNotes,
  useCreateCustomerNote,
  useUpdateCustomerNote,
  useDeleteCustomerNote,
  useTogglePinNote,
  type CustomerNote,
  type NoteType,
} from '@/hooks/useCustomerNotes';

interface CustomerNotesProps {
  customerId: string;
  className?: string;
}

// Note type configuration
const NOTE_TYPES: Record<NoteType, { label: string; color: string; icon: typeof MessageSquare }> = {
  general: { label: 'General', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300', icon: MessageSquare },
  preference: { label: 'Preference', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: Heart },
  complaint: { label: 'Complaint', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: AlertCircle },
  compliment: { label: 'Compliment', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: Heart },
  followup: { label: 'Follow-up', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: Clock },
  medical: { label: 'Medical', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', icon: Flag },
};

function getInitials(name: string | null | undefined): string {
  if (!name) return '??';
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function CustomerNotes({ customerId, className }: CustomerNotesProps) {
  // Hooks
  const { data: notes, isLoading, isError } = useCustomerNotes(customerId);
  const createNoteMutation = useCreateCustomerNote();
  const updateNoteMutation = useUpdateCustomerNote();
  const deleteNoteMutation = useDeleteCustomerNote();
  const togglePinMutation = useTogglePinNote();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<NoteType | 'all'>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [newNoteType, setNewNoteType] = useState<NoteType>('general');
  const [editingNote, setEditingNote] = useState<CustomerNote | null>(null);
  const [editedText, setEditedText] = useState('');
  const [editedType, setEditedType] = useState<NoteType>('general');
  const [deleteConfirmNote, setDeleteConfirmNote] = useState<CustomerNote | null>(null);

  // Filter and search notes
  const filteredNotes = useMemo(() => {
    if (!notes) return [];

    return notes.filter((note) => {
      // Filter by type
      if (filterType !== 'all' && note.note_type !== filterType) {
        return false;
      }

      // Filter by search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          note.note.toLowerCase().includes(query) ||
          note.author?.full_name?.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [notes, filterType, searchQuery]);

  // Separate pinned and regular notes
  const pinnedNotes = filteredNotes.filter((n) => n.is_pinned);
  const regularNotes = filteredNotes.filter((n) => !n.is_pinned);

  // Handlers
  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    await createNoteMutation.mutateAsync({
      customer_id: customerId,
      note: newNote,
      note_type: newNoteType,
    });

    setNewNote('');
    setNewNoteType('general');
    setShowAddForm(false);
  };

  const handleStartEdit = (note: CustomerNote) => {
    setEditingNote(note);
    setEditedText(note.note);
    setEditedType(note.note_type);
  };

  const handleSaveEdit = async () => {
    if (!editingNote || !editedText.trim()) return;

    await updateNoteMutation.mutateAsync({
      id: editingNote.id,
      note: editedText,
      note_type: editedType,
    });

    setEditingNote(null);
  };

  const handleCancelEdit = () => {
    setEditingNote(null);
    setEditedText('');
    setEditedType('general');
  };

  const handleTogglePin = async (note: CustomerNote) => {
    await togglePinMutation.mutateAsync({
      noteId: note.id,
      isPinned: note.is_pinned,
      customerId,
    });
  };

  const handleDeleteNote = async () => {
    if (!deleteConfirmNote) return;

    await deleteNoteMutation.mutateAsync({
      noteId: deleteConfirmNote.id,
      customerId,
      orderId: deleteConfirmNote.order_id,
    });

    setDeleteConfirmNote(null);
  };

  // Render note item
  const renderNoteItem = (note: CustomerNote) => {
    const noteConfig = NOTE_TYPES[note.note_type] || NOTE_TYPES.general;
    const NoteIcon = noteConfig.icon;
    const isEditing = editingNote?.id === note.id;

    return (
      <div
        key={note.id}
        className={cn(
          'relative p-4 rounded-lg border transition-all',
          note.is_pinned
            ? 'bg-amber-50/50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-800'
            : 'bg-background hover:bg-muted/50'
        )}
      >
        {/* Pin indicator */}
        {note.is_pinned && (
          <div className="absolute -top-2 -right-2">
            <div className="bg-amber-500 text-white p-1 rounded-full shadow-sm">
              <Pin className="h-3 w-3" />
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="text-xs">
                {getInitials(note.author?.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">
                {note.author?.full_name || 'Staff Member'}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Badge className={cn('text-xs', noteConfig.color)}>
              <NoteIcon className="h-3 w-3 mr-1" />
              {noteConfig.label}
            </Badge>

            {/* Order link badge */}
            {note.order && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="text-xs">
                      <ShoppingBag className="h-3 w-3 mr-1" />
                      Order
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Linked to order #{note.order.id.slice(0, 8).toUpperCase()}</p>
                    <p className="text-xs text-muted-foreground">
                      {note.order.status} · ${note.order.total_amount?.toFixed(2)}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>

        {/* Content */}
        {isEditing ? (
          <div className="space-y-3">
            <Textarea
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              rows={3}
              className="resize-none"
              maxLength={1000}
              autoFocus
              aria-label="Edit note"
            />
            <div className="flex items-center gap-2">
              <Select value={editedType} onValueChange={(v) => setEditedType(v as NoteType)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(NOTE_TYPES).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex-1" />
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelEdit}
                disabled={updateNoteMutation.isPending}
              >
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveEdit}
                disabled={!editedText.trim() || updateNoteMutation.isPending}
              >
                <Save className="h-4 w-4 mr-1" />
                Save
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm whitespace-pre-wrap mb-3">{note.note}</p>

            {/* Actions */}
            <div className="flex items-center gap-1 pt-2 border-t">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => handleTogglePin(note)}
                      disabled={togglePinMutation.isPending}
                    >
                      {note.is_pinned ? (
                        <PinOff className="h-3.5 w-3.5" />
                      ) : (
                        <Pin className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {note.is_pinned ? 'Unpin note' : 'Pin note'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => handleStartEdit(note)}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit note</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-destructive hover:text-destructive"
                      onClick={() => setDeleteConfirmNote(note)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete note</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <div className="flex-1" />

              <span className="text-xs text-muted-foreground">
                {format(new Date(note.created_at), 'MMM d, yyyy h:mm a')}
              </span>
            </div>
          </>
        )}
      </div>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (isError) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Customer Notes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Unable to load notes. Please try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('bg-[hsl(var(--tenant-bg))] border-[hsl(var(--tenant-border))]', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Customer Notes
            {notes && notes.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {notes.length}
              </Badge>
            )}
          </CardTitle>
          <Button size="sm" onClick={() => setShowAddForm(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Note
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Add Note Form */}
        {showAddForm && (
          <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
            <Textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add a note about this customer..."
              aria-label="Add a note about this customer"
              rows={3}
              className="resize-none"
              maxLength={1000}
              autoFocus
            />
            <div className="flex items-center gap-2">
              <Select value={newNoteType} onValueChange={(v) => setNewNoteType(v as NoteType)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(NOTE_TYPES).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex-1" />
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddForm(false);
                  setNewNote('');
                  setNewNoteType('general');
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddNote}
                disabled={!newNote.trim() || createNoteMutation.isPending}
              >
                {createNoteMutation.isPending ? 'Adding...' : 'Add Note'}
              </Button>
            </div>
          </div>
        )}

        {/* Search and Filter */}
        {notes && notes.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search notes..."
                aria-label="Search notes"
                className="pl-9"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                  onClick={() => setSearchQuery('')}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            <Select value={filterType} onValueChange={(v) => setFilterType(v as NoteType | 'all')}>
              <SelectTrigger className="w-[140px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(NOTE_TYPES).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Notes List */}
        {filteredNotes.length === 0 ? (
          notes && notes.length > 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">No notes match your search criteria.</p>
              <Button
                variant="link"
                onClick={() => {
                  setSearchQuery('');
                  setFilterType('all');
                }}
              >
                Clear filters
              </Button>
            </div>
          ) : (
            <EnhancedEmptyState
              icon={MessageSquare}
              title="No Notes Yet"
              description="Add the first note about this customer to keep track of important information."
              primaryAction={{
                label: 'Add Note',
                onClick: () => setShowAddForm(true),
              }}
              compact
            />
          )
        ) : (
          <div className="space-y-3">
            {/* Pinned Notes */}
            {pinnedNotes.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Pin className="h-3 w-3" />
                  Pinned ({pinnedNotes.length})
                </p>
                {pinnedNotes.map(renderNoteItem)}
              </div>
            )}

            {/* Regular Notes */}
            {regularNotes.length > 0 && (
              <div className="space-y-2">
                {pinnedNotes.length > 0 && (
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-4">
                    All Notes ({regularNotes.length})
                  </p>
                )}
                {regularNotes.map(renderNoteItem)}
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        open={!!deleteConfirmNote}
        onOpenChange={() => setDeleteConfirmNote(null)}
        onConfirm={handleDeleteNote}
        title="Delete Note"
        description="Are you sure you want to delete this note? This action cannot be undone."
        itemType="note"
        isLoading={deleteNoteMutation.isPending}
      />
    </Card>
  );
}
