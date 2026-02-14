import { logger } from '@/lib/logger';
import { useState, useCallback, useMemo } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { queryKeys } from '@/lib/queryKeys';
import {
  useReportDataSources,
  useDataSourceFields,
} from '@/hooks/useReportDataSources';
import {
  DATE_RANGE_PRESETS,
  VISUALIZATION_TYPES,
  FILTER_OPERATORS,
  getOperatorsForFieldType,
  type DateRangePreset,
  type VisualizationType,
  type ReportFilter,
  type FilterOperator,
} from '@/lib/constants/reportDataSources';
import { SCHEDULE_OPTIONS } from '@/lib/constants/reportFields';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Database,
  Download,
  Filter,
  LayoutGrid,
  LineChart,
  Loader2,
  PieChart,
  Play,
  Plus,
  Save,
  Table2,
  TrendingUp,
  X,
  CheckCircle2,
  Clock,
  FileText,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';

// --- Types ---

interface ReportFormState {
  name: string;
  description: string;
  data_sources: string[];
  selected_fields: string[];
  metrics: string[];
  dimensions: string[];
  filters: ReportFilter[];
  date_range_preset: DateRangePreset;
  custom_start_date: string;
  custom_end_date: string;
  visualization_type: VisualizationType;
  format: string;
  schedule: string;
}

interface QueryResult {
  data: Record<string, unknown>[];
  metrics: Record<string, number>;
  rowCount: number;
  executionTime: number;
}

type BuilderStep = 'sources' | 'fields' | 'filters' | 'preview';

const STEPS: { key: BuilderStep; label: string; icon: React.ReactNode }[] = [
  { key: 'sources', label: 'Data Sources', icon: <Database className="h-4 w-4" /> },
  { key: 'fields', label: 'Fields & Metrics', icon: <Table2 className="h-4 w-4" /> },
  { key: 'filters', label: 'Filters', icon: <Filter className="h-4 w-4" /> },
  { key: 'preview', label: 'Preview & Save', icon: <BarChart3 className="h-4 w-4" /> },
];

const VISUALIZATION_ICONS: Record<VisualizationType, React.ReactNode> = {
  table: <Table2 className="h-4 w-4" />,
  bar_chart: <BarChart3 className="h-4 w-4" />,
  line_chart: <LineChart className="h-4 w-4" />,
  pie_chart: <PieChart className="h-4 w-4" />,
  area_chart: <TrendingUp className="h-4 w-4" />,
  metric_cards: <LayoutGrid className="h-4 w-4" />,
};

const INITIAL_FORM: ReportFormState = {
  name: '',
  description: '',
  data_sources: [],
  selected_fields: [],
  metrics: [],
  dimensions: [],
  filters: [],
  date_range_preset: 'this_month',
  custom_start_date: '',
  custom_end_date: '',
  visualization_type: 'table',
  format: 'csv',
  schedule: 'none',
};

// --- Helpers ---

function getDateRange(preset: DateRangePreset, customStart?: string, customEnd?: string) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let start: Date;
  let end: Date = today;

  switch (preset) {
    case 'today': start = today; break;
    case 'yesterday':
      start = new Date(today); start.setDate(start.getDate() - 1); end = new Date(start); break;
    case 'this_week':
      start = new Date(today); start.setDate(start.getDate() - start.getDay()); break;
    case 'last_week':
      start = new Date(today); start.setDate(start.getDate() - start.getDay() - 7);
      end = new Date(start); end.setDate(end.getDate() + 6); break;
    case 'this_month':
      start = new Date(today.getFullYear(), today.getMonth(), 1); break;
    case 'last_month':
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      end = new Date(today.getFullYear(), today.getMonth(), 0); break;
    case 'this_quarter': {
      const q = Math.floor(today.getMonth() / 3);
      start = new Date(today.getFullYear(), q * 3, 1); break;
    }
    case 'last_quarter': {
      const lq = Math.floor(today.getMonth() / 3) - 1;
      const yr = lq < 0 ? today.getFullYear() - 1 : today.getFullYear();
      const qs = lq < 0 ? 3 : lq;
      start = new Date(yr, qs * 3, 1);
      end = new Date(yr, qs * 3 + 3, 0); break;
    }
    case 'this_year':
      start = new Date(today.getFullYear(), 0, 1); break;
    case 'last_year':
      start = new Date(today.getFullYear() - 1, 0, 1);
      end = new Date(today.getFullYear() - 1, 11, 31); break;
    case 'custom':
      return {
        start: customStart || today.toISOString().split('T')[0],
        end: customEnd || today.toISOString().split('T')[0],
      };
    default:
      start = new Date(today.getFullYear(), today.getMonth(), 1);
  }

  return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
}

