/**
 * White Label Provider
 * Dynamically applies tenant branding and themes
 */

import { useEffect } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { canUseWhiteLabel } from '@/lib/tenant';

export function WhiteLabelProvider({ children }: { children: React.ReactNode }) {
  const { tenant } = useTenant();

  useEffect(() => {
    if (!tenant || !canUseWhiteLabel(tenant)) {
      // Reset to defaults if white-label is disabled
      document.documentElement.style.removeProperty('--wl-primary');
      document.documentElement.style.removeProperty('--wl-secondary');
      document.documentElement.style.removeProperty('--wl-background');
      document.documentElement.style.removeProperty('--wl-text');
      document.documentElement.style.removeProperty('--wl-accent');
      return;
    }

    const whiteLabel = tenant.white_label;
    if (!whiteLabel?.enabled) return;

    const theme = whiteLabel.theme || {};

    // Apply CSS custom properties
    if (theme.primaryColor) {
      document.documentElement.style.setProperty('--wl-primary', theme.primaryColor);
      document.documentElement.style.setProperty('--color-primary', theme.primaryColor);
    }

    if (theme.secondaryColor) {
      document.documentElement.style.setProperty('--wl-secondary', theme.secondaryColor);
      document.documentElement.style.setProperty('--color-secondary', theme.secondaryColor);
    }

    if (theme.backgroundColor) {
      document.documentElement.style.setProperty('--wl-background', theme.backgroundColor);
      document.documentElement.style.setProperty('--color-background', theme.backgroundColor);
    }

    if (theme.textColor) {
      document.documentElement.style.setProperty('--wl-text', theme.textColor);
      document.documentElement.style.setProperty('--color-foreground', theme.textColor);
    }

    if (theme.accentColor) {
      document.documentElement.style.setProperty('--wl-accent', theme.accentColor);
    }

    // Apply custom CSS if provided
    if (theme.customCSS) {
      // Remove existing custom style tag
      const existingStyle = document.getElementById('whitelabel-custom-css');
      if (existingStyle) {
        existingStyle.remove();
      }

      // Add new custom CSS
      const style = document.createElement('style');
      style.id = 'whitelabel-custom-css';
      style.innerHTML = theme.customCSS;
      document.head.appendChild(style);
    }

    // Update favicon
    if ((whiteLabel as any)?.favicon) {
      let favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
      if (!favicon) {
        favicon = document.createElement('link');
        favicon.rel = 'icon';
        document.head.appendChild(favicon);
      }
      favicon.href = (whiteLabel as any).favicon;
    }

    // Update page title
    if (tenant.business_name) {
      document.title = `${tenant.business_name} - Dashboard`;
    }

    // Cleanup function
    return () => {
      // Remove custom CSS on unmount
      const customStyle = document.getElementById('whitelabel-custom-css');
      if (customStyle) {
        customStyle.remove();
      }
    };
  }, [tenant]);

  return <>{children}</>;
}

