import { useState, useCallback } from 'react';

interface ConfirmDialogState {
  open: boolean;
  title: string;
  description: string;
  itemName?: string;
  itemType?: string;
  onConfirm: () => void | Promise<void>;
  isLoading: boolean;
}

interface UseConfirmDialogReturn {
  dialogState: ConfirmDialogState;
  confirm: (options: {
    title?: string;
    description?: string;
    itemName?: string;
    itemType?: string;
    onConfirm: () => void | Promise<void>;
  }) => void;
  closeDialog: () => void;
  setLoading: (loading: boolean) => void;
}

const initialState: ConfirmDialogState = {
  open: false,
  title: 'Confirm Action',
  description: 'Are you sure you want to proceed?',
  onConfirm: () => {},
  isLoading: false,
};

export function useConfirmDialog(): UseConfirmDialogReturn {
  const [dialogState, setDialogState] = useState<ConfirmDialogState>(initialState);

  const confirm = useCallback((options: {
    title?: string;
    description?: string;
    itemName?: string;
    itemType?: string;
    onConfirm: () => void | Promise<void>;
  }) => {
    setDialogState({
      open: true,
      title: options.title || 'Confirm Action',
      description: options.description || 'Are you sure you want to proceed?',
      itemName: options.itemName,
      itemType: options.itemType,
      onConfirm: options.onConfirm,
      isLoading: false,
    });
  }, []);

  const closeDialog = useCallback(() => {
    setDialogState(prev => ({ ...prev, open: false }));
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    setDialogState(prev => ({ ...prev, isLoading: loading }));
  }, []);

  return {
    dialogState,
    confirm,
    closeDialog,
    setLoading,
  };
}
