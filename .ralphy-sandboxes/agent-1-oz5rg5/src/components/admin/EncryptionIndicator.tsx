// src/components/admin/EncryptionIndicator.tsx
// Global encryption status indicator

import { useEncryption } from '@/lib/hooks/useEncryption';
import { Badge } from '@/components/ui/badge';
import { Lock, AlertCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface EncryptionIndicatorProps {
  showLabel?: boolean;
  className?: string;
}

export function EncryptionIndicator({ showLabel = false, className = '' }: EncryptionIndicatorProps) {
  const { isReady } = useEncryption();

  if (!showLabel) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`inline-flex items-center ${className}`}>
              {isReady ? (
                <Lock className="w-4 h-4 text-success" />
              ) : (
                <AlertCircle className="w-4 h-4 text-warning" />
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{isReady ? 'Encryption Active' : 'Encryption Not Ready'}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Badge variant={isReady ? 'default' : 'outline'} className={className}>
      {isReady ? (
        <>
          <Lock className="w-3 h-3 mr-1" />
          Encrypted
        </>
      ) : (
        <>
          <AlertCircle className="w-3 h-3 mr-1" />
          Not Encrypted
        </>
      )}
    </Badge>
  );
}

