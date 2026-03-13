import { AlertCircle } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export interface ValidationError {
  field: string;
  message: string;
}

interface DataValidationErrorDisplayProps {
  errors: ValidationError[];
  title?: string;
}

export function DataValidationErrorDisplay({
  errors,
  title = 'Validation Errors',
}: DataValidationErrorDisplayProps) {
  if (errors.length === 0) {
    return null;
  }

  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <p className="text-sm mb-2">Please fix the following errors:</p>
        <ul className="list-disc list-inside space-y-1">
          {errors.map((error, index) => (
            <li key={`${error.field}-${index}`} className="text-sm">
              <span className="font-semibold">{error.field}:</span> {error.message}
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
