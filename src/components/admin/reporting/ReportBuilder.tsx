import { logger } from '@/lib/logger';
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import { humanizeError } from '@/lib/humanizeError';
import {
  Loader2,
  BarChart3,
  Database,
  Filter,
  LineChart,
  PieChart,
  Table2,
  LayoutGrid,
  TrendingUp,
  Plus,
  X,
} from "lucide-react";
import { queryKeys } from "@/lib/queryKeys";
import { useReportDataSources, useDataSourceFields } from "@/hooks/useReportDataSources";
import {
  DATE_RANGE_PRESETS,
  VISUALIZATION_TYPES,
  FILTER_OPERATORS,
  getOperatorsForFieldType,
  type DateRangePreset,
  type VisualizationType,
  type ReportFilter,
  type FilterOperator,
} from "@/lib/constants/reportDataSources";

interface ReportBuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface ReportFormData {
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

const VISUALIZATION_ICONS: Record<VisualizationType, React.ReactNode> = {
  table: <Table2 className="h-4 w-4" />,
  bar_chart: <BarChart3 className="h-4 w-4" />,
  line_chart: <LineChart className="h-4 w-4" />,
  pie_chart: <PieChart className="h-4 w-4" />,
  area_chart: <TrendingUp className="h-4 w-4" />,
  metric_cards: <LayoutGrid className="h-4 w-4" />,
};

const initialFormData: ReportFormData = {
  name: "",
  description: "",
  data_sources: [],
  selected_fields: [],
  metrics: [],
  dimensions: [],
  filters: [],
  date_range_preset: "this_month",
  custom_start_date: "",
  custom_end_date: "",
  visualization_type: "table",
  format: "csv",
  schedule: "",
};

export function ReportBuilder({
  open,
  onOpenChange,
  onSuccess,
}: ReportBuilderProps) {
  const { tenant, admin } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<ReportFormData>(initialFormData);
  const [activeStep, setActiveStep] = useState<string>("data-sources");

  // Fetch available data sources
  const { data: dataSources, isLoading: isLoadingDataSources } = useReportDataSources();

  // Get available fields based on selected data sources
  const { fields, metrics, dimensions } = useDataSourceFields(formData.data_sources);

  // Fields are already available from the useDataSourceFields hook
  // Group by source if needed in future for better organization

  const createMutation = useMutation({
    mutationFn: async (data: ReportFormData) => {
      if (!tenant?.id) throw new Error("Tenant ID required");

      const reportData = {
        tenant_id: tenant.id,
        name: data.name,
        description: data.description || null,
        data_sources: data.data_sources,
        metrics: data.metrics,
        dimensions: data.dimensions,
        filters: JSON.stringify({
          conditions: data.filters,
          date_range: {
            preset: data.date_range_preset,
            start_date: data.custom_start_date || null,
            end_date: data.custom_end_date || null,
          },
          selected_fields: data.selected_fields,
        }),
        visualization_type: data.visualization_type,
        format: data.format,
        schedule: data.schedule || null,
        created_by: admin?.id || null,
        report_type: data.data_sources[0] || 'custom',
      };

      const { error } = await supabase.from("custom_reports").insert([reportData]);

      if (error && error.code !== "42P01") throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reporting.custom() });
      toast.success("Report created successfully");
      setFormData(initialFormData);
      setActiveStep("data-sources");
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: unknown) => {
      logger.error('Failed to create report', error, { component: 'ReportBuilder' });
      toast.error("Failed to create report", { description: humanizeError(error) });
    },
  });

  const handleDataSourceToggle = (sourceName: string) => {
    setFormData((prev) => {
      const isSelected = prev.data_sources.includes(sourceName);
      const newSources = isSelected
        ? prev.data_sources.filter((s) => s !== sourceName)
        : [...prev.data_sources, sourceName];

      // Reset selected fields, metrics, dimensions when data sources change
      return {
        ...prev,
        data_sources: newSources,
        selected_fields: [],
        metrics: [],
        dimensions: [],
        filters: [],
      };
    });
  };

  const handleFieldToggle = (fieldId: string) => {
    setFormData((prev) => ({
      ...prev,
      selected_fields: prev.selected_fields.includes(fieldId)
        ? prev.selected_fields.filter((f) => f !== fieldId)
        : [...prev.selected_fields, fieldId],
    }));
  };

  const handleMetricToggle = (metricId: string) => {
    setFormData((prev) => ({
      ...prev,
      metrics: prev.metrics.includes(metricId)
        ? prev.metrics.filter((m) => m !== metricId)
        : [...prev.metrics, metricId],
    }));
  };

  const handleDimensionToggle = (dimensionId: string) => {
    setFormData((prev) => ({
      ...prev,
      dimensions: prev.dimensions.includes(dimensionId)
        ? prev.dimensions.filter((d) => d !== dimensionId)
        : [...prev.dimensions, dimensionId],
    }));
  };

  const addFilter = () => {
    if (fields.length === 0) return;
    const firstField = fields[0];
    const defaultOperator = getOperatorsForFieldType(firstField.type)[0]?.value || 'equals';

    setFormData((prev) => ({
      ...prev,
      filters: [
        ...prev.filters,
        {
          field: firstField.id,
          operator: defaultOperator,
          value: '',
          data_source: formData.data_sources[0] || '',
        },
      ],
    }));
  };

  const updateFilter = (index: number, updates: Partial<ReportFilter>) => {
    setFormData((prev) => ({
      ...prev,
      filters: prev.filters.map((f, i) => (i === index ? { ...f, ...updates } : f)),
    }));
  };

  const removeFilter = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      filters: prev.filters.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name) {
      toast.error("Please provide a report name");
      return;
    }

    if (formData.data_sources.length === 0) {
      toast.error("Please select at least one data source");
      return;
    }

    await createMutation.mutateAsync(formData);
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setActiveStep("data-sources");
  };

  if (!open) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Report Builder
          </CardTitle>
          <CardDescription>
            Connect to data sources and build custom report queries
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Click "New Report" to start building a custom report.</p>
            <p className="text-sm mt-2">
              Select data sources, choose fields, add filters, and customize visualizations.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Create Custom Report
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6 pb-4">
              {/* Basic Info */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">
                      Report Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="e.g., Monthly Sales Summary"
                      required
                      className="min-h-[44px] touch-manipulation"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="format">Export Format</Label>
                    <Select
                      value={formData.format}
                      onValueChange={(value) =>
                        setFormData({ ...formData, format: value })
                      }
                    >
                      <SelectTrigger className="min-h-[44px] touch-manipulation">
                        <SelectValue placeholder="Select format" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="csv">CSV</SelectItem>
                        <SelectItem value="json">JSON</SelectItem>
                        <SelectItem value="excel">Excel</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Brief description of what this report shows"
                    rows={2}
                    className="min-h-[44px] touch-manipulation"
                  />
                </div>
              </div>

              <Separator />

              {/* Accordion for different sections */}
              <Accordion
                type="single"
                collapsible
                value={activeStep}
                onValueChange={setActiveStep}
                className="w-full"
              >
                {/* Data Sources Section */}
                <AccordionItem value="data-sources">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      <span>Data Sources</span>
                      {formData.data_sources.length > 0 && (
                        <Badge variant="secondary" className="ml-2">
                          {formData.data_sources.length} selected
                        </Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3 pt-2">
                      <p className="text-sm text-muted-foreground">
                        Select the data sources for your report. You can combine multiple sources.
                      </p>
                      {isLoadingDataSources ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {dataSources?.map((source) => (
                            <div
                              key={source.name}
                              className={`flex items-start space-x-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                                formData.data_sources.includes(source.name)
                                  ? 'border-primary bg-primary/5'
                                  : 'hover:bg-muted/50'
                              }`}
                              onClick={() => handleDataSourceToggle(source.name)}
                            >
                              <Checkbox
                                checked={formData.data_sources.includes(source.name)}
                                onCheckedChange={() => handleDataSourceToggle(source.name)}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm">{source.display_name}</p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {source.description}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Fields & Metrics Section */}
                <AccordionItem value="fields" disabled={formData.data_sources.length === 0}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      <Table2 className="h-4 w-4" />
                      <span>Fields & Metrics</span>
                      {(formData.selected_fields.length > 0 || formData.metrics.length > 0) && (
                        <Badge variant="secondary" className="ml-2">
                          {formData.selected_fields.length + formData.metrics.length} selected
                        </Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-2">
                      {formData.data_sources.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Select at least one data source to see available fields.
                        </p>
                      ) : (
                        <>
                          {/* Fields */}
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Report Fields</Label>
                            <p className="text-xs text-muted-foreground">
                              Select the fields to include in your report output.
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-2 border rounded-lg">
                              {fields.map((field) => (
                                <div
                                  key={field.id}
                                  className="flex items-center space-x-2"
                                >
                                  <Checkbox
                                    id={`field-${field.id}`}
                                    checked={formData.selected_fields.includes(field.id)}
                                    onCheckedChange={() => handleFieldToggle(field.id)}
                                  />
                                  <label
                                    htmlFor={`field-${field.id}`}
                                    className="text-sm cursor-pointer truncate"
                                  >
                                    {field.label}
                                  </label>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Metrics */}
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Calculated Metrics</Label>
                            <p className="text-xs text-muted-foreground">
                              Select aggregate metrics to calculate (sum, count, average, etc.)
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                              {metrics.map((metric) => (
                                <div
                                  key={metric.id}
                                  className={`flex items-center space-x-2 p-2 border rounded cursor-pointer ${
                                    formData.metrics.includes(metric.id)
                                      ? 'border-primary bg-primary/5'
                                      : 'hover:bg-muted/50'
                                  }`}
                                  onClick={() => handleMetricToggle(metric.id)}
                                >
                                  <Checkbox
                                    checked={formData.metrics.includes(metric.id)}
                                    onCheckedChange={() => handleMetricToggle(metric.id)}
                                  />
                                  <span className="text-sm">{metric.label}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Dimensions (Group By) */}
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Group By (Dimensions)</Label>
                            <p className="text-xs text-muted-foreground">
                              Select how to group your data for analysis.
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                              {dimensions.map((dimension) => (
                                <div
                                  key={dimension.id}
                                  className={`flex items-center space-x-2 p-2 border rounded cursor-pointer ${
                                    formData.dimensions.includes(dimension.id)
                                      ? 'border-primary bg-primary/5'
                                      : 'hover:bg-muted/50'
                                  }`}
                                  onClick={() => handleDimensionToggle(dimension.id)}
                                >
                                  <Checkbox
                                    checked={formData.dimensions.includes(dimension.id)}
                                    onCheckedChange={() => handleDimensionToggle(dimension.id)}
                                  />
                                  <span className="text-sm">{dimension.label}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Filters Section */}
                <AccordionItem value="filters" disabled={formData.data_sources.length === 0}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4" />
                      <span>Filters & Date Range</span>
                      {formData.filters.length > 0 && (
                        <Badge variant="secondary" className="ml-2">
                          {formData.filters.length} filter{formData.filters.length > 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-2">
                      {/* Date Range */}
                      <div className="space-y-3">
                        <Label className="text-sm font-medium">Date Range</Label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          <Select
                            value={formData.date_range_preset}
                            onValueChange={(value: DateRangePreset) =>
                              setFormData({ ...formData, date_range_preset: value })
                            }
                          >
                            <SelectTrigger className="min-h-[44px] touch-manipulation">
                              <SelectValue placeholder="Select date range" />
                            </SelectTrigger>
                            <SelectContent>
                              {DATE_RANGE_PRESETS.map((preset) => (
                                <SelectItem key={preset.value} value={preset.value}>
                                  {preset.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {formData.date_range_preset === 'custom' && (
                            <>
                              <Input
                                type="date"
                                value={formData.custom_start_date}
                                onChange={(e) =>
                                  setFormData({ ...formData, custom_start_date: e.target.value })
                                }
                                className="min-h-[44px] touch-manipulation"
                                placeholder="Start Date"
                              />
                              <Input
                                type="date"
                                value={formData.custom_end_date}
                                onChange={(e) =>
                                  setFormData({ ...formData, custom_end_date: e.target.value })
                                }
                                className="min-h-[44px] touch-manipulation"
                                placeholder="End Date"
                              />
                            </>
                          )}
                        </div>
                      </div>

                      {/* Custom Filters */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">Custom Filters</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={addFilter}
                            disabled={fields.length === 0}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add Filter
                          </Button>
                        </div>
                        {formData.filters.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No filters added. Click "Add Filter" to narrow down your data.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {formData.filters.map((filter, index) => {
                              const selectedField = fields.find((f) => f.id === filter.field);
                              const availableOperators = selectedField
                                ? getOperatorsForFieldType(selectedField.type)
                                : FILTER_OPERATORS.slice(0, 2);

                              return (
                                <div
                                  key={index}
                                  className="flex items-center gap-2 p-2 border rounded-lg"
                                >
                                  <Select
                                    value={filter.field}
                                    onValueChange={(value) =>
                                      updateFilter(index, { field: value })
                                    }
                                  >
                                    <SelectTrigger className="w-[180px] min-h-[36px]">
                                      <SelectValue placeholder="Select field" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {fields.map((f) => (
                                        <SelectItem key={f.id} value={f.id}>
                                          {f.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Select
                                    value={filter.operator}
                                    onValueChange={(value: FilterOperator) =>
                                      updateFilter(index, { operator: value })
                                    }
                                  >
                                    <SelectTrigger className="w-[140px] min-h-[36px]">
                                      <SelectValue placeholder="Select operator" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {availableOperators.map((op) => (
                                        <SelectItem key={op.value} value={op.value}>
                                          {op.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  {filter.operator !== 'is_null' &&
                                    filter.operator !== 'is_not_null' && (
                                      <Input
                                        value={String(filter.value || '')}
                                        onChange={(e) =>
                                          updateFilter(index, { value: e.target.value })
                                        }
                                        placeholder="Value"
                                        className="flex-1 min-h-[36px]"
                                      />
                                    )}
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeFilter(index)}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Visualization Section */}
                <AccordionItem value="visualization">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      <span>Visualization</span>
                      <Badge variant="outline" className="ml-2 capitalize">
                        {formData.visualization_type.replace('_', ' ')}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3 pt-2">
                      <Label className="text-sm font-medium">Visualization Type</Label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {VISUALIZATION_TYPES.map((viz) => (
                          <div
                            key={viz.value}
                            className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                              formData.visualization_type === viz.value
                                ? 'border-primary bg-primary/5'
                                : 'hover:bg-muted/50'
                            }`}
                            onClick={() =>
                              setFormData({ ...formData, visualization_type: viz.value })
                            }
                          >
                            {VISUALIZATION_ICONS[viz.value]}
                            <span className="text-sm">{viz.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-4 border-t mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetForm();
                onOpenChange(false);
              }}
              disabled={createMutation.isPending}
              className="min-h-[44px] touch-manipulation"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || formData.data_sources.length === 0}
              className="min-h-[44px] touch-manipulation"
            >
              {createMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create Report
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
