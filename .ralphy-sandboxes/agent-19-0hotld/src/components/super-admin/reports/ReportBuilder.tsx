/**
 * Custom Report Builder
 * Drag-and-drop report designer
 * Inspired by Metabase and Tableau
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { FileText, Save, Play, Download } from 'lucide-react';
import { toast } from 'sonner';

interface ReportConfig {
  name: string;
  description: string;
  metrics: string[];
  dimensions: string[];
  filters: Record<string, unknown>;
  chartType: 'line' | 'bar' | 'pie' | 'table';
  dateRange: string;
}

export function ReportBuilder() {
  const [config, setConfig] = useState<ReportConfig>({
    name: '',
    description: '',
    metrics: [],
    dimensions: [],
    filters: {},
    chartType: 'line',
    dateRange: '30d',
  });

  const availableMetrics = [
    'Revenue',
    'MRR',
    'ARR',
    'New Customers',
    'Churned Customers',
    'Active Tenants',
    'Orders',
    'Average Order Value',
  ];

  const availableDimensions = [
    'Date',
    'Tenant',
    'Plan',
    'Status',
    'Region',
    'Source',
  ];

  const handleSave = () => {
    if (!config.name) {
      toast.error('Error', {
        description: 'Please enter a report name',
      });
      return;
    }

    toast.success('Report Saved', {
      description: 'Report configuration has been saved',
    });
  };

  const handleRun = () => {
    toast.info('Running Report', {
      description: 'Generating report...',
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Custom Report Builder
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Basic Info */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="report-name">Report Name</Label>
            <Input
              id="report-name"
              value={config.name}
              onChange={(e) => setConfig({ ...config, name: e.target.value })}
              placeholder="Monthly Revenue Report"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="report-description">Description</Label>
            <Textarea
              id="report-description"
              value={config.description}
              onChange={(e) => setConfig({ ...config, description: e.target.value })}
              placeholder="Description of what this report shows..."
            />
          </div>
        </div>

        {/* Metrics */}
        <div className="space-y-2">
          <Label>Metrics to Include</Label>
          <div className="grid grid-cols-2 gap-2 p-4 border rounded-lg">
            {availableMetrics.map((metric) => (
              <div key={metric} className="flex items-center space-x-2">
                <Checkbox
                  id={`metric-${metric}`}
                  checked={config.metrics.includes(metric)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setConfig({ ...config, metrics: [...config.metrics, metric] });
                    } else {
                      setConfig({ ...config, metrics: config.metrics.filter(m => m !== metric) });
                    }
                  }}
                />
                <Label htmlFor={`metric-${metric}`} className="cursor-pointer">
                  {metric}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Dimensions */}
        <div className="space-y-2">
          <Label>Group By (Dimensions)</Label>
          <div className="grid grid-cols-2 gap-2 p-4 border rounded-lg">
            {availableDimensions.map((dimension) => (
              <div key={dimension} className="flex items-center space-x-2">
                <Checkbox
                  id={`dimension-${dimension}`}
                  checked={config.dimensions.includes(dimension)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setConfig({ ...config, dimensions: [...config.dimensions, dimension] });
                    } else {
                      setConfig({ ...config, dimensions: config.dimensions.filter(d => d !== dimension) });
                    }
                  }}
                />
                <Label htmlFor={`dimension-${dimension}`} className="cursor-pointer">
                  {dimension}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Chart Type */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Chart Type</Label>
            <Select
              value={config.chartType}
              onValueChange={(value) => setConfig({ ...config, chartType: value as ReportConfig['chartType'] })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select chart type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="line">Line Chart</SelectItem>
                <SelectItem value="bar">Bar Chart</SelectItem>
                <SelectItem value="pie">Pie Chart</SelectItem>
                <SelectItem value="table">Table</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Date Range</Label>
            <Select
              value={config.dateRange}
              onValueChange={(value) => setConfig({ ...config, dateRange: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select date range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
                <SelectItem value="90d">Last 90 Days</SelectItem>
                <SelectItem value="1y">Last Year</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Selected Items */}
        <div className="space-y-2">
          <Label>Selected Configuration</Label>
          <div className="p-4 border rounded-lg space-y-2">
            <div>
              <span className="text-sm font-medium">Metrics: </span>
              {config.metrics.length > 0 ? (
                config.metrics.map((m) => (
                  <Badge key={m} variant="outline" className="ml-1">{m}</Badge>
                ))
              ) : (
                <span className="text-muted-foreground text-sm">None selected</span>
              )}
            </div>
            <div>
              <span className="text-sm font-medium">Dimensions: </span>
              {config.dimensions.length > 0 ? (
                config.dimensions.map((d) => (
                  <Badge key={d} variant="outline" className="ml-1">{d}</Badge>
                ))
              ) : (
                <span className="text-muted-foreground text-sm">None selected</span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Save Report
          </Button>
          <Button variant="outline" onClick={handleRun}>
            <Play className="h-4 w-4 mr-2" />
            Run Report
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

