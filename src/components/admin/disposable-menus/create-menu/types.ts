import type { LucideIcon } from 'lucide-react';
import {
  Eye, CheckCircle2, DollarSign, Clock, Shield, Users, Bell, Palette,
} from 'lucide-react';

// ============================================
// Types
// ============================================

export interface CreateMenuDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export interface MenuGeofence {
  lat: number;
  lng: number;
  radiusMiles: number;
}

export interface MenuOptions {
  name: string;
  products: string[];
  customPrices: Record<string, number>;
  applyDiscount: boolean;
  discountPercent: number;
  expirationHours: number; // 1-168
  maxViews: number; // 1-1000
  accessCodeEnabled: boolean;
  accessCode: string; // 4-8 digits
  geofencingEnabled: boolean;
  geofence: MenuGeofence | null;
  whitelistEnabled: boolean;
  whitelistedEmails: string[];
  whitelistedPhones: string[];
  showBranding: boolean;
  customMessage: string;
  headerImage: string;
}

export interface InventoryProduct {
  id: string;
  product_name: string;
  category?: string | null;
  strain_type?: string | null;
  image_url?: string | null;
  images?: string[] | null;
  base_price?: number | null;
  quantity_lbs?: number | null;
  quantity_units?: number | null;
}

export interface CreatedMenuDetails {
  accessCode: string;
  shareableUrl: string;
  menuName: string;
}

export type AccessType = 'invite_only' | 'shared' | 'hybrid';

export type AppearanceStyle = 'professional' | 'minimal' | 'anonymous';

// ============================================
// Constants
// ============================================

export interface StepDefinition {
  id: number;
  name: string;
  icon: LucideIcon;
}

export const STEPS: StepDefinition[] = [
  { id: 1, name: 'Basic Info', icon: Eye },
  { id: 2, name: 'Products', icon: CheckCircle2 },
  { id: 3, name: 'Pricing', icon: DollarSign },
  { id: 4, name: 'Expiration', icon: Clock },
  { id: 5, name: 'Access', icon: Shield },
  { id: 6, name: 'Security', icon: Shield },
  { id: 7, name: 'Whitelist', icon: Users },
  { id: 8, name: 'Notifications', icon: Bell },
  { id: 9, name: 'Branding', icon: Palette },
];

// ============================================
// Helpers
// ============================================

export const generateAccessCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
};
