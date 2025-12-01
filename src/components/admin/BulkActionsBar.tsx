/**
 * Bulk Actions Bar
 * Floating bar for performing actions on multiple selected tenants
 */

import { Button } from '@/components/ui/button';
import {
    X,
    Mail,
    Ban,
    CheckCircle,
    Download,
    Trash2
} from 'lucide-react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useState } from 'react';

interface BulkActionsBarProps {
    selectedCount: number;
    onClearSelection: () => void;
    onBulkEmail: () => void;
    onBulkSuspend: () => void;
    onBulkUnsuspend: () => void;
    onBulkExport: () => void;
    onBulkDelete?: () => void;
}

export function BulkActionsBar({
    selectedCount,
    onClearSelection,
    onBulkEmail,
    onBulkSuspend,
    onBulkUnsuspend,
    onBulkExport,
    onBulkDelete
}: BulkActionsBarProps) {
    const [actionType, setActionType] = useState<'suspend' | 'delete' | null>(null);

    if (selectedCount === 0) return null;

    return (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-foreground text-background px-4 py-3 rounded-lg shadow-lg flex items-center gap-4 z-50 animate-in slide-in-from-bottom-4 fade-in duration-200">
            <div className="flex items-center gap-2 border-r border-background/20 pr-4">
                <span className="font-semibold">{selectedCount} selected</span>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClearSelection}
                    className="h-6 w-6 p-0 hover:bg-background/20 text-background"
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>

            <div className="flex items-center gap-2">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onBulkEmail}
                    className="hover:bg-background/20 text-background"
                >
                    <Mail className="h-4 w-4 mr-2" />
                    Email
                </Button>

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onBulkExport}
                    className="hover:bg-background/20 text-background"
                >
                    <Download className="h-4 w-4 mr-2" />
                    Export
                </Button>

                <div className="h-4 w-px bg-background/20 mx-1" />

                <AlertDialog open={!!actionType} onOpenChange={(open) => !open && setActionType(null)}>
                    <AlertDialogTrigger asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setActionType('suspend')}
                            className="hover:bg-background/20 text-red-300 hover:text-red-200"
                        >
                            <Ban className="h-4 w-4 mr-2" />
                            Suspend
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will suspend access for {selectedCount} tenants. They will not be able to log in until unsuspended.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={() => {
                                    onBulkSuspend();
                                    setActionType(null);
                                }}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                                Suspend {selectedCount} Tenants
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    );
}
