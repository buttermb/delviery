/**
 * Centralized Icon Map
 * 
 * Maps string icon names to Lucide React icon components.
 * Used by quick actions, navigation, and other dynamic icon rendering.
 */

import DollarSign from "lucide-react/dist/esm/icons/dollar-sign";
import TrendingUp from "lucide-react/dist/esm/icons/trending-up";
import Package from "lucide-react/dist/esm/icons/package";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";
import Users from "lucide-react/dist/esm/icons/users";
import Store from "lucide-react/dist/esm/icons/store";
import Menu from "lucide-react/dist/esm/icons/menu";
import Box from "lucide-react/dist/esm/icons/box";
import MapPin from "lucide-react/dist/esm/icons/map-pin";
import BarChart3 from "lucide-react/dist/esm/icons/bar-chart-3";
import Shield from "lucide-react/dist/esm/icons/shield";
import Building from "lucide-react/dist/esm/icons/building";
import CheckCircle from "lucide-react/dist/esm/icons/check-circle";
import Plus from "lucide-react/dist/esm/icons/plus";
import Clock from "lucide-react/dist/esm/icons/clock";
import Truck from "lucide-react/dist/esm/icons/truck";
import ArrowRightLeft from "lucide-react/dist/esm/icons/arrow-right-left";
import FileText from "lucide-react/dist/esm/icons/file-text";
import Globe from "lucide-react/dist/esm/icons/globe";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import CreditCard from "lucide-react/dist/esm/icons/credit-card";
import Wallet from "lucide-react/dist/esm/icons/wallet";
import Calendar from "lucide-react/dist/esm/icons/calendar";
import MessageSquare from "lucide-react/dist/esm/icons/message-square";
import LayoutGrid from "lucide-react/dist/esm/icons/layout-grid";
import List from "lucide-react/dist/esm/icons/list";
import Settings from "lucide-react/dist/esm/icons/settings";
import Home from "lucide-react/dist/esm/icons/home";
import ShoppingCart from "lucide-react/dist/esm/icons/shopping-cart";
import Clipboard from "lucide-react/dist/esm/icons/clipboard";
import Layers from "lucide-react/dist/esm/icons/layers";
import Tag from "lucide-react/dist/esm/icons/tag";
import Percent from "lucide-react/dist/esm/icons/percent";
import Receipt from "lucide-react/dist/esm/icons/receipt";
import Payment from "lucide-react/dist/esm/icons/credit-card";
import Bell from "lucide-react/dist/esm/icons/bell";
import Mail from "lucide-react/dist/esm/icons/mail";
import Phone from "lucide-react/dist/esm/icons/phone";
import type LucideIcon from "lucide-react/dist/esm/icons/type lucide-icon";
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
  
  return <IconComponent className={`${sizeClasses[size]} ${className || ''}`} />;
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
