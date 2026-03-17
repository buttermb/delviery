import { useState, useMemo } from 'react';
import { Search, HelpCircle, ExternalLink } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface HelpTopic {
  id: string;
  title: string;
  description: string;
  category: HelpCategory;
  href: string;
}

type HelpCategory = 'General' | 'Orders' | 'Products' | 'Customers' | 'Delivery' | 'Settings';

const HELP_TOPICS: HelpTopic[] = [
  {
    id: 'getting-started',
    title: 'Getting Started with FloraIQ',
    description: 'Learn the basics of setting up and navigating your FloraIQ dashboard.',
    category: 'General',
    href: '#',
  },
  {
    id: 'account-settings',
    title: 'Account & Profile Settings',
    description: 'Update your profile, change password, and manage account preferences.',
    category: 'Settings',
    href: '#',
  },
  {
    id: 'team-management',
    title: 'Managing Team Members',
    description: 'Invite staff, assign roles, and manage permissions for your team.',
    category: 'Settings',
    href: '#',
  },
  {
    id: 'create-order',
    title: 'Creating and Managing Orders',
    description: 'How to create new orders, update statuses, and process fulfillment.',
    category: 'Orders',
    href: '#',
  },
  {
    id: 'order-statuses',
    title: 'Understanding Order Statuses',
    description: 'Learn about each order status and how orders flow through the system.',
    category: 'Orders',
    href: '#',
  },
  {
    id: 'refunds',
    title: 'Processing Refunds',
    description: 'How to issue full or partial refunds for customer orders.',
    category: 'Orders',
    href: '#',
  },
  {
    id: 'add-products',
    title: 'Adding Products to Your Catalog',
    description: 'Create products with pricing, images, categories, and variants.',
    category: 'Products',
    href: '#',
  },
  {
    id: 'inventory-tracking',
    title: 'Inventory Tracking & Alerts',
    description: 'Set up stock tracking, low-stock alerts, and automatic reorder points.',
    category: 'Products',
    href: '#',
  },
  {
    id: 'bulk-import',
    title: 'Bulk Import Products',
    description: 'Import products in bulk using CSV files or spreadsheet uploads.',
    category: 'Products',
    href: '#',
  },
  {
    id: 'customer-profiles',
    title: 'Customer Profiles & History',
    description: 'View customer details, order history, and communication logs.',
    category: 'Customers',
    href: '#',
  },
  {
    id: 'customer-segments',
    title: 'Customer Segments',
    description: 'Create customer segments based on purchase behavior and attributes.',
    category: 'Customers',
    href: '#',
  },
  {
    id: 'delivery-zones',
    title: 'Setting Up Delivery Zones',
    description: 'Define delivery areas, set fees, and configure delivery time windows.',
    category: 'Delivery',
    href: '#',
  },
  {
    id: 'driver-management',
    title: 'Driver Management',
    description: 'Add drivers, assign deliveries, and track delivery progress in real time.',
    category: 'Delivery',
    href: '#',
  },
  {
    id: 'notifications',
    title: 'Notification Settings',
    description: 'Configure email, SMS, and push notification preferences.',
    category: 'Settings',
    href: '#',
  },
  {
    id: 'billing',
    title: 'Billing & Subscription',
    description: 'Manage your subscription plan, payment methods, and invoices.',
    category: 'Settings',
    href: '#',
  },
  {
    id: 'disposable-menus',
    title: 'Disposable Menus',
    description: 'Create and share time-limited, secure product menus with customers.',
    category: 'General',
    href: '#',
  },
];

const CATEGORY_COLORS: Record<HelpCategory, string> = {
  General: 'bg-muted text-foreground',
  Orders: 'bg-blue-100 text-blue-800',
  Products: 'bg-green-100 text-green-800',
  Customers: 'bg-purple-100 text-purple-800',
  Delivery: 'bg-orange-100 text-orange-800',
  Settings: 'bg-yellow-100 text-yellow-800',
};

export function HelpSearchPanel() {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTopics = useMemo(() => {
    if (!searchQuery.trim()) return HELP_TOPICS;

    const query = searchQuery.toLowerCase();
    return HELP_TOPICS.filter(
      (topic) =>
        topic.title.toLowerCase().includes(query) ||
        topic.description.toLowerCase().includes(query) ||
        topic.category.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5" />
          Help Center
        </CardTitle>
        <CardDescription>
          Search for answers to common questions and learn how to use FloraIQ
        </CardDescription>
        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search help topics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </CardHeader>
      <CardContent>
        {filteredTopics.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <HelpCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No topics found for "{searchQuery}"</p>
            <p className="text-xs mt-1">Try a different search term</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTopics.map((topic) => (
              <a
                key={topic.id}
                href={topic.href}
                className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-sm">{topic.title}</p>
                    <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  </div>
                  <p className="text-xs text-muted-foreground">{topic.description}</p>
                </div>
                <Badge className={`${CATEGORY_COLORS[topic.category]} text-[10px] flex-shrink-0`}>
                  {topic.category}
                </Badge>
              </a>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
