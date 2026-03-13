import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { invokeEdgeFunction } from '@/utils/edgeFunctionHelper';
import { queryKeys } from '@/lib/queryKeys';

interface Holiday {
  date: string;
  name: string;
  localName: string;
  fixed: boolean;
}

interface PublicHolidaysResponse {
  holidays: Holiday[];
}

export function usePublicHolidays(countryCode: string, year: number) {
  const code = countryCode.toUpperCase();
  const enabled = code.length === 2 && year >= 2020 && year <= 2035;

  const query = useQuery({
    queryKey: queryKeys.externalApis.publicHolidays(code, year),
    queryFn: async () => {
      const { data, error } = await invokeEdgeFunction<PublicHolidaysResponse>({
        functionName: 'public-holidays',
        body: { countryCode: code, year },
      });
      if (error) throw error;
      return data?.holidays ?? [];
    },
    enabled,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    gcTime: 7 * 24 * 60 * 60 * 1000, // 7 days
    retry: false,
  });

  const holidays = query.data ?? [];

  const isHoliday = useCallback(
    (date: Date | string): boolean => {
      const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
      return holidays.some(h => h.date === dateStr);
    },
    [holidays]
  );

  const getHolidayName = useCallback(
    (date: Date | string): string | null => {
      const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
      return holidays.find(h => h.date === dateStr)?.name ?? null;
    },
    [holidays]
  );

  return {
    holidays,
    isHoliday,
    getHolidayName,
    isLoading: query.isLoading && enabled,
  };
}
