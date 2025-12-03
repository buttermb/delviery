// @ts-nocheck
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Upload, 
  Loader2, 
  Columns, 
  Eye, 
  Download, 
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import type { MigrationStep } from '@/types/migration';
import { useMigration } from '@/hooks/useMigration';
import { UploadStep } from './UploadStep';
import { ParsingStep } from './ParsingStep';
import { MappingStep } from './MappingStep';
import { PreviewStep } from './PreviewStep';
import { ImportingStep } from './ImportingStep';
import { CompleteStep } from './CompleteStep';

const STEPS: { id: MigrationStep; label: string; icon: React.ReactNode }[] = [
  { id: 'upload', label: 'Upload', icon: <Upload className="h-4 w-4" /> },
  { id: 'parsing', label: 'Parse', icon: <Loader2 className="h-4 w-4" /> },
  { id: 'mapping', label: 'Map', icon: <Columns className="h-4 w-4" /> },
  { id: 'preview', label: 'Preview', icon: <Eye className="h-4 w-4" /> },
  { id: 'importing', label: 'Import', icon: <Download className="h-4 w-4" /> },
  { id: 'complete', label: 'Done', icon: <CheckCircle2 className="h-4 w-4" /> },
];

function getStepIndex(step: MigrationStep): number {
  return STEPS.findIndex((s) => s.id === step);
}

function getStepProgress(step: MigrationStep): number {
  const index = getStepIndex(step);
  return ((index + 1) / STEPS.length) * 100;
}

export function MigrationWizard() {
  const migration = useMigration();
  const currentStepIndex = getStepIndex(migration.state.step);

  const canGoBack = currentStepIndex > 0 && 
    migration.state.step !== 'parsing' && 
    migration.state.step !== 'importing' &&
    migration.state.step !== 'complete';

  const handleBack = () => {
    if (currentStepIndex > 0) {
      const prevStep = STEPS[currentStepIndex - 1].id;
      migration.goToStep(prevStep);
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <Card className="border-none bg-gradient-to-br from-emerald-500/10 via-teal-500/10 to-cyan-500/10">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Menu Migration</h2>
            <span className="text-sm text-muted-foreground">
              Step {currentStepIndex + 1} of {STEPS.length}
            </span>
          </div>
          
          <Progress 
            value={getStepProgress(migration.state.step)} 
            className="h-2 mb-4"
          />
          
          {/* Step indicators */}
          <div className="flex justify-between">
            {STEPS.map((step, index) => {
              const isCurrent = step.id === migration.state.step;
              const isPast = index < currentStepIndex;
              const isFuture = index > currentStepIndex;
              
              return (
                <div 
                  key={step.id}
                  className={`flex flex-col items-center gap-1 transition-all ${
                    isCurrent 
                      ? 'text-emerald-500 scale-110' 
                      : isPast 
                        ? 'text-emerald-400/70' 
                        : 'text-muted-foreground/50'
                  }`}
                >
                  <div className={`p-2 rounded-full transition-colors ${
                    isCurrent 
                      ? 'bg-emerald-500/20' 
                      : isPast 
                        ? 'bg-emerald-500/10' 
                        : 'bg-muted/50'
                  }`}>
                    {step.icon}
                  </div>
                  <span className="text-xs font-medium hidden sm:block">
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {migration.state.error && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="py-4">
            <p className="text-sm text-destructive">{migration.state.error}</p>
          </CardContent>
        </Card>
      )}

      {/* Step Content */}
      <Card>
        <CardContent className="pt-6">
          {migration.state.step === 'upload' && (
            <UploadStep
              onFileUpload={migration.handleFileUpload}
              onTextPaste={migration.handleTextPaste}
            />
          )}
          
          {migration.state.step === 'parsing' && (
            <ParsingStep
              isLoading={migration.isParsingLoading}
              format={migration.state.inputFormat}
              fileName={migration.state.fileName}
              onStartParsing={migration.startAIParsing}
            />
          )}
          
          {migration.state.step === 'mapping' && migration.state.detectedColumns && (
            <MappingStep
              detectedColumns={migration.state.detectedColumns}
              onUpdateMappings={migration.updateColumnMappings}
              onConfirm={() => migration.startAIParsing()}
            />
          )}
          
          {migration.state.step === 'preview' && (
            <PreviewStep
              products={migration.state.parsedProducts}
              onUpdateProduct={migration.updateProduct}
              onRemoveProduct={migration.removeProduct}
              onStartImport={migration.startImport}
              onBack={handleBack}
            />
          )}
          
          {migration.state.step === 'importing' && (
            <ImportingStep
              progress={migration.state.importProgress}
              isLoading={migration.isImportLoading}
            />
          )}
          
          {migration.state.step === 'complete' && migration.state.importResult && (
            <CompleteStep
              result={migration.state.importResult}
              onReset={migration.reset}
            />
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      {canGoBack && (
        <div className="flex justify-start">
          <Button
            variant="ghost"
            onClick={handleBack}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
      )}
    </div>
  );
}




