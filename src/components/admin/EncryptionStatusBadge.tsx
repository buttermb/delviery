// src/components/admin/EncryptionStatusBadge.tsx
// Component to display encryption status for records

import { Badge } from '@/components/ui/badge';
import Lock from "lucide-react/dist/esm/icons/lock";
import Unlock from "lucide-react/dist/esm/icons/unlock";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import { useEncryption } from '@/lib/hooks/useEncryption';
import { getEncryptionStatus } from '@/lib/utils/encryptionHelpers';
import type { ReactNode } from 'react';

interface EncryptionStatusBadgeProps {
  record: Record<string, unknown>;
  showIcon?: boolean;
  className?: string;
}

export function EncryptionStatusBadge({ 
  record, 
  showIcon = true,
  className = '' 
}: EncryptionStatusBadgeProps) {
  const { isReady } = useEncryption();
  const status = getEncryptionStatus(record);

  if (!isReady) {
    return (
      <Badge variant="outline" className={className}>
        {showIcon && <AlertCircle className="w-3 h-3 mr-1" />}
        Encryption Unavailable
      </Badge>
    );
  }

  if (status.isHybrid) {
    return (
      <Badge variant="secondary" className={className}>
        {showIcon && <Lock className="w-3 h-3 mr-1" />}
        Hybrid (Migrating)
      </Badge>
    );
  }

  if (status.isEncrypted) {
    return (
      <Badge variant="default" className={className}>
        {showIcon && <Lock className="w-3 h-3 mr-1" />}
        Encrypted
      </Badge>
    );
  }

  if (status.hasPlaintext) {
    return (
      <Badge variant="outline" className={className}>
        {showIcon && <Unlock className="w-3 h-3 mr-1" />}
        Plaintext
      </Badge>
    );
  }

  return null;
}

