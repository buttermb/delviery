import { logger } from '@/lib/logger';
import { useState, useEffect } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Menu, X, Zap } from 'lucide-react';
import { navigationSections } from './sidebar-navigation';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { prefetchOnHover } from '@/lib/utils/prefetch';
import { isFeatureAvailable, featureTableRequirements } from '@/utils/featureAvailability';
import { AttentionBadge } from './hotbox/AttentionBadge';

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['Dashboard', 'Operations'])
  );
  const [availableFeatures, setAvailableFeatures] = useState<Set<string>>(new Set());
  const location = useLocation();
  const { tenant } = useTenantAdminAuth();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  const getFullPath = (href: string) => {
    if (!tenantSlug) return href;
    // If href starts with /admin, prepend tenant slug
    if (href.startsWith('/admin')) {
      return `/${tenantSlug}${href}`;
    }
    return href;
  };

  const isActive = (href: string) => {
    const fullPath = getFullPath(href);
    return location.pathname === fullPath || location.pathname.startsWith(fullPath + '/');
  };

  // Check feature availability on mount and when tenant changes
  useEffect(() => {
    const checkFeatures = async () => {
      const features = new Set<string>();
      const allHrefs = navigationSections.flatMap(section =>
        section.items.map(item => item.href)
      );

      // Check only features that have table requirements
      const featuresToCheck = allHrefs.filter(href =>
        featureTableRequirements[href] && featureTableRequirements[href].length > 0
      );

      // Check all features in parallel
      const availability = await Promise.all(
        featuresToCheck.map(async (href) => {
          const available = await isFeatureAvailable(href);
          return { href, available };
        })
      );

      // Add all features that are available or don't have requirements
      allHrefs.forEach(href => {
        if (!featureTableRequirements[href] || featureTableRequirements[href].length === 0) {
          features.add(href);
        } else {
          const result = availability.find(a => a.href === href);
          if (result?.available) {
            features.add(href);
          }
        }
      });

      setAvailableFeatures(features);
    };

    if (tenant?.id) {
      checkFeatures();
    }
  }, [tenant?.id]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const getTierBadge = (tier?: string) => {
    if (!tier || tier === 'free') return null;

    const colors = {
      professional: 'bg-info/10 text-info border-info/20',
      enterprise: 'bg-primary/10 text-primary border-primary/20',
      ultimate: 'bg-warning/10 text-warning border-warning/20'
    };

    return (
      <Badge variant="outline" className={cn('text-[10px] px-1 py-0', colors[tier as keyof typeof colors])}>
        {tier === 'professional' ? 'PRO' : tier === 'enterprise' ? 'ENT' : 'ULT'}
      </Badge>
    );
  };

  return (
    <>
      {/* Mobile toggle button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 lg:hidden"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-40 h-dvh bg-background border-r transition-transform duration-300',
          'w-64 lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-2 px-6 py-4 border-b">
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary-dark rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">B</span>
            </div>
            <div className="flex-1">
              <h2 className="font-bold text-sm">{tenant?.business_name || 'BigMike'}</h2>
              <p className="text-xs text-muted-foreground">Wholesale</p>
            </div>
            <AttentionBadge />
          </div>

          {/* Quick access to Hotbox */}
          <Link
            to={getFullPath('/admin/hotbox')}
            className={cn(
              'flex items-center gap-2 mx-3 mt-3 px-3 py-2 text-sm rounded-lg transition-colors',
              'bg-gradient-to-r from-primary/10 to-primary/5 hover:from-primary/20 hover:to-primary/10',
              'border border-primary/20 text-primary font-medium',
              isActive('/admin/hotbox') && 'ring-2 ring-primary/50'
            )}
          >
            <Zap className="h-4 w-4" />
            <span>Command Center</span>
          </Link>

          {/* Navigation */}
          <ScrollArea className="flex-1 px-3 py-4">
            <div className="space-y-6">
              {navigationSections.map((section) => (
                <div key={section.title}>
                  {/* Section header */}
                  <button
                    onClick={() => toggleSection(section.title)}
                    className="flex items-center justify-between w-full px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <span>{section.title}</span>
                    {expandedSections.has(section.title) ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                  </button>

                  {/* Section items */}
                  {expandedSections.has(section.title) && (
                    <div className="mt-1 space-y-0.5">
                      {section.items
                        .filter((item) => {
                          // Hide features that require tables that don't exist
                          // If availableFeatures is empty, show all (still loading)
                          if (availableFeatures.size === 0) return true;
                          return availableFeatures.has(item.href);
                        })
                        .map((item) => {
                          const Icon = item.icon;
                          const fullPath = getFullPath(item.href);
                          const active = isActive(item.href);

                          return (
                            <Link
                              key={item.href}
                              to={fullPath}
                              onClick={() => {
                                logger.debug('Sidebar click', {
                                  href: item.href,
                                  fullPath,
                                  title: item.title
                                });
                                setIsOpen(false);
                              }}
                              onMouseEnter={() => prefetchOnHover(fullPath)}
                              className={cn(
                                'flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors',
                                active
                                  ? 'bg-primary text-primary-foreground font-medium'
                                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                              )}
                            >
                              <Icon className="h-4 w-4 shrink-0" />
                              <span className="flex-1 truncate min-w-0">{item.title}</span>

                              {item.badge && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                  {item.badge}
                                </Badge>
                              )}

                              {getTierBadge(item.tier)}
                            </Link>
                          );
                        })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="border-t p-4">
            <div className="flex items-center gap-3 text-sm">
              <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                <span className="font-semibold text-xs">
                  {tenant?.business_name?.[0] || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate text-xs">{tenant?.business_name}</p>
                <p className="text-xs text-muted-foreground">Admin</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content offset */}
      <div className="lg:pl-64" />
    </>
  );
}

