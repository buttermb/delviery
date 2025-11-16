import { ModernPage } from '@/templates/ModernPageTemplate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  PlayCircle,
  BookOpen,
  HelpCircle,
  Mail,
  MessageSquare,
  Video,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';

export default function HelpPage() {
  const { tenant } = useTenantAdminAuth();

  // Video tutorial IDs (placeholder - replace with actual video IDs)
  const tutorials = [
    {
      id: 'how-to-import-products',
      title: 'How to Import Products',
      description: 'Learn how to import products from a CSV file and add them to your inventory.',
      duration: '2 min',
      videoId: 'dQw4w9WgXcQ', // Replace with actual YouTube/Video ID
    },
    {
      id: 'creating-your-first-menu',
      title: 'Creating Your First Menu',
      description: 'Step-by-step guide to creating and sharing a menu with your customers.',
      duration: '1.5 min',
      videoId: 'dQw4w9WgXcQ', // Replace with actual YouTube/Video ID
    },
    {
      id: 'sharing-menus-with-customers',
      title: 'Sharing Menus with Customers',
      description: 'Learn how to share menu links and manage customer access.',
      duration: '2 min',
      videoId: 'dQw4w9WgXcQ', // Replace with actual YouTube/Video ID
    },
  ];

  return (
    <ModernPage
      title="Help & Resources"
      description="Video tutorials, documentation, and support resources"
    >
      <div className="space-y-6">
        {/* Quick Help Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-2">
                <BookOpen className="h-6 w-6 text-primary" />
                <h3 className="font-semibold">Documentation</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Browse our comprehensive guides and FAQs
              </p>
              <Button variant="outline" className="w-full" asChild>
                <Link to="/faq">View Docs</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-2">
                <MessageSquare className="h-6 w-6 text-primary" />
                <h3 className="font-semibold">Live Chat</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Chat with our support team in real-time
              </p>
              <Button variant="outline" className="w-full">
                Start Chat
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-2">
                <Mail className="h-6 w-6 text-primary" />
                <h3 className="font-semibold">Email Support</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Send us an email and we'll respond within 24 hours
              </p>
              <Button variant="outline" className="w-full" asChild>
                <a href="mailto:support@example.com">Contact Us</a>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Video Tutorials Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Video className="h-6 w-6 text-primary" />
              <CardTitle>Video Tutorials</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-6">
              Watch these short video tutorials to get started quickly
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {tutorials.map((tutorial) => (
                <Card key={tutorial.id} className="overflow-hidden">
                  <div className="relative aspect-video bg-gray-100">
                    {/* YouTube Embed */}
                    <iframe
                      className="absolute inset-0 w-full h-full"
                      src={`https://www.youtube.com/embed/${tutorial.videoId}`}
                      title={tutorial.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-sm">{tutorial.title}</h3>
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                        {tutorial.duration}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{tutorial.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* FAQ Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <HelpCircle className="h-6 w-6 text-primary" />
              <CardTitle>Frequently Asked Questions</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="border-b pb-4">
                <h4 className="font-semibold mb-2">How do I add products to my inventory?</h4>
                <p className="text-sm text-muted-foreground">
                  You can add products individually through the Products page or import multiple
                  products at once using a CSV file. Watch the "How to Import Products" video
                  tutorial above for step-by-step instructions.
                </p>
              </div>

              <div className="border-b pb-4">
                <h4 className="font-semibold mb-2">How do I share a menu with customers?</h4>
                <p className="text-sm text-muted-foreground">
                  After creating a menu, you'll receive a unique link that you can share with your
                  customers. They can access the menu without creating an account. See the "Sharing
                  Menus with Customers" tutorial for more details.
                </p>
              </div>

              <div className="border-b pb-4">
                <h4 className="font-semibold mb-2">What happens when my trial ends?</h4>
                <p className="text-sm text-muted-foreground">
                  Your data is preserved when your trial ends. You'll need to upgrade to a paid
                  plan to continue using the platform. All your products, customers, and menus will
                  be waiting for you when you upgrade.
                </p>
              </div>

              <div className="pb-4">
                <h4 className="font-semibold mb-2">How is the 2% commission calculated?</h4>
                <p className="text-sm text-muted-foreground">
                  We charge a 2% platform fee on each completed order placed through customer menus.
                  This fee is automatically calculated and shown in your billing statements. You can
                  view your commission transactions in the Billing section.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Still Need Help? */}
        <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-2 border-primary">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold mb-1">Still Need Help?</h3>
                <p className="text-sm text-muted-foreground">
                  Our support team is here to help you succeed.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" asChild>
                  <a href="mailto:support@example.com">
                    <Mail className="mr-2 h-4 w-4" />
                    Email Us
                  </a>
                </Button>
                <Button>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Live Chat
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </ModernPage>
  );
}

