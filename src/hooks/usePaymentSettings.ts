import { logger } from '@/lib/logger';
/**
 * usePaymentSettings - Hook to fetch and manage payment settings
 * Fetches tenant-level defaults and merges with per-menu overrides
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';

export interface PaymentSettings {
  // Payment method toggles
  accept_cash: boolean;
  accept_zelle: boolean;
  accept_cashapp: boolean;
  accept_bitcoin: boolean;
  accept_lightning: boolean;
  accept_ethereum: boolean;
  accept_usdt: boolean;
  // Payment details
  zelle_username: string | null;
  zelle_phone: string | null;
  cashapp_username: string | null;
  bitcoin_address: string | null;
  lightning_address: string | null;
  ethereum_address: string | null;
  usdt_address: string | null;
  // Custom instructions
  cash_instructions: string | null;
  zelle_instructions: string | null;
  cashapp_instructions: string | null;
  crypto_instructions: string | null;
}

export interface PaymentMethod {
  id: string;
  name: string;
  icon: string;
  enabled: boolean;
  address?: string | null;
  username?: string | null;
  phone?: string | null;
  instructions?: string | null;
  category: 'cash' | 'digital' | 'crypto';
}

const DEFAULT_SETTINGS: PaymentSettings = {
  accept_cash: true,
  accept_zelle: false,
  accept_cashapp: false,
  accept_bitcoin: false,
  accept_lightning: false,
  accept_ethereum: false,
  accept_usdt: false,
  zelle_username: null,
  zelle_phone: null,
  cashapp_username: null,
  bitcoin_address: null,
  lightning_address: null,
  ethereum_address: null,
  usdt_address: null,
  cash_instructions: null,
  zelle_instructions: null,
  cashapp_instructions: null,
  crypto_instructions: null,
};

/**
 * Fetch payment settings for a tenant
 */
export function useTenantPaymentSettings() {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: queryKeys.tenantPaymentSettings(tenant?.id ?? ''),
    queryFn: async () => {
      if (!tenant?.id) return DEFAULT_SETTINGS;

      const { data, error } = await supabase
        .from('tenant_payment_settings')
        .select('accept_cash, accept_zelle, accept_cashapp, accept_bitcoin, accept_lightning, accept_ethereum, accept_usdt, zelle_username, zelle_phone, cashapp_username, bitcoin_address, lightning_address, ethereum_address, usdt_address, cash_instructions, zelle_instructions, cashapp_instructions, crypto_instructions')
        .eq('tenant_id', tenant.id)
        .maybeSingle();

      if (error) {
        logger.error('Error fetching payment settings:', error);
        return DEFAULT_SETTINGS;
      }

      return data || DEFAULT_SETTINGS;
    },
    enabled: !!tenant?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Fetch payment settings for a specific menu (customer-facing)
 * Merges tenant defaults with per-menu overrides
 */
export function useMenuPaymentSettings(menuId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.menuPaymentSettings(menuId),
    queryFn: async (): Promise<PaymentSettings> => {
      if (!menuId) return DEFAULT_SETTINGS;

      // First, get the menu to find its tenant_id and any payment_settings override
      const { data: menu, error: menuError } = await supabase
        .from('disposable_menus')
        .select('tenant_id, payment_settings')
        .eq('id', menuId)
        .maybeSingle();

      if (menuError || !menu) {
        logger.error('Error fetching menu:', menuError);
        return DEFAULT_SETTINGS;
      }

      // Get tenant-level payment settings
      const { data: tenantSettings, error: settingsError } = await supabase
        .from('tenant_payment_settings')
        .select('accept_cash, accept_zelle, accept_cashapp, accept_bitcoin, accept_lightning, accept_ethereum, accept_usdt, zelle_username, zelle_phone, cashapp_username, bitcoin_address, lightning_address, ethereum_address, usdt_address, cash_instructions, zelle_instructions, cashapp_instructions, crypto_instructions')
        .eq('tenant_id', menu.tenant_id)
        .maybeSingle();

      if (settingsError) {
        logger.error('Error fetching tenant payment settings:', settingsError);
        return DEFAULT_SETTINGS;
      }

      // Start with defaults, merge tenant settings, then menu overrides
      let settings: PaymentSettings = { ...DEFAULT_SETTINGS };

      if (tenantSettings && typeof tenantSettings === 'object') {
        settings = { ...settings, ...(tenantSettings as Partial<PaymentSettings>) };
      }

      // Apply per-menu overrides if they exist
      const menuPaymentSettings = (menu as unknown as Record<string, unknown>).payment_settings;
      if (menuPaymentSettings && typeof menuPaymentSettings === 'object') {
        settings = { ...settings, ...(menuPaymentSettings as Partial<PaymentSettings>) };
      }

      return settings;
    },
    enabled: !!menuId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Transform payment settings into a list of enabled payment methods
 * Useful for rendering payment options in checkout
 */
export function getEnabledPaymentMethods(settings: PaymentSettings): PaymentMethod[] {
  const methods: PaymentMethod[] = [];

  // Cash
  if (settings.accept_cash) {
    methods.push({
      id: 'cash',
      name: 'Cash',
      icon: '💵',
      enabled: true,
      instructions: settings.cash_instructions,
      category: 'cash',
    });
  }

  // Zelle
  if (settings.accept_zelle) {
    methods.push({
      id: 'zelle',
      name: 'Zelle',
      icon: '💜',
      enabled: true,
      username: settings.zelle_username,
      phone: settings.zelle_phone,
      instructions: settings.zelle_instructions,
      category: 'digital',
    });
  }

  // CashApp
  if (settings.accept_cashapp) {
    methods.push({
      id: 'cashapp',
      name: 'Cash App',
      icon: '💚',
      enabled: true,
      username: settings.cashapp_username,
      instructions: settings.cashapp_instructions,
      category: 'digital',
    });
  }

  // Bitcoin
  if (settings.accept_bitcoin) {
    methods.push({
      id: 'bitcoin',
      name: 'Bitcoin',
      icon: '₿',
      enabled: true,
      address: settings.bitcoin_address,
      instructions: settings.crypto_instructions,
      category: 'crypto',
    });
  }

  // Lightning
  if (settings.accept_lightning) {
    methods.push({
      id: 'lightning',
      name: 'Lightning',
      icon: 'zap',
      enabled: true,
      address: settings.lightning_address,
      instructions: settings.crypto_instructions,
      category: 'crypto',
    });
  }

  // Ethereum
  if (settings.accept_ethereum) {
    methods.push({
      id: 'ethereum',
      name: 'Ethereum',
      icon: '💎',
      enabled: true,
      address: settings.ethereum_address,
      instructions: settings.crypto_instructions,
      category: 'crypto',
    });
  }

  // USDT
  if (settings.accept_usdt) {
    methods.push({
      id: 'usdt',
      name: 'USDT (Tether)',
      icon: '💲',
      enabled: true,
      address: settings.usdt_address,
      instructions: settings.crypto_instructions,
      category: 'crypto',
    });
  }

  return methods;
}

/**
 * Group payment methods by category
 */
export function groupPaymentMethodsByCategory(methods: PaymentMethod[]): {
  cash: PaymentMethod[];
  digital: PaymentMethod[];
  crypto: PaymentMethod[];
} {
  return {
    cash: methods.filter(m => m.category === 'cash'),
    digital: methods.filter(m => m.category === 'digital'),
    crypto: methods.filter(m => m.category === 'crypto'),
  };
}

