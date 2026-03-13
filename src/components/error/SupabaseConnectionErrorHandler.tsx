import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export function SupabaseConnectionErrorHandler() {
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    // Test connection on mount
    testConnection();

    // Set up periodic connection check
    const interval = setInterval(testConnection, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const testConnection = async () => {
    try {
      const { error } = await supabase.from('tenants').select('id').limit(1);

      if (error) {
        logger.error('[SupabaseConnection] Connection error', { error });
        setHasError(true);
        setErrorMessage(error.message);
      } else {
        // Connection successful
        if (hasError) {
          logger.info('[SupabaseConnection] Connection restored');
          setHasError(false);
          setErrorMessage('');
        }
      }
    } catch (error) {
      logger.error('[SupabaseConnection] Unexpected error testing connection', { error });
      setHasError(true);
      setErrorMessage('Unable to connect to database');
    }
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    logger.info('[SupabaseConnection] Manually retrying connection');
    await testConnection();
    setIsRetrying(false);
  };

  if (!hasError) {
    return null;
  }

  return (
    <div className="fixed top-16 left-0 right-0 z-50 px-4">
      <div className="container mx-auto max-w-4xl">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Database Connection Error</AlertTitle>
          <AlertDescription className="mt-2">
            <p className="mb-3">
              Unable to connect to the database. Please check your internet connection or try again later.
            </p>
            {errorMessage && (
              <p className="text-xs font-mono mb-3 p-2 bg-red-50 rounded border border-red-200">
                {errorMessage}
              </p>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={handleRetry}
              disabled={isRetrying}
              className="gap-2"
            >
              <RefreshCw className={`h-3 w-3 ${isRetrying ? 'animate-spin' : ''}`} />
              {isRetrying ? 'Retrying...' : 'Retry Connection'}
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}
