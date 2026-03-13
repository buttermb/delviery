import { useQuery } from '@tanstack/react-query';
import { invokeEdgeFunction } from '@/utils/edgeFunctionHelper';
import { queryKeys } from '@/lib/queryKeys';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface EmailValidationResult {
  valid: boolean;
  isDisposable: boolean;
  isSuspicious: boolean;
  reason: string | null;
  domain?: string;
}

export function useEmailValidation(email: string) {
  const trimmed = email.trim().toLowerCase();
  const isValidFormat = EMAIL_REGEX.test(trimmed);

  const query = useQuery({
    queryKey: queryKeys.externalApis.emailValidation(trimmed),
    queryFn: async () => {
      const { data, error } = await invokeEdgeFunction<EmailValidationResult>({
        functionName: 'validate-email',
        body: { email: trimmed },
      });
      if (error) throw error;
      return data;
    },
    enabled: isValidFormat && trimmed.length > 0,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    gcTime: 24 * 60 * 60 * 1000,
    retry: false,
  });

  return {
    isValid: query.data?.valid ?? true,
    isDisposable: query.data?.isDisposable ?? false,
    isSuspicious: query.data?.isSuspicious ?? false,
    reason: query.data?.reason ?? null,
    isLoading: query.isLoading && isValidFormat,
    isChecked: query.isSuccess,
  };
}
