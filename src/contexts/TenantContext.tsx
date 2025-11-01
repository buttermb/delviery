/**
 * Tenant Context Provider
 * Provides tenant context to all components
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tenant, TenantUser } from '@/lib/tenant';
import { getTenantById } from '@/lib/tenant';

interface TenantContextType {
  tenant: Tenant | null;
  tenantUser: TenantUser | null;
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children, tenantId }: { children: React.ReactNode; tenantId?: string }) {
  const queryClient = useQueryClient();
  const [currentTenantId, setCurrentTenantId] = useState<string | null>(tenantId || null);

  // Get tenant user from auth session
  const { data: session } = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  // Get tenant user
  const { data: tenantUser, isLoading: loadingUser } = useQuery({
    queryKey: ['tenant-user', session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return null;

      const { data, error } = await supabase
        .from('tenant_users')
        .select('*')
        .eq('email', session.user.email)
        .maybeSingle();

      if (error || !data) return null;
      return data as TenantUser;
    },
    enabled: !!session?.user?.id,
  });

  // Update tenant ID when user changes
  useEffect(() => {
    if (tenantUser?.tenant_id) {
      setCurrentTenantId(tenantUser.tenant_id);
    }
  }, [tenantUser]);

  // Get tenant data
  const { data: tenant, isLoading: loadingTenant, error } = useQuery({
    queryKey: ['tenant', currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return null;
      return await getTenantById(currentTenantId);
    },
    enabled: !!currentTenantId,
  });

  // Set tenant context for RLS when tenant changes
  // Note: This requires a custom Supabase function or will be handled via JWT claims
  useEffect(() => {
    if (tenant?.id) {
      // Store tenant ID in localStorage for API calls
      localStorage.setItem('current_tenant_id', tenant.id);
      // For RLS, we'll pass tenant_id as a header in API calls
      // The backend Edge Function will handle setting the context
    }
  }, [tenant?.id]);

  // Update last activity
  useEffect(() => {
    if (tenant?.id) {
      const interval = setInterval(() => {
        supabase
          .from('tenants')
          .update({ last_activity_at: new Date().toISOString() })
          .eq('id', tenant.id)
          .then(() => {
            queryClient.invalidateQueries({ queryKey: ['tenant', tenant.id] });
          })
          .catch(console.error);
      }, 60000); // Every minute

      return () => clearInterval(interval);
    }
  }, [tenant?.id, queryClient]);

  const refresh = () => {
    if (currentTenantId) {
      queryClient.invalidateQueries({ queryKey: ['tenant', currentTenantId] });
      queryClient.invalidateQueries({ queryKey: ['tenant-user'] });
    }
  };

  const value: TenantContextType = {
    tenant: tenant || null,
    tenantUser: tenantUser || null,
    loading: loadingUser || loadingTenant,
    error: error as Error | null,
    refresh,
  };

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}

