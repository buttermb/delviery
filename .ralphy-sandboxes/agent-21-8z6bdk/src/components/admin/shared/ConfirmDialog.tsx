/**
 * Re-exports ConfirmDialog from the shared component library.
 *
 * This adapter preserves the legacy isOpen/onCancel prop API used by
 * existing admin pages while delegating to the canonical shared
 * ConfirmDialog which uses open/onOpenChange (matching shadcn patterns).
 *
 * New code should import directly from '@/components/shared/ConfirmDialog'.
 */
export {
  ConfirmDialog,
  type ConfirmDialogVariant,
  type ConfirmDialogProps,
} from '@/components/shared/ConfirmDialog';

export { ConfirmDialog as default } from '@/components/shared/ConfirmDialog';
