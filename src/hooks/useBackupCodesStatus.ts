import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showSuccessToast, showErrorToast } from '@/utils/toastHelpers';

interface BackupCodesStatus {
  total_codes: number;
  unused_codes: number;
  used_codes: number;
  needs_regeneration: boolean;
}

export function useBackupCodesStatus() {
  const queryClient = useQueryClient();

  const { data: status, isLoading, error } = useQuery({
    queryKey: ['backup-codes-status'],
    queryFn: async (): Promise<BackupCodesStatus | null> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .rpc('get_backup_codes_status', { p_user_id: user.id });

      if (error) throw error;
      return data?.[0] || null;
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: async (): Promise<string[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Generate 10 new backup codes
      const codes: string[] = [];
      const codeHashes: string[] = [];
      
      for (let i = 0; i < 10; i++) {
        const code = generateBackupCode();
        codes.push(code);
        codeHashes.push(await hashCode(code));
      }

      const { error } = await supabase
        .rpc('regenerate_backup_codes', { 
          p_user_id: user.id, 
          p_code_hashes: codeHashes 
        });

      if (error) throw error;
      return codes;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backup-codes-status'] });
      showSuccessToast('Backup codes regenerated successfully');
    },
    onError: (error) => {
      showErrorToast(`Failed to regenerate codes: ${error.message}`);
    },
  });

  return {
    status,
    isLoading,
    error,
    unusedCount: status?.unused_codes ?? 0,
    needsRegeneration: status?.needs_regeneration ?? false,
    regenerateCodes: regenerateMutation.mutateAsync,
    isRegenerating: regenerateMutation.isPending,
  };
}

// Generate a random backup code (8 alphanumeric characters)
function generateBackupCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding similar chars: 0O1I
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Hash a backup code using SHA-256
async function hashCode(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
