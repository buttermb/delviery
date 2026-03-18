/**
 * Encrypted Store Page
 * Handles /s/:token routes for private store links
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Store, AlertTriangle } from 'lucide-react';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';

export default function EncryptedStorePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  // Look up store by encrypted token
  const { data: store, isLoading, isError } = useQuery({
    queryKey: queryKeys.shopPages.encryptedStore(token),
    queryFn: async () => {
      if (!token) throw new Error('No token provided');

      // Find store by encrypted token
      const { data, error } = await supabase
        .from('marketplace_stores')
        .select('id, slug, store_name, is_active, is_public')
        .eq('encrypted_url_token', token)
        .maybeSingle();

      if (error) {
        logger.error('Failed to lookup store by token', error, { component: 'EncryptedStorePage' });
        throw error;
      }

      if (!data) {
        throw new Error('Invalid or expired link');
      }

      return data;
    },
    enabled: !!token,
    retry: false,
  });

  // Redirect to the actual store page once we have the slug
  useEffect(() => {
    if (store?.slug) {
      // Check if store is active
      if (!store.is_active) {
        setError('This store is currently unavailable');
        return;
      }

      // Redirect to the public store URL
      navigate(`/shop/${store.slug}`, { replace: true });
    }
  }, [store, navigate]);

  // Handle errors
  useEffect(() => {
    if (isError) {
      setError('This link is invalid or has expired');
    }
  }, [isError]);

  if (isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-muted/30">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 flex flex-col items-center text-center">
            <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
            <h1 className="text-xl font-semibold mb-2">Loading Store...</h1>
            <p className="text-muted-foreground">
              Please wait while we verify your access
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-muted/30">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-xl font-semibold mb-2">Link Unavailable</h1>
            <p className="text-muted-foreground mb-6">
              {error}
            </p>
            <Button onClick={() => navigate('/')}>
              Go to Homepage
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show a brief loading state while redirecting
  return (
    <div className="min-h-dvh flex items-center justify-center bg-muted/30">
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 pb-8 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Store className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-xl font-semibold mb-2">
            {store?.store_name || 'Accessing Store...'}
          </h1>
          <p className="text-muted-foreground">
            Redirecting you to the store...
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
