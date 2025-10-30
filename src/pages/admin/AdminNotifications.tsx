import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send, Mail, MessageSquare, Loader2 } from "lucide-react";

const AdminNotifications = () => {
  const [smsLoading, setSmsLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  
  const [smsData, setSmsData] = useState({
    phone: "",
    message: ""
  });
  
  const [emailData, setEmailData] = useState({
    to: "",
    subject: "",
    html: "",
    text: ""
  });

  const handleTestSms = async () => {
    if (!smsData.phone || !smsData.message) {
      toast.error("Phone number and message are required");
      return;
    }

    setSmsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-klaviyo-sms', {
        body: {
          phone: smsData.phone,
          message: smsData.message,
          metadata: {
            test: true,
            timestamp: new Date().toISOString()
          }
        }
      });

      if (error) throw error;

      toast.success("SMS sent successfully!", {
        description: `Message ID: ${data.messageId || 'N/A'}`
      });
      
      // Clear form
      setSmsData({ phone: "", message: "" });
    } catch (error: any) {
      console.error("SMS send error:", error);
      toast.error("Failed to send SMS", {
        description: error.message || "Unknown error occurred"
      });
    } finally {
      setSmsLoading(false);
    }
  };

  const handleTestEmail = async () => {
    if (!emailData.to || !emailData.subject || (!emailData.html && !emailData.text)) {
      toast.error("Email, subject, and content are required");
      return;
    }

    setEmailLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-klaviyo-email', {
        body: {
          to: emailData.to,
          subject: emailData.subject,
          html: emailData.html,
          text: emailData.text,
          fromEmail: 'noreply@nymdelivery.com',
          fromName: 'NYM Delivery',
          metadata: {
            test: true,
            timestamp: new Date().toISOString()
          }
        }
      });

      if (error) throw error;

      toast.success("Email sent successfully!", {
        description: `Message ID: ${data.messageId || 'N/A'}`
      });
      
      // Clear form
      setEmailData({ to: "", subject: "", html: "", text: "" });
    } catch (error: any) {
      console.error("Email send error:", error);
      toast.error("Failed to send email", {
        description: error.message || "Unknown error occurred"
      });
    } finally {
      setEmailLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Test Notifications</h1>
        <p className="text-muted-foreground">
          Test SMS and email notifications using Klaviyo integration
        </p>
      </div>

      <Tabs defaultValue="sms" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="sms" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            SMS
          </TabsTrigger>
          <TabsTrigger value="email" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Email
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sms">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Test SMS Message
              </CardTitle>
              <CardDescription>
                Send a test SMS using Klaviyo API
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  placeholder="+1234567890"
                  value={smsData.phone}
                  onChange={(e) => setSmsData({ ...smsData, phone: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Include country code (e.g., +1 for US)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  placeholder="Your test message here..."
                  rows={5}
                  value={smsData.message}
                  onChange={(e) => setSmsData({ ...smsData, message: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  {smsData.message.length} characters
                </p>
              </div>

              <Button 
                onClick={handleTestSms} 
                disabled={smsLoading}
                className="w-full"
              >
                {smsLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Test SMS
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Test Email
              </CardTitle>
              <CardDescription>
                Send a test email using Klaviyo API
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="to">To Email</Label>
                <Input
                  id="to"
                  type="email"
                  placeholder="recipient@example.com"
                  value={emailData.to}
                  onChange={(e) => setEmailData({ ...emailData, to: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  placeholder="Test Email Subject"
                  value={emailData.subject}
                  onChange={(e) => setEmailData({ ...emailData, subject: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="html">HTML Content</Label>
                <Textarea
                  id="html"
                  placeholder="<h1>Hello</h1><p>This is a test email.</p>"
                  rows={5}
                  value={emailData.html}
                  onChange={(e) => setEmailData({ ...emailData, html: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Optional: Leave blank to use text-only email
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="text">Plain Text Content</Label>
                <Textarea
                  id="text"
                  placeholder="Hello, this is a test email."
                  rows={5}
                  value={emailData.text}
                  onChange={(e) => setEmailData({ ...emailData, text: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Fallback for email clients that don't support HTML
                </p>
              </div>

              <Button 
                onClick={handleTestEmail} 
                disabled={emailLoading}
                className="w-full"
              >
                {emailLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Test Email
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminNotifications;
