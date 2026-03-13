import { useQuery } from '@tanstack/react-query';
import { invokeEdgeFunction } from '@/utils/edgeFunctionHelper';
import { queryKeys } from '@/lib/queryKeys';

interface BarcodeProduct {
  name: string | null;
  brand: string | null;
  imageUrl: string | null;
  category: string | null;
  description: string | null;
}

interface BarcodeLookupResult {
  found: boolean;
  product: BarcodeProduct | null;
}

export function useBarcodeLookup(barcode: string) {
  const trimmed = barcode.trim();
  const enabled = trimmed.length >= 8 && /^\d+$/.test(trimmed);

  const query = useQuery({
    queryKey: queryKeys.externalApis.barcodeLookup(trimmed),
    queryFn: async () => {
      const { data, error } = await invokeEdgeFunction<BarcodeLookupResult>({
        functionName: 'barcode-lookup',
        body: { barcode: trimmed },
      });
      if (error) throw error;
      return data;
    },
    enabled,
    staleTime: 7 * 24 * 60 * 60 * 1000, // 7 days
    gcTime: 7 * 24 * 60 * 60 * 1000,
    retry: false,
  });

  return {
    found: query.data?.found ?? false,
    product: query.data?.product ?? null,
    isLoading: query.isLoading && enabled,
  };
}
