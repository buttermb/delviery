import { useLocation, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle, Calendar, Mail, ExternalLink } from "lucide-react";
import { SEOHead } from "@/components/SEOHead";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { showInfoToast } from "@/utils/toastHelpers";

export default function DemoConfirmation() {
  const location = useLocation();
  const formData = location.state || {
    firstName: "John",
    lastName: "Smith",
    email: "john@company.com",
    preferredDate: new Date().toISOString().split("T")[0],
    preferredTime: "2pm",
  };

  const demoDate = formData.preferredDate
    ? new Date(formData.preferredDate).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
    : "Tuesday, November 5, 2024";

  const demoTime = formData.preferredTime
    ? `${formData.preferredTime.toUpperCase()} PST`
    : "2:00 PM PST";

  return (
    <div className="min-h-dvh bg-[hsl(var(--marketing-bg))]">
      <SEOHead
        title="Demo Scheduled - FloraIQ"
        description="Your demo has been scheduled. We look forward to showing you FloraIQ."
      />

      <MarketingNav />

      <section className="container mx-auto px-4 py-20">
        <div className="max-w-2xl mx-auto text-center">
          <div className="mb-8">
            <div className="w-20 h-20 rounded-full bg-[hsl(var(--marketing-accent))]/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-12 w-12 text-[hsl(var(--marketing-accent))]" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-[hsl(var(--marketing-text))]">
              ✅ Demo Scheduled!
            </h1>
          </div>

          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Your demo is confirmed for:</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 text-2xl font-bold text-[hsl(var(--marketing-text))] mb-2">
                  <Calendar className="h-6 w-6" />
                  {demoDate} at {demoTime}
                </div>
              </div>

              <div className="border-t border-[hsl(var(--marketing-border))] pt-6">
                <p className="text-sm text-[hsl(var(--marketing-text-light))] mb-2">
                  We've sent a calendar invite to:
                </p>
                <p className="font-medium text-[hsl(var(--marketing-text))]">{formData.email}</p>
              </div>

              <div className="border-t border-[hsl(var(--marketing-border))] pt-6">
                <p className="text-sm text-[hsl(var(--marketing-text-light))] mb-2">
                  Meeting Link (will also be in email):
                </p>
                <a
                  href="https://meet.floraiq.com/demo/abc123"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[hsl(var(--marketing-primary))] hover:underline flex items-center justify-center gap-2"
                >
                  https://meet.floraiq.com/demo/abc123
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>

              <div className="border-t border-[hsl(var(--marketing-border))] pt-6">
                <p className="text-sm text-[hsl(var(--marketing-text-light))] mb-2">Your demo specialist:</p>
                <p className="font-medium text-[hsl(var(--marketing-text))]">Sarah Chen - Product Expert</p>
                <p className="text-sm text-[hsl(var(--marketing-primary))]">sarah@floraiq.com</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-6">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    // Generate .ics calendar file
                    const now = new Date();
                    const start = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Tomorrow
                    start.setHours(10, 0, 0, 0);
                    const end = new Date(start.getTime() + 30 * 60 * 1000); // 30 min

                    const formatDate = (d: Date) => {
                      return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
                    };

                    const icsContent = [
                      'BEGIN:VCALENDAR',
                      'VERSION:2.0',
                      'PRODID:-//FloraIQ//Demo//EN',
                      'BEGIN:VEVENT',
                      `UID:${Date.now()}@floraiq.com`,
                      `DTSTAMP:${formatDate(now)}`,
                      `DTSTART:${formatDate(start)}`,
                      `DTEND:${formatDate(end)}`,
                      'SUMMARY:FloraIQ Product Demo',
                      'DESCRIPTION:Product demo with Sarah Chen. Join at: https://meet.floraiq.com/demo/abc123',
                      'LOCATION:https://meet.floraiq.com/demo/abc123',
                      'ORGANIZER;CN=Sarah Chen:mailto:sarah@floraiq.com',
                      'END:VEVENT',
                      'END:VCALENDAR'
                    ].join('\r\n');

                    const blob = new Blob([icsContent], { type: 'text/calendar' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'floraiq-demo.ics';
                    a.click();
                    window.URL.revokeObjectURL(url);
                    showInfoToast("Calendar", "Calendar file downloaded");
                  }}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  Add to Calendar
                </Button>
                <Button variant="outline" className="flex-1" asChild>
                  <Link to="/demo">Reschedule</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="bg-[hsl(var(--marketing-bg-subtle))] p-6 rounded-xl mb-8">
            <p className="font-medium mb-4 text-[hsl(var(--marketing-text))]">In the meantime:</p>
            <div className="space-y-3 text-left">
              <Link to="/signup" className="block text-[hsl(var(--marketing-primary))] hover:underline">
                • Start Free Trial (no demo needed!)
              </Link>
              <Link to="/features" className="block text-[hsl(var(--marketing-primary))] hover:underline">
                • Watch Product Tour (5 min video)
              </Link>
              <Link to="/about" className="block text-[hsl(var(--marketing-primary))] hover:underline">
                • Read Customer Stories
              </Link>
            </div>
          </div>

          <Link to="/">
            <Button variant="outline">
              Back to Home
            </Button>
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}

