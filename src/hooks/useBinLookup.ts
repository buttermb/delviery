import { useQuery } from '@tanstack/react-query';
import { invokeEdgeFunction } from '@/utils/edgeFunctionHelper';
import { queryKeys } from '@/lib/queryKeys';

interface BinCard {
  scheme: string | null;
  type: string | null;
  brand: string | null;
  prepaid: boolean | null;
  country: { alpha2: string | null; name: string | null } | null;
  bank: { name: string | null } | null;
}

interface BinLookupResult {
  found: boolean;
  card: BinCard | null;
}

const BIN_REGEX = /^\d{6,8}$/;

export function useBinLookup(bin: string) {
  const trimmed = bin.trim();
  const enabled = BIN_REGEX.test(trimmed);

  const query = useQuery({
    queryKey: queryKeys.externalApis.binLookup(trimmed),
    queryFn: async () => {
      const { data, error } = await invokeEdgeFunction<BinLookupResult>({
        functionName: 'bin-lookup',
        body: { bin: trimmed },
      });
      if (error) throw error;
      return data;
    },
    enabled,
    staleTime: 30 * 24 * 60 * 60 * 1000, // 30 days
    gcTime: 30 * 24 * 60 * 60 * 1000,
    retry: false,
  });

  return {
    found: query.data?.found ?? false,
    card: query.data?.card ?? null,
    isLoading: query.isLoading && enabled,
  };
}
