import { AlertCircle } from 'lucide-react';

interface FormErrorMessageProps {
  message?: string;
}

export function FormErrorMessage({ message }: FormErrorMessageProps) {
  if (!message) return null;

  return (
    <div className="flex items-center gap-1 text-sm text-destructive mt-1 animate-in slide-in-from-top-1">
      <AlertCircle className="w-3 h-3" />
      <span>{message}</span>
    </div>
  );
}
