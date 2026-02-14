import { MigrationWizard } from '@/components/migration';

export function MenuMigration() {
  return (
    <div className="container max-w-6xl py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Menu Migration</h1>
        <p className="text-muted-foreground">
          Import products from spreadsheets, images, or paste text. AI-powered parsing handles messy data.
        </p>
      </div>
      
      <MigrationWizard />
    </div>
  );
}




