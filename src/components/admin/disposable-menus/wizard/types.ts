import { Sparkles, Eye, CheckCircle2, Settings2, Shield } from 'lucide-react';

export interface MenuCreationWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export interface InventoryProduct {
  id: string;
  name: string;
  price: number;
  sku?: string;
  description?: string;
  image_url?: string;
  category?: string;
  stock_quantity?: number;
}

export interface GeofenceConfig {
  lat: string;
  lng: string;
  radiusMiles: string;
}

export const STANDARD_TIERS = [
  { label: '8th', weight_grams: 3.5 },
  { label: 'Q', weight_grams: 7 },
  { label: 'Half', weight_grams: 14 },
  { label: 'Zip', weight_grams: 28 },
  { label: 'QP', weight_grams: 112 },
] as const;

export type StandardTier = (typeof STANDARD_TIERS)[number];

export interface StepDefinition {
  id: number;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const STEPS: StepDefinition[] = [
  { id: 1, name: 'Template', icon: Sparkles },
  { id: 2, name: 'Details', icon: Eye },
  { id: 3, name: 'Products', icon: CheckCircle2 },
  { id: 4, name: 'Advanced', icon: Settings2 },
  { id: 5, name: 'Settings', icon: Shield },
];

export const validateEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export const validatePhone = (phone: string): boolean => {
  return /^\+?[\d\s\-()]{10,}$/.test(phone);
};

/** Generate an 8-character alphanumeric access code. */
export const generateAccessCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
};
