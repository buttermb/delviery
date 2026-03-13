import { Play, Clock } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface VideoTutorial {
  id: string;
  title: string;
  description: string;
  duration: string;
  category: string;
}

const VIDEO_TUTORIALS: VideoTutorial[] = [
  {
    id: 'setup-account',
    title: 'Setting Up Your Account',
    description: 'Configure your business profile, branding, and basic settings',
    duration: '3:45',
    category: 'Setup',
  },
  {
    id: 'setup-delivery-zones',
    title: 'Configuring Delivery Zones',
    description: 'Define delivery areas, set fees, and configure minimum orders',
    duration: '4:20',
    category: 'Setup',
  },
  {
    id: 'add-products',
    title: 'Adding Products',
    description: 'Create products, set pricing, manage categories and variants',
    duration: '5:10',
    category: 'Products',
  },
  {
    id: 'manage-inventory',
    title: 'Managing Inventory',
    description: 'Track stock levels, set low-stock alerts, and bulk updates',
    duration: '4:00',
    category: 'Products',
  },
  {
    id: 'process-orders',
    title: 'Processing Orders',
    description: 'Receive, fulfill, and manage customer orders efficiently',
    duration: '6:15',
    category: 'Orders',
  },
  {
    id: 'assign-deliveries',
    title: 'Assigning Deliveries',
    description: 'Assign drivers, track routes, and manage delivery status',
    duration: '3:30',
    category: 'Delivery',
  },
  {
    id: 'read-analytics',
    title: 'Understanding Analytics',
    description: 'Read dashboards, track KPIs, and export sales reports',
    duration: '5:45',
    category: 'Analytics',
  },
  {
    id: 'disposable-menus',
    title: 'Creating Disposable Menus',
    description: 'Generate and share secure, time-limited product menus',
    duration: '3:00',
    category: 'Orders',
  },
];

export function GettingStartedVideos() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Video Tutorials</CardTitle>
        <CardDescription>
          Watch step-by-step guides to learn FloraIQ features
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {VIDEO_TUTORIALS.map((video) => (
            <a
              key={video.id}
              href="#"
              className="group block rounded-lg border overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Thumbnail placeholder */}
              <div className="relative aspect-video bg-muted flex items-center justify-center">
                <div className="absolute inset-0 bg-black/5 group-hover:bg-black/10 transition-colors" />
                <div className="w-12 h-12 rounded-full bg-black/60 group-hover:bg-black/80 flex items-center justify-center transition-colors">
                  <Play className="h-5 w-5 text-white ml-0.5" />
                </div>
                <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/70 text-white text-xs px-2 py-0.5 rounded">
                  <Clock className="h-3 w-3" />
                  {video.duration}
                </div>
                <div className="absolute top-2 left-2 bg-primary/90 text-primary-foreground text-xs px-2 py-0.5 rounded">
                  {video.category}
                </div>
              </div>
              {/* Info */}
              <div className="p-3">
                <p className="font-medium text-sm line-clamp-1">{video.title}</p>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {video.description}
                </p>
              </div>
            </a>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
