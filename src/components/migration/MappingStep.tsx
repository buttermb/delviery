import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowRight,
  Check,
  X,
  Columns,
  RefreshCw,
} from 'lucide-react';
import type { ColumnMappingItem, TargetField } from '@/types/migration';

interface DetectedColumns {
  headers: string[];
  sampleData: Record<string, unknown>[];
  mappings: ColumnMappingItem[];
}

interface MappingStepProps {
  detectedColumns: DetectedColumns;
  onUpdateMappings: (mappings: ColumnMappingItem[]) => void;
  onConfirm: () => void;
}

const TARGET_FIELDS: { value: TargetField; label: string }[] = [
  { value: 'name', label: 'Product Name' },
  { value: 'category', label: 'Category' },
  { value: 'strainType', label: 'Strain Type' },
  { value: 'thcPercentage', label: 'THC %' },
  { value: 'cbdPercentage', label: 'CBD %' },
  { value: 'pricePound', label: 'Price per Pound' },
  { value: 'priceQp', label: 'Price per QP' },
  { value: 'priceOz', label: 'Price per Oz/Zip' },
  { value: 'priceUnit', label: 'Price per Unit' },
  { value: 'quantity', label: 'Quantity' },
  { value: 'quality', label: 'Quality Tier' },
  { value: 'lineage', label: 'Lineage/Genetics' },
  { value: 'notes', label: 'Notes' },
  { value: 'ignore', label: 'Ignore' },
];

export function MappingStep({ detectedColumns, onUpdateMappings, onConfirm }: MappingStepProps) {
  const [mappings, setMappings] = useState<ColumnMappingItem[]>(
    detectedColumns.mappings || []
  );

  const handleMappingChange = (header: string, targetField: TargetField, confidence: number) => {
    const newMappings = mappings.map(m => 
      m.sourceHeader === header 
        ? { ...m, targetField, confidence }
        : m
    );
    
    // If header wasn't in mappings, add it
    if (!mappings.find(m => m.sourceHeader === header)) {
      newMappings.push({ sourceHeader: header, targetField, confidence });
    }
    
    setMappings(newMappings);
    onUpdateMappings(newMappings);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-emerald-500';
    if (confidence >= 0.5) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getMappingForHeader = (header: string): ColumnMappingItem | undefined => {
    return mappings.find(m => m.sourceHeader === header);
  };

  const mappedFieldsCount = mappings.filter(m => m.targetField !== 'ignore').length;
  const totalFields = detectedColumns.headers.length;

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h3 className="text-lg font-semibold mb-2 flex items-center justify-center gap-2">
          <Columns className="h-5 w-5 text-emerald-500" />
          Map Your Columns
        </h3>
        <p className="text-sm text-muted-foreground">
          We detected {totalFields} columns. Review and adjust the mappings below.
        </p>
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-emerald-500/10">
            {mappedFieldsCount} mapped
          </Badge>
          <Badge variant="outline" className="bg-muted">
            {totalFields - mappedFieldsCount} ignored
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setMappings(detectedColumns.mappings || []);
            onUpdateMappings(detectedColumns.mappings || []);
          }}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Reset to Auto
        </Button>
      </div>

      {/* Column Mappings */}
      <div className="space-y-3">
        {detectedColumns.headers.map((header) => {
          const mapping = getMappingForHeader(header);
          const confidence = mapping?.confidence || 0;
          const targetField = mapping?.targetField || 'ignore';
          
          return (
            <div
              key={header}
              className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              {/* Source Column */}
              <div className="flex-1">
                <p className="font-medium text-sm">{header}</p>
                {detectedColumns.sampleData[0]?.[header] && (
                  <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                    e.g., {String(detectedColumns.sampleData[0][header])}
                  </p>
                )}
              </div>

              {/* Arrow */}
              <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />

              {/* Target Field Selector */}
              <div className="flex-1">
                <Select
                  value={targetField}
                  onValueChange={(value) => 
                    handleMappingChange(header, value as TargetField, 1.0)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select field" />
                  </SelectTrigger>
                  <SelectContent>
                    {TARGET_FIELDS.map((field) => (
                      <SelectItem key={field.value} value={field.value}>
                        {field.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Confidence indicator */}
              <div className="flex items-center gap-2 w-24">
                {targetField !== 'ignore' && (
                  <>
                    <div 
                      className={`h-2 w-2 rounded-full ${getConfidenceColor(confidence)}`}
                    />
                    <span className="text-xs text-muted-foreground">
                      {Math.round(confidence * 100)}%
                    </span>
                  </>
                )}
                {targetField === 'ignore' && (
                  <X className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Sample Data Preview */}
      {detectedColumns.sampleData.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-muted/50 px-4 py-2 border-b">
            <span className="text-sm font-medium">Sample Data Preview</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr>
                  {detectedColumns.headers.map((header) => (
                    <th key={header} className="px-4 py-2 text-left font-medium">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {detectedColumns.sampleData.slice(0, 3).map((row, i) => (
                  <tr key={i} className="border-t">
                    {detectedColumns.headers.map((header) => (
                      <td key={header} className="px-4 py-2 truncate max-w-[200px]">
                        {String(row[header] || '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirm Button */}
      <div className="flex justify-end pt-4 border-t">
        <Button onClick={onConfirm} className="gap-2">
          <Check className="h-4 w-4" />
          Confirm Mappings & Parse
        </Button>
      </div>
    </div>
  );
}

