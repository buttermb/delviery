import { useState, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import {
  Loader2,
  Play,
  Download,
  Database,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { useReportDataSources } from '@/hooks/useReportDataSources';
import type {
  ReportFilter,
  DateRangePreset,
  VisualizationType,
} from '@/lib/constants/reportDataSources';
import { formatCurrency } from '@/lib/utils/formatCurrency';

interface ReportQueryBuilderProps {
  reportId?: string;
  dataSources: string[];
  selectedFields: string[];
  metrics: string[];
  dimensions: string[];
  filters: ReportFilter[];
  dateRangePreset: DateRangePreset;
  customStartDate?: string;
  customEndDate?: string;
  visualizationType: VisualizationType;
  onPreviewComplete?: (data: unknown[]) => void;
}

interface QueryResult {
  data: Record<string, unknown>[];
  metrics: Record<string, number>;
  rowCount: number;
  executionTime: number;
}

/**
 * Calculate date range based on preset
 */
function getDateRange(preset: DateRangePreset, customStart?: string, customEnd?: string): { start: string; end: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let start: Date;
  let end: Date = today;

  switch (preset) {
    case 'today':
      start = today;
      break;
    case 'yesterday':
      start = new Date(today);
      start.setDate(start.getDate() - 1);
      end = new Date(start);
      break;
    case 'this_week':
      start = new Date(today);
      start.setDate(start.getDate() - start.getDay());
      break;
    case 'last_week':
      start = new Date(today);
      start.setDate(start.getDate() - start.getDay() - 7);
      end = new Date(start);
      end.setDate(end.getDate() + 6);
      break;
    case 'this_month':
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      break;
    case 'last_month':
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      end = new Date(today.getFullYear(), today.getMonth(), 0);
      break;
    case 'this_quarter': {
      const quarter = Math.floor(today.getMonth() / 3);
      start = new Date(today.getFullYear(), quarter * 3, 1);
      break;
    }
    case 'last_quarter': {
      const lastQuarter = Math.floor(today.getMonth() / 3) - 1;
      const year = lastQuarter < 0 ? today.getFullYear() - 1 : today.getFullYear();
      const qStart = lastQuarter < 0 ? 3 : lastQuarter;
      start = new Date(year, qStart * 3, 1);
      end = new Date(year, qStart * 3 + 3, 0);
      break;
    }
    case 'this_year':
      start = new Date(today.getFullYear(), 0, 1);
      break;
    case 'last_year':
      start = new Date(today.getFullYear() - 1, 0, 1);
      end = new Date(today.getFullYear() - 1, 11, 31);
      break;
    case 'custom':
      return {
        start: customStart || today.toISOString().split('T')[0],
        end: customEnd || today.toISOString().split('T')[0],
      };
    default:
      start = new Date(today.getFullYear(), today.getMonth(), 1);
  }

  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

/**
 * Format cell value based on field type
 */
function formatCellValue(value: unknown, fieldId: string): string {
  if (value === null || value === undefined) return '-';

  // Currency fields
  if (
    fieldId.includes('amount') ||
    fieldId.includes('total') ||
    fieldId.includes('price') ||
    fieldId.includes('cost') ||
    fieldId.includes('revenue') ||
    fieldId.includes('sales')
  ) {
    const num = Number(value);
    if (!isNaN(num)) {
      return formatCurrency(num);
    }
  }

  // Date fields
  if (fieldId.includes('_at') || fieldId.includes('date')) {
    try {
      const date = new Date(String(value));
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString();
      }
    } catch {
      // Fall through to default
    }
  }

  // Boolean fields
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  return String(value);
}

export function ReportQueryBuilder(props: ReportQueryBuilderProps) {
  const {
    reportId,
    dataSources,
    selectedFields,
    metrics,
    // dimensions - reserved for future group-by implementation
    filters,
    dateRangePreset,
    customStartDate,
    customEndDate,
    // visualizationType - reserved for future chart visualization
    onPreviewComplete,
  } = props;
  const { tenant } = useTenantAdminAuth();
  const { data: allDataSources } = useReportDataSources();
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);

  // Get field labels for display
  const fieldLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    if (allDataSources) {
      for (const ds of allDataSources) {
        if (dataSources.includes(ds.name)) {
          for (const field of ds.available_fields) {
            labels[field.id] = field.label;
            labels[`${ds.name}.${field.id}`] = `${ds.display_name}: ${field.label}`;
          }
          for (const metric of ds.available_metrics) {
            labels[metric.id] = metric.label;
            labels[`${ds.name}.${metric.id}`] = `${ds.display_name}: ${metric.label}`;
          }
        }
      }
    }
    return labels;
  }, [allDataSources, dataSources]);

  // Execute report query
  const executeQuery = useMutation({
    mutationFn: async (): Promise<QueryResult> => {
      const startTime = performance.now();
      const dateRange = getDateRange(dateRangePreset, customStartDate, customEndDate);

      // If we have a saved report ID, use the edge function
      if (reportId) {
        const { data, error } = await supabase.functions.invoke('generate-custom-report', {
          body: {
            reportId,
            startDate: dateRange.start,
            endDate: dateRange.end,
            filters: filters.reduce(
              (acc, f) => ({ ...acc, [f.field]: f.value }),
              {}
            ),
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        const endTime = performance.now();

        // Flatten the data from multiple sources
        const flatData: Record<string, unknown>[] = [];
        if (data?.data) {
          for (const sourceData of Object.values(data.data)) {
            if (Array.isArray(sourceData)) {
              flatData.push(...(sourceData as Record<string, unknown>[]));
            }
          }
        }

        return {
          data: flatData,
          metrics: data?.metrics || {},
          rowCount: flatData.length,
          executionTime: Math.round(endTime - startTime),
        };
      }

      // Otherwise, build and execute the query directly
      if (!tenant?.id) throw new Error('Tenant ID required');

      const allResults: Record<string, unknown>[] = [];
      const calculatedMetrics: Record<string, number> = {};

      for (const sourceName of dataSources) {
        const source = allDataSources?.find((ds) => ds.name === sourceName);
        if (!source?.source_table) continue;

        // Build query - use (supabase as any) to bypass deep type instantiation
        let query = (supabase as any)
          .from(source.source_table)
          .select('*');

        // Apply tenant filter if required
        if (source.requires_tenant_filter) {
          query = query.eq('tenant_id', tenant.id);
        }

        // Apply date filter
        query = query.gte('created_at', dateRange.start);
        query = query.lte('created_at', dateRange.end + 'T23:59:59');

        // Apply custom filters
        for (const filter of filters) {
          const fieldName = filter.field.includes('.') ? filter.field.split('.')[1] : filter.field;
          switch (filter.operator) {
            case 'equals':
              query = query.eq(fieldName, filter.value);
              break;
            case 'not_equals':
              query = query.neq(fieldName, filter.value);
              break;
            case 'contains':
              query = query.ilike(fieldName, `%${filter.value}%`);
              break;
            case 'greater_than':
              query = query.gt(fieldName, filter.value);
              break;
            case 'less_than':
              query = query.lt(fieldName, filter.value);
              break;
            case 'greater_or_equal':
              query = query.gte(fieldName, filter.value);
              break;
            case 'less_or_equal':
              query = query.lte(fieldName, filter.value);
              break;
            case 'is_null':
              query = query.is(fieldName, null);
              break;
            case 'is_not_null':
              query = query.not(fieldName, 'is', null);
              break;
          }
        }

        const { data: sourceData, error } = await query.limit(1000);

        if (error) {
          logger.error(`Error querying ${sourceName}`, error, { component: 'ReportQueryBuilder' });
          continue;
        }

        if (sourceData) {
          // Calculate metrics for this source
          for (const metricId of metrics) {
            const metric = source.available_metrics.find(
              (m) => m.id === metricId || m.id === metricId.replace(`${sourceName}.`, '')
            );
            if (metric) {
              switch (metric.aggregation) {
                case 'count':
                  calculatedMetrics[metric.id] = (calculatedMetrics[metric.id] || 0) + sourceData.length;
                  break;
                case 'sum':
                  if (metric.field) {
                    const sum = sourceData.reduce(
                      (acc, row) => acc + (Number(row[metric.field as string]) || 0),
                      0
                    );
                    calculatedMetrics[metric.id] = (calculatedMetrics[metric.id] || 0) + sum;
                  }
                  break;
                case 'avg':
                  if (metric.field && sourceData.length > 0) {
                    const sum = sourceData.reduce(
                      (acc, row) => acc + (Number(row[metric.field as string]) || 0),
                      0
                    );
                    calculatedMetrics[metric.id] = sum / sourceData.length;
                  }
                  break;
              }
            }
          }

          // Add source data to results
          allResults.push(...(sourceData as Record<string, unknown>[]));
        }
      }

      const endTime = performance.now();

      return {
        data: allResults,
        metrics: calculatedMetrics,
        rowCount: allResults.length,
        executionTime: Math.round(endTime - startTime),
      };
    },
    onSuccess: (result) => {
      setQueryResult(result);
      onPreviewComplete?.(result.data);
      toast.success(`Query completed: ${result.rowCount} rows in ${result.executionTime}ms`);
    },
    onError: (error: unknown) => {
      logger.error('Query execution failed', error, { component: 'ReportQueryBuilder' });
      toast.error('Failed to execute query');
    },
  });

  // Export results to CSV
  const exportToCsv = () => {
    if (!queryResult?.data || queryResult.data.length === 0) {
      toast.error('No data to export');
      return;
    }

    const fieldsToExport = selectedFields.length > 0 ? selectedFields : Object.keys(queryResult.data[0]);
    const headers = fieldsToExport.map((f) => fieldLabels[f] || f);

    const csvContent = [
      headers.join(','),
      ...queryResult.data.map((row) =>
        fieldsToExport
          .map((field) => {
            const fieldName = field.includes('.') ? field.split('.')[1] : field;
            const value = row[fieldName];
            const formatted = formatCellValue(value, field);
            // Escape quotes and wrap in quotes if contains comma
            if (formatted.includes(',') || formatted.includes('"')) {
              return `"${formatted.replace(/"/g, '""')}"`;
            }
            return formatted;
          })
          .join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    toast.success('Report exported successfully');
  };

  const isConfigured = dataSources.length > 0;
  const hasResults = queryResult && queryResult.data.length > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Query Preview
            </CardTitle>
            <CardDescription>
              Preview your report data before saving
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => executeQuery.mutate()}
              disabled={!isConfigured || executeQuery.isPending}
            >
              {executeQuery.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Run Query
            </Button>
            {hasResults && (
              <Button variant="outline" size="sm" onClick={exportToCsv}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!isConfigured ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Select data sources and fields to preview your report.</p>
          </div>
        ) : executeQuery.isPending ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-3 text-muted-foreground">Executing query...</span>
          </div>
        ) : !queryResult ? (
          <div className="text-center py-8 text-muted-foreground">
            <RefreshCw className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Click "Run Query" to preview your report data.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Query Stats */}
            <div className="flex items-center gap-4 text-sm">
              <Badge variant="outline" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {queryResult.rowCount} rows
              </Badge>
              <Badge variant="outline">{queryResult.executionTime}ms</Badge>
              {Object.keys(queryResult.metrics).length > 0 && (
                <Separator orientation="vertical" className="h-4" />
              )}
              {Object.entries(queryResult.metrics).map(([key, value]) => (
                <Badge key={key} variant="secondary">
                  {fieldLabels[key] || key}: {formatCellValue(value, key)}
                </Badge>
              ))}
            </div>

            {/* Results Table */}
            {queryResult.data.length > 0 ? (
              <ScrollArea className="h-[400px] border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {(selectedFields.length > 0
                        ? selectedFields
                        : Object.keys(queryResult.data[0])
                      ).map((field) => {
                        const fieldName = field.includes('.') ? field.split('.')[1] : field;
                        return (
                          <TableHead key={field} className="whitespace-nowrap">
                            {fieldLabels[field] || fieldName}
                          </TableHead>
                        );
                      })}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {queryResult.data.slice(0, 100).map((row, idx) => (
                      <TableRow key={idx}>
                        {(selectedFields.length > 0
                          ? selectedFields
                          : Object.keys(row)
                        ).map((field) => {
                          const fieldName = field.includes('.') ? field.split('.')[1] : field;
                          return (
                            <TableCell key={field} className="whitespace-nowrap">
                              {formatCellValue(row[fieldName], field)}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {queryResult.data.length > 100 && (
                  <div className="p-2 text-center text-sm text-muted-foreground border-t">
                    Showing first 100 rows of {queryResult.rowCount} total
                  </div>
                )}
              </ScrollArea>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No data found for the selected criteria.</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
