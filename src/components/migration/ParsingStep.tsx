import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Loader2, 
  Sparkles,
  FileSpreadsheet,
  FileText,
  Image,
  AlertTriangle,
} from 'lucide-react';
import type { InputFormat } from '@/types/migration';

interface ParsingStepProps {
  isLoading: boolean;
  format: InputFormat | null;
  fileName: string | null;
  onStartParsing: () => void;
}

export function ParsingStep({ isLoading, format, fileName, onStartParsing }: ParsingStepProps) {
  // Note: Removed auto-start to prevent edge function calls when not deployed
  // User must click to start parsing

  const getFormatIcon = () => {
    switch (format) {
      case 'excel':
      case 'csv':
        return <FileSpreadsheet className="h-12 w-12 text-emerald-500" />;
      case 'image':
      case 'pdf':
        return <Image className="h-12 w-12 text-blue-500" />;
      default:
        return <FileText className="h-12 w-12 text-gray-500" />;
    }
  };

  const getFormatLabel = () => {
    switch (format) {
      case 'excel':
        return 'Excel Spreadsheet';
      case 'csv':
        return 'CSV File';
      case 'image':
        return 'Image (OCR)';
      case 'pdf':
        return 'PDF Document';
      case 'text':
        return 'Text Input';
      default:
        return 'Unknown Format';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-8">
      {/* Animated parsing indicator */}
      <div className="relative">
        <div className="absolute inset-0 animate-ping rounded-full bg-emerald-500/20" />
        <div className="relative p-6 rounded-full bg-gradient-to-br from-emerald-500/20 to-teal-500/20">
          {isLoading ? (
            <Loader2 className="h-12 w-12 text-emerald-500 animate-spin" />
          ) : (
            getFormatIcon()
          )}
        </div>
      </div>

      {/* Status text */}
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold flex items-center justify-center gap-2">
          {isLoading ? (
            <>
              <Sparkles className="h-5 w-5 text-emerald-500 animate-pulse" />
              AI is analyzing your menu...
            </>
          ) : (
            'Ready to parse'
          )}
        </h3>
        
        {fileName && (
          <p className="text-sm text-muted-foreground">
            Processing: <span className="font-medium">{fileName}</span>
          </p>
        )}
        
        <p className="text-sm text-muted-foreground">
          Format detected: <span className="font-medium">{getFormatLabel()}</span>
        </p>
      </div>

      {/* Processing steps */}
      {isLoading && (
        <div className="w-full max-w-md space-y-4">
          <ProcessingStep 
            label="Detecting product patterns" 
            status="complete" 
          />
          <ProcessingStep 
            label="Extracting product details" 
            status="active" 
          />
          <ProcessingStep 
            label="Normalizing weights & prices" 
            status="pending" 
          />
          <ProcessingStep 
            label="Validating cannabis categories" 
            status="pending" 
          />
        </div>
      )}

      {/* Warning about AI parsing requirements */}
      {!isLoading && (format === 'text' || format === 'image' || format === 'pdf') && (
        <Alert variant="destructive" className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>AI Parsing Required</AlertTitle>
          <AlertDescription className="text-sm">
            This format requires AI parsing via Edge Functions. 
            For best results, use <strong>CSV or Excel files</strong> which can be parsed locally.
            <br /><br />
            Tip: Copy your data to a spreadsheet and save as CSV, or paste CSV-formatted text.
          </AlertDescription>
        </Alert>
      )}

      {/* Manual trigger button */}
      {!isLoading && (
        <Button onClick={onStartParsing} className="gap-2">
          <Sparkles className="h-4 w-4" />
          Try AI Parsing
        </Button>
      )}
    </div>
  );
}

interface ProcessingStepProps {
  label: string;
  status: 'pending' | 'active' | 'complete';
}

function ProcessingStep({ label, status }: ProcessingStepProps) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
      status === 'active' 
        ? 'bg-emerald-500/10 border border-emerald-500/20' 
        : status === 'complete'
          ? 'bg-muted/50'
          : 'opacity-50'
    }`}>
      {status === 'active' ? (
        <Loader2 className="h-4 w-4 text-emerald-500 animate-spin" />
      ) : status === 'complete' ? (
        <div className="h-4 w-4 rounded-full bg-emerald-500 flex items-center justify-center">
          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      ) : (
        <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
      )}
      <span className={`text-sm ${status === 'active' ? 'font-medium' : ''}`}>
        {label}
      </span>
    </div>
  );
}

