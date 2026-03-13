import { AlertCircle, RefreshCw, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export type FileUploadErrorType = 'too_large' | 'wrong_type' | 'network_fail' | 'unknown';

interface FileUploadError {
  type: FileUploadErrorType;
  fileName: string;
  message: string;
  maxSize?: number;
  allowedTypes?: string[];
}

interface FileUploadErrorHandlerProps {
  errors: FileUploadError[];
  onRetry?: (fileName: string) => void;
  onDismiss?: (fileName: string) => void;
}

function getErrorMessage(error: FileUploadError): string {
  switch (error.type) {
    case 'too_large':
      return `File is too large. Maximum size is ${formatBytes(error.maxSize ?? 0)}.`;
    case 'wrong_type':
      return `Invalid file type. Allowed types: ${error.allowedTypes?.join(', ') ?? 'unknown'}.`;
    case 'network_fail':
      return 'Upload failed due to network error. Please check your connection and try again.';
    default:
      return error.message || 'An unknown error occurred during upload.';
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function FileUploadErrorHandler({ errors, onRetry, onDismiss }: FileUploadErrorHandlerProps) {
  if (errors.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {errors.map((error, index) => (
        <Alert key={`${error.fileName}-${index}`} variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="flex items-center justify-between">
            <span>{error.fileName}</span>
            {onDismiss && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDismiss(error.fileName)}
                className="h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </AlertTitle>
          <AlertDescription className="space-y-2">
            <p className="text-sm">{getErrorMessage(error)}</p>
            {onRetry && error.type === 'network_fail' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onRetry(error.fileName)}
                className="gap-2 mt-2"
              >
                <RefreshCw className="h-3 w-3" />
                Retry Upload
              </Button>
            )}
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
