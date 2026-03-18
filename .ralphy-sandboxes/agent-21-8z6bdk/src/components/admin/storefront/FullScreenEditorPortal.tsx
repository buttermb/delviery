/**
 * FullScreenEditorPortal Component
 * Renders the storefront editor as a full-screen dialog using shadcn Dialog
 */

import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';

interface FullScreenEditorPortalProps {
    children: React.ReactNode;
    isOpen: boolean;
    onRequestClose?: () => void;
}

export function FullScreenEditorPortal({
    children,
    isOpen,
    onRequestClose,
}: FullScreenEditorPortalProps) {
    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!open) onRequestClose?.();
            }}
        >
            <DialogContent
                className="left-0 top-0 translate-x-0 translate-y-0 w-screen h-screen max-w-none max-h-screen sm:max-h-screen sm:w-screen sm:p-0 max-sm:max-h-screen max-sm:max-w-none max-sm:w-screen p-0 border-0 rounded-none gap-0 shadow-none overflow-hidden bg-background data-[state=closed]:zoom-out-100 data-[state=open]:zoom-in-100 data-[state=closed]:slide-out-to-left-0 data-[state=closed]:slide-out-to-top-0 data-[state=open]:slide-in-from-left-0 data-[state=open]:slide-in-from-top-0 [&>button:last-child]:hidden"
                onInteractOutside={(e) => e.preventDefault()}
            >
                <DialogTitle className="sr-only">Storefront Editor</DialogTitle>
                <DialogDescription className="sr-only">
                    Full screen storefront design editor
                </DialogDescription>
                <div className="h-full w-full fullscreen-editor-content">
                    {children}
                </div>
            </DialogContent>
        </Dialog>
    );
}