function formatCellValue(value: unknown, fieldId: string): string {
  if (value === null || value === undefined) return '-';
  if (
    fieldId.includes('amount') || fieldId.includes('total') ||
    fieldId.includes('price') || fieldId.includes('cost') ||
    fieldId.includes('revenue') || fieldId.includes('sales')
  ) {
    const num = Number(value);
    if (!isNaN(num)) return formatCurrency(num);
  }
  if (fieldId.includes('_at') || fieldId.includes('date')) {
    try {
      const d = new Date(String(value));
      if (!isNaN(d.getTime())) return d.toLocaleDateString();
    } catch { /* fallthrough */ }
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

// --- Component ---

export default function ReportBuilderPage() {
  const navigate = useNavigate();
  const { tenant, admin } = useTenantAdminAuth();
  const tenantSlug = tenant?.slug;
  const { hasPermission, isLoading: permLoading } = usePermissions();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<BuilderStep>('sources');
  const [form, setForm] = useState<ReportFormState>(INITIAL_FORM);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);

  // Data sources
  const { data: dataSources, isLoading: dsLoading } = useReportDataSources();
  const { fields, metrics, dimensions } = useDataSourceFields(form.data_sources);

  // Saved reports count (for sidebar badge)
  const { data: savedReports } = useQuery({
    queryKey: queryKeys.reporting.custom(),
    queryFn: async () => {
      if (!tenant?.id) return [];
      try {
        const { data, error } = await (supabase as unknown as { from: (table: string) => { select: (cols: string) => { eq: (col: string, val: string) => { order: (col: string, opts: { ascending: boolean }) => Promise<{ data: unknown[]; error: unknown }> } } } })
          .from('custom_reports')
          .select('id,name,description,report_type,created_at')
          .eq('tenant_id', tenant.id)
          .order('created_at', { ascending: false });
        if (error) return [];
        return (data || []) as { id: string; name: string; description: string; report_type: string; created_at: string }[];
      } catch { return []; }
    },
    enabled: !!tenant?.id,
  });

  // Field labels for query results display
  const fieldLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    if (dataSources) {
      for (const ds of dataSources) {
        if (form.data_sources.includes(ds.name)) {
          for (const f of ds.available_fields) {
            labels[f.id] = f.label;
            labels[`${ds.name}.${f.id}`] = `${ds.display_name}: ${f.label}`;
          }
          for (const m of ds.available_metrics) {
            labels[m.id] = m.label;
            labels[`${ds.name}.${m.id}`] = `${ds.display_name}: ${m.label}`;
          }
        }
      }
    }
    return labels;
  }, [dataSources, form.data_sources]);

  // --- Mutations ---

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tenant?.id) throw new Error('Tenant ID required');
      if (!form.name.trim()) throw new Error('Report name is required');
      if (form.data_sources.length === 0) throw new Error('Select at least one data source');

      const { error } = await (supabase as unknown as { from: (table: string) => { insert: (data: unknown[]) => Promise<{ error: { code?: string; message: string } | null }> } })
        .from('custom_reports')
        .insert([{
          tenant_id: tenant.id,
          name: form.name.trim(),
          description: form.description.trim() || null,
          data_sources: form.data_sources,
          metrics: form.metrics,
          dimensions: form.dimensions,
          filters: JSON.stringify({
            conditions: form.filters,
            date_range: {
              preset: form.date_range_preset,
              start_date: form.custom_start_date || null,
              end_date: form.custom_end_date || null,
            },
            selected_fields: form.selected_fields,
          }),
          visualization_type: form.visualization_type,
          format: form.format,
          schedule: form.schedule === 'none' ? null : form.schedule,
          created_by: admin?.id || null,
          report_type: form.data_sources[0] || 'custom',
        }]);

      if (error && error.code !== '42P01') throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reporting.custom() });
      toast.success('Report saved successfully');
    },
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : 'Failed to save report';
      logger.error('Failed to save report', error, { component: 'ReportBuilderPage' });
      toast.error(msg);
    },
  });

  const previewMutation = useMutation({
    mutationFn: async (): Promise<QueryResult> => {
      if (!tenant?.id) throw new Error('Tenant ID required');
      const startTime = performance.now();
      const dateRange = getDateRange(form.date_range_preset, form.custom_start_date, form.custom_end_date);
      const allResults: Record<string, unknown>[] = [];
      const calculatedMetrics: Record<string, number> = {};

      for (const sourceName of form.data_sources) {
        const source = dataSources?.find((ds) => ds.name === sourceName);
        if (!source?.source_table) continue;

        let query = (supabase as unknown as Record<string, unknown> & { from: (t: string) => Record<string, Function> })
          .from(source.source_table)
          .select('*') as unknown as Record<string, Function>;

        if (source.requires_tenant_filter) {
          query = query.eq('tenant_id', tenant.id) as unknown as Record<string, Function>;
        }
        query = query.gte('created_at', dateRange.start) as unknown as Record<string, Function>;
        query = query.lte('created_at', dateRange.end + 'T23:59:59') as unknown as Record<string, Function>;

        for (const filter of form.filters) {
          const fieldName = filter.field.includes('.') ? filter.field.split('.')[1] : filter.field;
          switch (filter.operator) {
            case 'equals': query = query.eq(fieldName, filter.value) as unknown as Record<string, Function>; break;
            case 'not_equals': query = query.neq(fieldName, filter.value) as unknown as Record<string, Function>; break;
            case 'contains': query = query.ilike(fieldName, `%${filter.value}%`) as unknown as Record<string, Function>; break;
            case 'greater_than': query = query.gt(fieldName, filter.value) as unknown as Record<string, Function>; break;
            case 'less_than': query = query.lt(fieldName, filter.value) as unknown as Record<string, Function>; break;
            case 'greater_or_equal': query = query.gte(fieldName, filter.value) as unknown as Record<string, Function>; break;
            case 'less_or_equal': query = query.lte(fieldName, filter.value) as unknown as Record<string, Function>; break;
            case 'is_null': query = query.is(fieldName, null) as unknown as Record<string, Function>; break;
            case 'is_not_null': query = query.not(fieldName, 'is', null) as unknown as Record<string, Function>; break;
          }
        }

        const { data: sourceData, error } = await (query as unknown as { limit: (n: number) => Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }> }).limit(1000);
        if (error) {
          logger.error(`Error querying ${sourceName}`, error, { component: 'ReportBuilderPage' });
          continue;
        }
        if (sourceData) {
          for (const metricId of form.metrics) {
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
                    calculatedMetrics[metric.id] = (calculatedMetrics[metric.id] || 0) +
                      sourceData.reduce((acc, row) => acc + (Number(row[metric.field as string]) || 0), 0);
                  }
                  break;
                case 'avg':
                  if (metric.field && sourceData.length > 0) {
                    calculatedMetrics[metric.id] =
                      sourceData.reduce((acc, row) => acc + (Number(row[metric.field as string]) || 0), 0) / sourceData.length;
                  }
                  break;
              }
            }
          }
          allResults.push(...sourceData);
        }
      }

      return {
        data: allResults,
        metrics: calculatedMetrics,
        rowCount: allResults.length,
        executionTime: Math.round(performance.now() - startTime),
      };
    },
    onSuccess: (result) => {
      setQueryResult(result);
      toast.success(`Query complete: ${result.rowCount} rows in ${result.executionTime}ms`);
    },
    onError: (error: unknown) => {
      logger.error('Preview query failed', error, { component: 'ReportBuilderPage' });
      toast.error('Failed to execute query');
    },
  });

  // --- Handlers ---

  const updateForm = useCallback((updates: Partial<ReportFormState>) => {
    setForm((prev) => ({ ...prev, ...updates }));
  }, []);

  const toggleDataSource = useCallback((sourceName: string) => {
    setForm((prev) => {
      const isSelected = prev.data_sources.includes(sourceName);
      return {
        ...prev,
        data_sources: isSelected
          ? prev.data_sources.filter((s) => s !== sourceName)
          : [...prev.data_sources, sourceName],
        selected_fields: [],
        metrics: [],
        dimensions: [],
        filters: [],
      };
    });
    setQueryResult(null);
  }, []);

  const toggleField = useCallback((id: string) => {
    setForm((prev) => ({
      ...prev,
      selected_fields: prev.selected_fields.includes(id)
        ? prev.selected_fields.filter((f) => f !== id)
        : [...prev.selected_fields, id],
    }));
  }, []);

  const toggleMetric = useCallback((id: string) => {
    setForm((prev) => ({
      ...prev,
      metrics: prev.metrics.includes(id)
        ? prev.metrics.filter((m) => m !== id)
        : [...prev.metrics, id],
    }));
  }, []);

  const toggleDimension = useCallback((id: string) => {
    setForm((prev) => ({
      ...prev,
      dimensions: prev.dimensions.includes(id)
        ? prev.dimensions.filter((d) => d !== id)
        : [...prev.dimensions, id],
    }));
  }, []);

  const addFilter = useCallback(() => {
    if (fields.length === 0) return;
    const firstField = fields[0];
    const defaultOp = getOperatorsForFieldType(firstField.type)[0]?.value || 'equals';
    setForm((prev) => ({
      ...prev,
      filters: [...prev.filters, {
        field: firstField.id,
        operator: defaultOp,
        value: '',
        data_source: prev.data_sources[0] || '',
      }],
    }));
  }, [fields]);

  const updateFilter = useCallback((index: number, updates: Partial<ReportFilter>) => {
    setForm((prev) => ({
      ...prev,
      filters: prev.filters.map((f, i) => (i === index ? { ...f, ...updates } : f)),
    }));
  }, []);

  const removeFilter = useCallback((index: number) => {
    setForm((prev) => ({
      ...prev,
      filters: prev.filters.filter((_, i) => i !== index),
    }));
  }, []);

  const exportCsv = useCallback(() => {
    if (!queryResult?.data?.length) {
      toast.error('No data to export');
      return;
    }
    const exportFields = form.selected_fields.length > 0 ? form.selected_fields : Object.keys(queryResult.data[0]);
    const headers = exportFields.map((f) => fieldLabels[f] || f);
    const csvContent = [
      headers.join(','),
      ...queryResult.data.map((row) =>
        exportFields.map((field) => {
          const name = field.includes('.') ? field.split('.')[1] : field;
          const formatted = formatCellValue(row[name], field);
          return formatted.includes(',') || formatted.includes('"')
            ? `"${formatted.replace(/"/g, '""')}"`
            : formatted;
        }).join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${form.name || 'report'}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    toast.success('Report exported as CSV');
  }, [queryResult, form.selected_fields, form.name, fieldLabels]);

  const stepIndex = STEPS.findIndex((s) => s.key === step);
  const canNext = step === 'sources' ? form.data_sources.length > 0 : true;

  const goNext = () => {
    const idx = STEPS.findIndex((s) => s.key === step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1].key);
  };
  const goBack = () => {
    const idx = STEPS.findIndex((s) => s.key === step);
    if (idx > 0) setStep(STEPS[idx - 1].key);
  };

  // --- Permission check ---
  if (permLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!hasPermission('view_reports') && !hasPermission('view_analytics')) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            You do not have permission to access the report builder.
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Render ---
  return (
    <div className="space-y-4 sm:space-y-6 p-2 sm:p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/${tenantSlug}/admin/advanced-reporting`)}
            className="mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Reports
          </Button>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Database className="h-6 w-6" />
            Custom Report Builder
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Select data sources, choose metrics, apply filters, preview and save your report
          </p>
        </div>
        <div className="flex gap-2">
          {queryResult && queryResult.data.length > 0 && (
            <Button
              variant="outline"
              onClick={exportCsv}
              className="min-h-[44px] touch-manipulation"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          )}
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !form.name.trim() || form.data_sources.length === 0}
            className="min-h-[44px] touch-manipulation"
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Report
          </Button>
        </div>
      </div>

      {/* Step Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {STEPS.map((s, idx) => (
          <button
            key={s.key}
            onClick={() => {
              if (s.key === 'sources' || form.data_sources.length > 0) setStep(s.key);
            }}
            disabled={s.key !== 'sources' && form.data_sources.length === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors whitespace-nowrap min-h-[44px] touch-manipulation ${
              step === s.key
                ? 'border-primary bg-primary/10 text-primary'
                : idx < stepIndex
                  ? 'border-muted-foreground/20 bg-muted/50 text-foreground'
                  : 'border-muted text-muted-foreground hover:bg-muted/50'
            } ${s.key !== 'sources' && form.data_sources.length === 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {s.icon}
            {s.label}
            {s.key === 'sources' && form.data_sources.length > 0 && (
              <Badge variant="secondary" className="ml-1">{form.data_sources.length}</Badge>
            )}
            {s.key === 'fields' && (form.selected_fields.length + form.metrics.length) > 0 && (
              <Badge variant="secondary" className="ml-1">{form.selected_fields.length + form.metrics.length}</Badge>
            )}
            {s.key === 'filters' && form.filters.length > 0 && (
              <Badge variant="secondary" className="ml-1">{form.filters.length}</Badge>
            )}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Main Panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Step: Data Sources */}
          {step === 'sources' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Select Data Sources
                </CardTitle>
                <CardDescription>
                  Choose which data to include in your report. Select multiple sources to create cross-module reports.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {dsLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={i} className="h-20 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {dataSources?.map((source) => (
                      <div
                        key={source.name}
                        className={`flex items-start space-x-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                          form.data_sources.includes(source.name)
                            ? 'border-primary bg-primary/5'
                            : 'hover:bg-muted/50'
                        }`}
                        onClick={() => toggleDataSource(source.name)}
                      >
                        <Checkbox
                          checked={form.data_sources.includes(source.name)}
                          onCheckedChange={() => toggleDataSource(source.name)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{source.display_name}</p>
                          <p className="text-xs text-muted-foreground">{source.description}</p>
                          <div className="flex gap-1 mt-1 flex-wrap">
                            <Badge variant="outline" className="text-xs">
                              {source.available_fields.length} fields
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {source.available_metrics.length} metrics
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step: Fields & Metrics */}
          {step === 'fields' && (
            <div className="space-y-4">
              {/* Fields */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Report Fields</CardTitle>
                  <CardDescription>
                    Select fields to include as columns in your report output.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-56 overflow-y-auto p-1">
                    {fields.map((field) => (
                      <div key={field.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`field-${field.id}`}
                          checked={form.selected_fields.includes(field.id)}
                          onCheckedChange={() => toggleField(field.id)}
                        />
                        <label htmlFor={`field-${field.id}`} className="text-sm cursor-pointer truncate">
                          {field.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Calculated Metrics</CardTitle>
                  <CardDescription>
                    Aggregate calculations (sum, count, average) applied to your data.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {metrics.map((metric) => (
                      <div
                        key={metric.id}
                        className={`flex items-center space-x-2 p-2 border rounded cursor-pointer transition-colors ${
                          form.metrics.includes(metric.id)
                            ? 'border-primary bg-primary/5'
                            : 'hover:bg-muted/50'
                        }`}
                        onClick={() => toggleMetric(metric.id)}
                      >
                        <Checkbox
                          checked={form.metrics.includes(metric.id)}
                          onCheckedChange={() => toggleMetric(metric.id)}
                        />
                        <span className="text-sm">{metric.label}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Dimensions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Group By (Dimensions)</CardTitle>
                  <CardDescription>
                    Choose how to group your data for analysis.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {dimensions.map((dim) => (
                      <div
                        key={dim.id}
                        className={`flex items-center space-x-2 p-2 border rounded cursor-pointer transition-colors ${
                          form.dimensions.includes(dim.id)
                            ? 'border-primary bg-primary/5'
                            : 'hover:bg-muted/50'
                        }`}
                        onClick={() => toggleDimension(dim.id)}
                      >
                        <Checkbox
                          checked={form.dimensions.includes(dim.id)}
                          onCheckedChange={() => toggleDimension(dim.id)}
                        />
                        <span className="text-sm">{dim.label}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step: Filters */}
          {step === 'filters' && (
            <div className="space-y-4">
              {/* Date Range */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Date Range</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Select
                      value={form.date_range_preset}
                      onValueChange={(v: DateRangePreset) => updateForm({ date_range_preset: v })}
                    >
                      <SelectTrigger className="min-h-[44px] touch-manipulation">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DATE_RANGE_PRESETS.map((p) => (
                          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.date_range_preset === 'custom' && (
                      <>
                        <Input
                          type="date"
                          value={form.custom_start_date}
                          onChange={(e) => updateForm({ custom_start_date: e.target.value })}
                          className="min-h-[44px] touch-manipulation"
                        />
                        <Input
                          type="date"
                          value={form.custom_end_date}
                          onChange={(e) => updateForm({ custom_end_date: e.target.value })}
                          className="min-h-[44px] touch-manipulation"
                        />
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Custom Filters */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Custom Filters</CardTitle>
                      <CardDescription>Narrow down your data with specific conditions.</CardDescription>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addFilter}
                      disabled={fields.length === 0}
                      className="min-h-[44px] touch-manipulation"
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add Filter
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {form.filters.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No filters added. Click &quot;Add Filter&quot; to narrow down your data.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {form.filters.map((filter, index) => {
                        const selectedField = fields.find((f) => f.id === filter.field);
                        const availableOps = selectedField
                          ? getOperatorsForFieldType(selectedField.type)
                          : FILTER_OPERATORS.slice(0, 2).map(({ value, label }) => ({ value, label }));

                        return (
                          <div key={index} className="flex items-center gap-2 p-2 border rounded-lg flex-wrap sm:flex-nowrap">
                            <Select
                              value={filter.field}
                              onValueChange={(v) => updateFilter(index, { field: v })}
                            >
                              <SelectTrigger className="w-full sm:w-[180px] min-h-[36px]">
                                <SelectValue placeholder="Field" />
                              </SelectTrigger>
                              <SelectContent>
                                {fields.map((f) => (
                                  <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select
                              value={filter.operator}
                              onValueChange={(v: FilterOperator) => updateFilter(index, { operator: v })}
                            >
                              <SelectTrigger className="w-full sm:w-[140px] min-h-[36px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {availableOps.map((op) => (
                                  <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {filter.operator !== 'is_null' && filter.operator !== 'is_not_null' && (
                              <Input
                                value={String(filter.value || '')}
                                onChange={(e) => updateFilter(index, { value: e.target.value })}
                                placeholder="Value"
                                className="flex-1 min-h-[36px]"
                              />
                            )}
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeFilter(index)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Visualization */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Visualization Type</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {VISUALIZATION_TYPES.map((viz) => (
                      <div
                        key={viz.value}
                        className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors min-h-[44px] ${
                          form.visualization_type === viz.value
                            ? 'border-primary bg-primary/5'
                            : 'hover:bg-muted/50'
                        }`}
                        onClick={() => updateForm({ visualization_type: viz.value })}
                      >
                        {VISUALIZATION_ICONS[viz.value]}
                        <span className="text-sm">{viz.label}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step: Preview & Save */}
          {step === 'preview' && (
            <div className="space-y-4">
              {/* Run Query */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Play className="h-5 w-5" /> Query Preview
                      </CardTitle>
                      <CardDescription>Run your report configuration to preview results.</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => previewMutation.mutate()}
                        disabled={previewMutation.isPending || form.data_sources.length === 0}
                        className="min-h-[44px] touch-manipulation"
                      >
                        {previewMutation.isPending
                          ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          : <Play className="h-4 w-4 mr-2" />}
                        Run Query
                      </Button>
                      {queryResult && queryResult.data.length > 0 && (
                        <Button variant="outline" onClick={exportCsv} className="min-h-[44px] touch-manipulation">
                          <Download className="h-4 w-4 mr-2" /> Export CSV
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {previewMutation.isPending ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      <span className="ml-3 text-muted-foreground">Executing query...</span>
                    </div>
                  ) : !queryResult ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Click &quot;Run Query&quot; to preview your report data.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Stats */}
                      <div className="flex items-center gap-3 flex-wrap text-sm">
                        <Badge variant="outline" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" /> {queryResult.rowCount} rows
                        </Badge>
                        <Badge variant="outline">{queryResult.executionTime}ms</Badge>
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
                                {(form.selected_fields.length > 0
                                  ? form.selected_fields
                                  : Object.keys(queryResult.data[0])
                                ).map((field) => {
                                  const name = field.includes('.') ? field.split('.')[1] : field;
                                  return (
                                    <TableHead key={field} className="whitespace-nowrap">
                                      {fieldLabels[field] || name}
                                    </TableHead>
                                  );
                                })}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {queryResult.data.slice(0, 100).map((row, idx) => (
                                <TableRow key={idx}>
                                  {(form.selected_fields.length > 0
                                    ? form.selected_fields
                                    : Object.keys(row)
                                  ).map((field) => {
                                    const name = field.includes('.') ? field.split('.')[1] : field;
                                    return (
                                      <TableCell key={field} className="whitespace-nowrap">
                                        {formatCellValue(row[name], field)}
                                      </TableCell>
                                    );
                                  })}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                          {queryResult.data.length > 100 && (
                            <div className="p-2 text-center text-sm text-muted-foreground border-t">
                              Showing first 100 of {queryResult.rowCount} rows
                            </div>
                          )}
                        </ScrollArea>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No data found for the selected criteria.</p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step Navigation Buttons */}
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={goBack}
              disabled={stepIndex === 0}
              className="min-h-[44px] touch-manipulation"
            >
              <ArrowLeft className="h-4 w-4 mr-2" /> Previous
            </Button>
            {stepIndex < STEPS.length - 1 ? (
              <Button
                onClick={goNext}
                disabled={!canNext}
                className="min-h-[44px] touch-manipulation"
              >
                Next <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !form.name.trim() || form.data_sources.length === 0}
                className="min-h-[44px] touch-manipulation"
              >
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Report
              </Button>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Report Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Report Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="report-name">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="report-name"
                  value={form.name}
                  onChange={(e) => updateForm({ name: e.target.value })}
                  placeholder="e.g., Monthly Sales Summary"
                  className="min-h-[44px] touch-manipulation"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="report-desc">Description</Label>
                <Textarea
                  id="report-desc"
                  value={form.description}
                  onChange={(e) => updateForm({ description: e.target.value })}
                  placeholder="Brief description of what this report shows"
                  rows={3}
                  className="min-h-[44px] touch-manipulation"
                />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Export Format</Label>
                <Select value={form.format} onValueChange={(v) => updateForm({ format: v })}>
                  <SelectTrigger className="min-h-[44px] touch-manipulation">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">CSV</SelectItem>
                    <SelectItem value="json">JSON</SelectItem>
                    <SelectItem value="excel">Excel</SelectItem>
                    <SelectItem value="pdf">PDF</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Schedule Delivery</Label>
                <Select value={form.schedule} onValueChange={(v) => updateForm({ schedule: v })}>
                  <SelectTrigger className="min-h-[44px] touch-manipulation">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCHEDULE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.schedule !== 'none' && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Report will be generated and emailed {form.schedule}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Configuration Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Configuration Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Data Sources</span>
                <Badge variant={form.data_sources.length > 0 ? 'default' : 'outline'}>
                  {form.data_sources.length}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fields</span>
                <Badge variant={form.selected_fields.length > 0 ? 'default' : 'outline'}>
                  {form.selected_fields.length}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Metrics</span>
                <Badge variant={form.metrics.length > 0 ? 'default' : 'outline'}>
                  {form.metrics.length}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Dimensions</span>
                <Badge variant={form.dimensions.length > 0 ? 'default' : 'outline'}>
                  {form.dimensions.length}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Filters</span>
                <Badge variant={form.filters.length > 0 ? 'default' : 'outline'}>
                  {form.filters.length}
                </Badge>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Visualization</span>
                <Badge variant="outline" className="capitalize gap-1">
                  {VISUALIZATION_ICONS[form.visualization_type]}
                  {form.visualization_type.replace('_', ' ')}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date Range</span>
                <Badge variant="outline" className="capitalize">
                  {DATE_RANGE_PRESETS.find((p) => p.value === form.date_range_preset)?.label || form.date_range_preset}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Saved Reports */}
          {savedReports && savedReports.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Recent Reports
                  <Badge variant="secondary">{savedReports.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="max-h-48">
                  <div className="divide-y">
                    {savedReports.slice(0, 5).map((report) => (
                      <div key={report.id} className="px-4 py-2 text-sm hover:bg-muted/50">
                        <div className="font-medium truncate">{report.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(report.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
