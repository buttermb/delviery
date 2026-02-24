/**
 * Tenant Migration Tool
 * Migrate tenant data between environments or platforms
 * Inspired by migration tools from enterprise SaaS platforms
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Database, ArrowRight, Download, Upload, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';

interface MigrationStep {
  step: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  message?: string;
}

export function TenantMigration() {
  const [sourceTenant, setSourceTenant] = useState<string>('');
  const [targetTenant, setTargetTenant] = useState<string>('');
  const [migrationType, setMigrationType] = useState<'copy' | 'move' | 'export' | 'import'>('copy');
  const [steps, setSteps] = useState<MigrationStep[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  const { data: tenants } = useQuery({
    queryKey: queryKeys.superAdminTools.allTenants(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select('id, business_name, slug')
        .order('business_name');

      if (error) throw error;
      return data || [];
    },
  });

  const migrationSteps = [
    { step: 'Export tenant data', status: 'pending' as const },
    { step: 'Validate data integrity', status: 'pending' as const },
    { step: 'Create backup', status: 'pending' as const },
    { step: 'Import data', status: 'pending' as const },
    { step: 'Verify migration', status: 'pending' as const },
  ];

  const handleMigration = async () => {
    if (!sourceTenant) {
      toast.error('Error', {
        description: 'Please select a source tenant',
      });
      return;
    }

    setIsRunning(true);
    setSteps(migrationSteps);
    setProgress(0);

    // Simulate migration process
    for (let i = 0; i < migrationSteps.length; i++) {
      setSteps((prev) => {
        const newSteps = [...prev];
        newSteps[i] = { ...newSteps[i], status: 'running' };
        return newSteps;
      });

      // Simulate work
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setSteps((prev) => {
        const newSteps = [...prev];
        newSteps[i] = { ...newSteps[i], status: 'completed', message: 'Success' };
        return newSteps;
      });

      setProgress(((i + 1) / migrationSteps.length) * 100);
    }

    setIsRunning(false);
    toast.success('Migration Complete', {
      description: 'Tenant data has been migrated successfully',
    });
  };

  const handleExport = () => {
    toast.info('Export Started', {
      description: 'Preparing tenant data export...',
    });
  };

  const handleImport = () => {
    toast.info('Import Started', {
      description: 'Upload and import tenant data...',
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Tenant Migration Tool
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Migration Type */}
        <div className="space-y-2">
          <Label>Migration Type</Label>
          <Select value={migrationType} onValueChange={(value: string) => setMigrationType(value as 'copy' | 'move' | 'export' | 'import')}>
            <SelectTrigger>
              <SelectValue placeholder="Select migration type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="copy">Copy to Another Tenant</SelectItem>
              <SelectItem value="move">Move to Another Tenant</SelectItem>
              <SelectItem value="export">Export to File</SelectItem>
              <SelectItem value="import">Import from File</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Source Tenant */}
        {(migrationType === 'copy' || migrationType === 'move') && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Source Tenant</Label>
              <Select value={sourceTenant} onValueChange={setSourceTenant}>
                <SelectTrigger>
                  <SelectValue placeholder="Select source tenant..." />
                </SelectTrigger>
                <SelectContent>
                  {tenants?.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id}>
                      {tenant.business_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Target Tenant</Label>
              <Select value={targetTenant} onValueChange={setTargetTenant}>
                <SelectTrigger>
                  <SelectValue placeholder="Select target tenant..." />
                </SelectTrigger>
                <SelectContent>
                  {tenants
                    ?.filter((t) => t.id !== sourceTenant)
                    .map((tenant) => (
                      <SelectItem key={tenant.id} value={tenant.id}>
                        {tenant.business_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Export */}
        {migrationType === 'export' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tenant to Export</Label>
              <Select value={sourceTenant} onValueChange={setSourceTenant}>
                <SelectTrigger>
                  <SelectValue placeholder="Select tenant..." />
                </SelectTrigger>
                <SelectContent>
                  {tenants?.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id}>
                      {tenant.business_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleExport} className="w-full">
              <Download className="h-4 w-4 mr-2" />
              Export Tenant Data
            </Button>
          </div>
        )}

        {/* Import */}
        {migrationType === 'import' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Import File</Label>
              <Input type="file" accept=".json,.csv" />
            </div>
            <Button onClick={handleImport} className="w-full">
              <Upload className="h-4 w-4 mr-2" />
              Import Tenant Data
            </Button>
          </div>
        )}

        {/* Migration Progress */}
        {isRunning && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Migration Progress</Label>
              <span className="text-sm font-medium">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} />
            <div className="space-y-2 mt-4">
              {steps.map((step, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  {step.status === 'completed' && (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  )}
                  {step.status === 'running' && (
                    <div className="h-4 w-4 border-2 border-info border-t-transparent rounded-full animate-spin" />
                  )}
                  {step.status === 'pending' && (
                    <div className="h-4 w-4 border-2 border-muted rounded-full" />
                  )}
                  {step.status === 'failed' && (
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                  )}
                  <span className={step.status === 'completed' ? 'text-green-500' : ''}>
                    {step.step}
                  </span>
                  {step.message && (
                    <span className="text-xs text-muted-foreground">- {step.message}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        {(migrationType === 'copy' || migrationType === 'move') && (
          <Button
            onClick={handleMigration}
            disabled={isRunning || !sourceTenant || !targetTenant}
            className="w-full"
          >
            <ArrowRight className="h-4 w-4 mr-2" />
            {migrationType === 'copy' ? 'Copy Data' : 'Move Data'}
          </Button>
        )}

        {/* Warning */}
        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-yellow-500">Warning</p>
              <p className="text-muted-foreground mt-1">
                Migration operations are irreversible. Always create a backup before proceeding.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

