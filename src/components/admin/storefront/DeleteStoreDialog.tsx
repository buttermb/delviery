import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";

interface DeleteStoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  storeName: string;
  isDeleting?: boolean;
}

export function DeleteStoreDialog({
  open,
  onOpenChange,
  onConfirm,
  storeName,
  isDeleting = false,
}: DeleteStoreDialogProps) {
  const [confirmText, setConfirmText] = useState('');
  const isConfirmed = confirmText === storeName;

  const handleConfirm = () => {
    if (isConfirmed) {
      onConfirm();
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setConfirmText('');
    }
    onOpenChange(newOpen);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <AlertDialogTitle>Delete Store</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-3 pt-2">
            <p>
              This action <strong>cannot be undone</strong>. This will permanently delete your store
              and all associated data including:
            </p>
            <ul className="list-disc list-inside text-sm space-y-1">
              <li>All product settings and customizations</li>
              <li>Order history and customer data</li>
              <li>Store analytics and metrics</li>
              <li>Theme and branding configurations</li>
            </ul>
            <div className="pt-2">
              <Label htmlFor="confirm-delete" className="text-sm font-medium">
                Type <span className="font-bold text-foreground">{storeName}</span> to confirm:
              </Label>
              <Input
                id="confirm-delete"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={storeName}
                className="mt-2"
                disabled={isDeleting}
              />
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!isConfirmed || isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? 'Deleting...' : 'Delete Store'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
