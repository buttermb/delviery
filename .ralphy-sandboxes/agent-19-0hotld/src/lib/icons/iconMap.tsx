/**
 * Centralized Icon Map
 * 
 * Maps string icon names to Lucide React icon components.
 * Used by quick actions, navigation, and other dynamic icon rendering.
 */

import {
  DollarSign,
  TrendingUp,
  Package,
  AlertCircle,
  ChevronRight,
  Users,
  Store,
  Menu,
  Box,
  MapPin,
  BarChart3,
  BarChart,
  Shield,
  Building,
  CheckCircle,
  Plus,
  Clock,
  Truck,
  ArrowRightLeft,
  FileText,
  Globe,
  Sparkles,
  CreditCard,
  Wallet,
  Calendar,
  MessageSquare,
  LayoutGrid,
  List,
  Settings,
  Home,
  ShoppingCart,
  Clipboard,
  Layers,
  Tag,
  Percent,
  Receipt,
  CreditCard as Payment,
  Bell,
  Mail,
  Phone,
  HelpCircle,
  Plug,
  Smartphone,
  GraduationCap,
  User,
  type LucideIcon,
} from 'lucide-react';
import React from 'react';

// Icon size variants
type IconSize = 'sm' | 'md' | 'lg' | 'xl';

const sizeClasses: Record<IconSize, string> = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
  xl: 'h-8 w-8',
};

// Map of icon name strings to Lucide components
export const iconComponents: Record<string, LucideIcon> = {
  DollarSign,
  TrendingUp,
  Package,
  AlertCircle,
  ChevronRight,
  Users,
  Store,
  Menu,
  Box,
  MapPin,
  BarChart3,
  Shield,
  Building,
  CheckCircle,
  Plus,
  Clock,
  Truck,
  ArrowRightLeft,
  FileText,
  Globe,
  Sparkles,
  CreditCard,
  Wallet,
  Calendar,
  MessageSquare,
  LayoutGrid,
  List,
  Settings,
  Home,
  ShoppingCart,
  Clipboard,
  Layers,
  Tag,
  Percent,
  Receipt,
  Payment,
  Bell,
  Mail,
  Phone,
  HelpCircle,
  BarChart,
  Plug,
  Smartphone,
  GraduationCap,
  User,
};

/**
 * Get a React element for the given icon name
 * @param iconName - The name of the icon (e.g., 'DollarSign', 'Package')
 * @param size - The size of the icon (default: 'md')
 * @param className - Additional className to apply
 * @returns React element for the icon, or null if not found
 */
export function getIcon(
  iconName: string,
  size: IconSize = 'md',
  className?: string
): React.ReactNode {
  const IconComponent = iconComponents[iconName];
  
  if (!IconComponent) {
    // Silently return null for missing icons to avoid log noise in production
    return null;
  }
  
  return <IconComponent className={`${sizeClasses[size]} ${className ?? ''}`} />;
}

/**
 * Pre-rendered icon map for quick access (backwards compatible)
 * All icons rendered at 'md' size (h-5 w-5)
 */
export const iconMap: Record<string, React.ReactNode> = Object.fromEntries(
  Object.entries(iconComponents).map(([name, Icon]) => [
    name,
    <Icon key={name} className="h-5 w-5" />,
  ])
);

/**
 * Get icon component by name (for custom rendering)
 */
export function getIconComponent(iconName: string): LucideIcon | undefined {
  return iconComponents[iconName];
}
