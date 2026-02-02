import { useState } from 'react';
import { useClientNotes, useCreateNote } from '@/hooks/crm/useNotes';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import Send from "lucide-react/dist/esm/icons/send";
import { format } from 'date-fns';

interface NotesPanelProps {
    clientId: string;
}

export function NotesPanel({ clientId }: NotesPanelProps) {
    const [noteText, setNoteText] = useState('');
    const { data: notes, isLoading } = useClientNotes(clientId);
    const createNote = useCreateNote();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!noteText.trim()) return;

        try {
            await createNote.mutateAsync({
                clientId,
                values: { note_text: noteText },
            });
            setNoteText('');
        } catch (error: unknown) {
            logger.error('Failed to add note', error, { 
                component: 'NotesPanel',
                clientId 
            });
            // Error also handled by hook
        }
    };

    return (
        <div className="grid gap-6 md:grid-cols-2">
            <Card>
                <CardHeader>
                    <CardTitle>Add Note</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <Textarea
                            placeholder="Type your note here..."
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            className="min-h-[150px]"
                        />
                        <Button type="submit" disabled={createNote.isPending || !noteText.trim()}>
                            {createNote.isPending ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Send className="mr-2 h-4 w-4" />
                            )}
                            Add Note
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Notes History</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-6 max-h-[600px] overflow-y-auto pr-2">
                        {isLoading ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin" />
                            </div>
                        ) : notes?.length === 0 ? (
                            <p className="text-center text-muted-foreground py-8">No notes yet.</p>
                        ) : (
                            notes?.map((note) => (
                                <div key={note.id} className="relative pl-6 border-l-2 border-muted pb-6 last:pb-0">
                                    <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full bg-primary" />
                                    <div className="flex flex-col gap-1">
                                        <div className="flex justify-between items-center text-xs text-muted-foreground">
                                            <span>{format(new Date(note.created_at), 'MMM d, yyyy h:mm a')}</span>
                                            <span>by {note.created_by_name || 'Admin'}</span>
                                        </div>
                                        <p className="text-sm whitespace-pre-wrap">{note.note_text}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
