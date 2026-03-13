import { Card } from '@/components/ui/card';
import { Database } from 'lucide-react';

export function DataBackupSettings() {
  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Database className="h-5 w-5" />
        Data Backup & Export
      </h3>
      <p className="text-muted-foreground">
        Configure automatic backups and export your data on demand.
      </p>
      <div className="mt-4 text-sm text-muted-foreground">
        Coming soon: Schedule automatic backups and export all your data.
      </div>
    </Card>
  );
}
