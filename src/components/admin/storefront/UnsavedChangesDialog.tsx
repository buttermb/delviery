/**
 * UnsavedChangesDialog Component
 * Confirmation dialog when exiting with unsaved changes
 */

import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import Loader2 from "lucide-react/dist/esm/icons/loader-2";

interface UnsavedChangesDialogProps {
    open: boolean;
    isExiting: boolean;
    onDiscard: () => void;
    onSaveDraft: () => void;
    onCancel: () => void;
}

export function UnsavedChangesDialog({
    open,
    isExiting,
    onDiscard,
    onSaveDraft,
    onCancel,
}: UnsavedChangesDialogProps) {
    return (
        <AlertDialog open={open}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
                    <AlertDialogDescription>
                        You have unsaved changes to your storefront. What would you like to do?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                    <Button
                        variant="ghost"
                        onClick={onCancel}
                        disabled={isExiting}
                    >
                        Keep Editing
                    </Button>
                    <Button
                        variant="outline"
                        onClick={onDiscard}
                        disabled={isExiting}
                    >
                        Discard Changes
                    </Button>
                    <Button
                        onClick={onSaveDraft}
                        disabled={isExiting}
                    >
                        {isExiting ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            'Save Draft & Exit'
                        )}
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
