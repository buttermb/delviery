import { useQuery } from '@tanstack/react-query';
import { invokeEdgeFunction } from '@/utils/edgeFunctionHelper';
import { queryKeys } from '@/lib/queryKeys';

interface CurrencyRateResult {
  convertedAmount: number;
  rate: number;
  from: string;
  to: string;
  date: string;
}

interface CurrenciesResult {
  currencies: Record<string, string>;
}

const CURRENCY_REGEX = /^[A-Z]{3}$/;

export function useCurrencyRate(from: string, to: string) {
  const fromUpper = from.toUpperCase();
  const toUpper = to.toUpperCase();
  const enabled = CURRENCY_REGEX.test(fromUpper) && CURRENCY_REGEX.test(toUpper) && fromUpper !== toUpper;

  return useQuery({
    queryKey: queryKeys.externalApis.currencyRate(fromUpper, toUpper),
    queryFn: async () => {
      const { data, error } = await invokeEdgeFunction<CurrencyRateResult>({
        functionName: 'currency-convert',
        body: { from: fromUpper, to: toUpper, amount: 1 },
      });
      if (error) throw error;
      return data;
    },
    enabled,
    staleTime: 4 * 60 * 60 * 1000, // 4 hours
    gcTime: 8 * 60 * 60 * 1000,
    retry: false,
  });
}

export function useCurrencyConvert(from: string, to: string, amount: number) {
  const fromUpper = from.toUpperCase();
  const toUpper = to.toUpperCase();
  const enabled = CURRENCY_REGEX.test(fromUpper) && CURRENCY_REGEX.test(toUpper) && amount > 0;

  const rateQuery = useCurrencyRate(fromUpper, toUpper);

  const convertedAmount = rateQuery.data?.rate
    ? Math.round(amount * rateQuery.data.rate * 100) / 100
    : null;

  return {
    convertedAmount,
    rate: rateQuery.data?.rate ?? null,
    date: rateQuery.data?.date ?? null,
    isLoading: rateQuery.isLoading && enabled,
    isError: rateQuery.isError,
  };
}

export function useSupportedCurrencies() {
  return useQuery({
    queryKey: queryKeys.externalApis.supportedCurrencies(),
    queryFn: async () => {
      const { data, error } = await invokeEdgeFunction<CurrenciesResult>({
        functionName: 'currency-convert',
        body: { action: 'currencies' },
      });
      if (error) throw error;
      return data?.currencies ?? {};
    },
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    gcTime: 7 * 24 * 60 * 60 * 1000,
    retry: false,
  });
}
