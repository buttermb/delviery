import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import type {
  ReportDataSource,
  DataSourceField,
  DataSourceMetric,
  DataSourceDimension,
} from '@/lib/constants/reportDataSources';
import { DEFAULT_DATA_SOURCES } from '@/lib/constants/reportDataSources';

interface RawDataSource {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  source_type: string;
  source_table: string | null;
  source_rpc: string | null;
  available_fields: unknown;
  available_metrics: unknown;
  available_dimensions: unknown;
  requires_tenant_filter: boolean;
  is_active: boolean;
}

function parseDataSource(raw: RawDataSource): ReportDataSource {
  return {
    id: raw.id,
    name: raw.name,
    display_name: raw.display_name,
    description: raw.description ?? '',
    source_type: raw.source_type as 'table' | 'view' | 'rpc',
    source_table: raw.source_table,
    source_rpc: raw.source_rpc,
    available_fields: (raw.available_fields as DataSourceField[]) ?? [],
    available_metrics: (raw.available_metrics as DataSourceMetric[]) ?? [],
    available_dimensions: (raw.available_dimensions as DataSourceDimension[]) ?? [],
    requires_tenant_filter: raw.requires_tenant_filter,
    is_active: raw.is_active,
  };
}

/**
 * Hook to fetch available report data sources
 * Falls back to default data sources if the database table doesn't exist
 */
export function useReportDataSources() {
  return useQuery({
    queryKey: [...queryKeys.reporting.all, 'data-sources'],
    queryFn: async (): Promise<ReportDataSource[]> => {
      try {
        // Try to fetch from database first
        const { data, error } = await supabase
          .from('report_data_sources')
          .select('id, name, display_name, description, source_type, source_table, source_rpc, available_fields, available_metrics, available_dimensions, requires_tenant_filter, is_active')
          .eq('is_active', true)
          .order('display_name');

        if (error) {
          // Table might not exist yet, use defaults
          if (error.code === '42P01') {
            logger.info('report_data_sources table not found, using defaults', { component: 'useReportDataSources' });
            return DEFAULT_DATA_SOURCES.map((ds, idx) => ({
              ...ds,
              id: `default-${idx}`,
              is_active: true,
            }));
          }
          throw error;
        }

        if (!data || data.length === 0) {
          // No data in table, use defaults
          return DEFAULT_DATA_SOURCES.map((ds, idx) => ({
            ...ds,
            id: `default-${idx}`,
            is_active: true,
          }));
        }

        return (data as RawDataSource[]).map(parseDataSource);
      } catch (err) {
        logger.error('Failed to fetch report data sources', err, { component: 'useReportDataSources' });
        // Return defaults as fallback
        return DEFAULT_DATA_SOURCES.map((ds, idx) => ({
          ...ds,
          id: `default-${idx}`,
          is_active: true,
        }));
      }
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

/**
 * Hook to get fields for selected data sources
 */
export function useDataSourceFields(selectedSources: string[]) {
  const { data: dataSources } = useReportDataSources();

  const fields: DataSourceField[] = [];
  const metrics: DataSourceMetric[] = [];
  const dimensions: DataSourceDimension[] = [];

  if (dataSources) {
    for (const sourceName of selectedSources) {
      const source = dataSources.find((ds) => ds.name === sourceName);
      if (source) {
        // Add source prefix to avoid field name collisions
        fields.push(
          ...source.available_fields.map((f) => ({
            ...f,
            id: selectedSources.length > 1 ? `${sourceName}.${f.id}` : f.id,
            label: selectedSources.length > 1 ? `${source.display_name}: ${f.label}` : f.label,
          }))
        );
        metrics.push(
          ...source.available_metrics.map((m) => ({
            ...m,
            id: selectedSources.length > 1 ? `${sourceName}.${m.id}` : m.id,
            label: selectedSources.length > 1 ? `${source.display_name}: ${m.label}` : m.label,
          }))
        );
        dimensions.push(
          ...source.available_dimensions.map((d) => ({
            ...d,
            id: selectedSources.length > 1 ? `${sourceName}.${d.id}` : d.id,
            label: selectedSources.length > 1 ? `${source.display_name}: ${d.label}` : d.label,
          }))
        );
      }
    }
  }

  return { fields, metrics, dimensions };
}

/**
 * Hook to get a single data source by name
 */
export function useDataSource(sourceName: string) {
  const { data: dataSources, isLoading, error } = useReportDataSources();

  const dataSource = dataSources?.find((ds) => ds.name === sourceName);

  return {
    dataSource,
    isLoading,
    error,
  };
}
