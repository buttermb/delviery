import { Button } from '@/components/ui/button';
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import XCircle from "lucide-react/dist/esm/icons/x-circle";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import RotateCcw from "lucide-react/dist/esm/icons/rotate-ccw";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right";
import Download from "lucide-react/dist/esm/icons/download";
import type { ImportResult } from '@/types/migration';
import { useNavigate } from 'react-router-dom';

interface CompleteStepProps {
  result: ImportResult;
  onReset: () => void;
}

export function CompleteStep({ result, onReset }: CompleteStepProps) {
  const navigate = useNavigate();
  
  const Icon = result.success ? CheckCircle2 : result.failedImports > 0 ? AlertTriangle : XCircle;
  const iconColor = result.success 
    ? 'text-emerald-500' 
    : result.failedImports > 0 
      ? 'text-yellow-500' 
      : 'text-destructive';
  
  const title = result.success 
    ? 'Import Complete!' 
    : result.failedImports > 0 
      ? 'Import Completed with Issues' 
      : 'Import Failed';

  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-8">
      {/* Success/Error Icon */}
      <div className={`p-6 rounded-full ${
        result.success 
          ? 'bg-emerald-500/20' 
          : result.failedImports > 0 
            ? 'bg-yellow-500/20' 
            : 'bg-destructive/20'
      }`}>
        <Icon className={`h-16 w-16 ${iconColor}`} />
      </div>

      {/* Title */}
      <div className="text-center space-y-2">
        <h3 className="text-2xl font-semibold">{title}</h3>
        <p className="text-muted-foreground">
          {result.successfulImports} of {result.totalProcessed} products imported successfully
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full max-w-2xl">
        <StatCard 
          label="Total Processed" 
          value={result.totalProcessed} 
          icon={<Download className="h-4 w-4" />}
        />
        <StatCard 
          label="Successful" 
          value={result.successfulImports} 
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          highlight="success"
        />
        <StatCard 
          label="Failed" 
          value={result.failedImports}
          icon={<XCircle className="h-4 w-4 text-destructive" />}
          highlight={result.failedImports > 0 ? 'error' : undefined}
        />
        <StatCard 
          label="Duplicates Skipped" 
          value={result.skippedDuplicates}
          icon={<AlertTriangle className="h-4 w-4 text-yellow-500" />}
        />
      </div>

      {/* Errors List */}
      {result.errors && result.errors.length > 0 && (
        <div className="w-full max-w-2xl border rounded-lg overflow-hidden">
          <div className="bg-destructive/10 px-4 py-2 border-b">
            <span className="text-sm font-medium text-destructive">
              {result.errors.length} Import Error{result.errors.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {result.errors.slice(0, 10).map((error, index) => (
              <div key={index} className="px-4 py-2 border-b last:border-0 text-sm">
                <span className="text-muted-foreground">Row {error.row}:</span>{' '}
                <span className="text-destructive">{error.message}</span>
              </div>
            ))}
            {result.errors.length > 10 && (
              <div className="px-4 py-2 text-sm text-muted-foreground">
                ... and {result.errors.length - 10} more errors
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Button variant="outline" onClick={onReset} className="gap-2">
          <RotateCcw className="h-4 w-4" />
          Import More
        </Button>
        <Button 
          onClick={() => navigate('../inventory')} 
          className="gap-2"
        >
          View Inventory
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  highlight?: 'success' | 'error';
}

function StatCard({ label, value, icon, highlight }: StatCardProps) {
  return (
    <div className={`p-4 rounded-lg border ${
      highlight === 'success' 
        ? 'border-emerald-500/50 bg-emerald-500/5' 
        : highlight === 'error' 
          ? 'border-destructive/50 bg-destructive/5' 
          : 'bg-muted/50'
    }`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${
        highlight === 'success' 
          ? 'text-emerald-500' 
          : highlight === 'error' && value > 0
            ? 'text-destructive' 
            : ''
      }`}>
        {value}
      </p>
    </div>
  );
}

