import {
  BookOpen,
  ExternalLink,
  FileText,
  ShoppingCart,
  Users,
  Truck,
  BarChart3,
  Code2,
  Rocket,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface DocLink {
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
  category: string;
}

const DOCUMENTATION_LINKS: DocLink[] = [
  {
    title: 'Getting Started',
    description: 'Quick setup guide and initial configuration',
    href: 'https://docs.floraiq.com/getting-started',
    icon: Rocket,
    category: 'Getting Started',
  },
  {
    title: 'Product Management',
    description: 'Adding, editing, and organizing your product catalog',
    href: 'https://docs.floraiq.com/products',
    icon: FileText,
    category: 'Products',
  },
  {
    title: 'Order Processing',
    description: 'Managing orders, statuses, and fulfillment workflows',
    href: 'https://docs.floraiq.com/orders',
    icon: ShoppingCart,
    category: 'Orders',
  },
  {
    title: 'Customer Management',
    description: 'Customer profiles, segments, and communication',
    href: 'https://docs.floraiq.com/customers',
    icon: Users,
    category: 'Customers',
  },
  {
    title: 'Delivery & Logistics',
    description: 'Delivery zones, driver management, and route optimization',
    href: 'https://docs.floraiq.com/delivery',
    icon: Truck,
    category: 'Delivery',
  },
  {
    title: 'Analytics & Reports',
    description: 'Sales dashboards, inventory reports, and performance metrics',
    href: 'https://docs.floraiq.com/analytics',
    icon: BarChart3,
    category: 'Analytics',
  },
  {
    title: 'API Reference',
    description: 'REST API endpoints, authentication, and webhook integrations',
    href: 'https://docs.floraiq.com/api',
    icon: Code2,
    category: 'API',
  },
];

export function DocumentationLinks() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          Documentation
        </CardTitle>
        <CardDescription>
          Guides and references to help you get the most out of FloraIQ
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {DOCUMENTATION_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <a
                key={link.title}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted transition-colors group"
              >
                <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{link.title}</p>
                    <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-xs text-muted-foreground">{link.description}</p>
                </div>
              </a>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
