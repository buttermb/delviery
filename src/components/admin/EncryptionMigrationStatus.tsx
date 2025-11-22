import { logger } from '@/lib/logger';
// src/components/admin/EncryptionMigrationStatus.tsx
// Component to display encryption migration status

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { getOverallMigrationProgress, type MigrationStatus } from '@/lib/utils/migrationStatus';
import { Loader2, Lock, Unlock, CheckCircle2, Clock } from 'lucide-react';

export function EncryptionMigrationStatus() {
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<{
    totalRecords: number;
    encryptedRecords: number;
    plaintextRecords: number;
    percentageEncrypted: number;
    tablesStatus: MigrationStatus[];
  } | null>(null);

  useEffect(() => {
    loadProgress();
  }, []);

  const loadProgress = async () => {
    try {
      setLoading(true);
      const data = await getOverallMigrationProgress();
      setProgress(data);
    } catch (error) {
      logger.error('Error loading migration progress', error instanceof Error ? error : new Error(String(error)), { component: 'EncryptionMigrationStatus' });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Encryption Migration Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!progress) {
    return null;
  }

  const getStatusIcon = (status: MigrationStatus['status']) => {
    switch (status) {
      case 'complete':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'in_progress':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'not_started':
        return <Unlock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: MigrationStatus['status']) => {
    switch (status) {
      case 'complete':
        return <Badge variant="default" className="bg-green-600">Complete</Badge>;
      case 'in_progress':
        return <Badge variant="secondary">In Progress</Badge>;
      case 'not_started':
        return <Badge variant="outline">Not Started</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="w-5 h-5" />
          Encryption Migration Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Progress */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Overall Progress</span>
            <span className="text-sm text-muted-foreground">
              {progress.encryptedRecords} / {progress.totalRecords} records encrypted
            </span>
          </div>
          <Progress value={progress.percentageEncrypted} className="h-2" />
          <div className="mt-2 text-xs text-muted-foreground">
            {progress.percentageEncrypted}% complete
          </div>
        </div>

        {/* Table Status */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Table Status</h4>
          {progress.tablesStatus.map((table) => (
            <div key={table.table} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                {getStatusIcon(table.status)}
                <div>
                  <div className="font-medium text-sm">{table.table}</div>
                  <div className="text-xs text-muted-foreground">
                    {table.encryptedRecords} encrypted, {table.plaintextRecords} plaintext
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Progress value={table.percentageEncrypted} className="w-24 h-1.5" />
                {getStatusBadge(table.status)}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

