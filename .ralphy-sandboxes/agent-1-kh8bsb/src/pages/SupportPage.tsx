import { useState } from 'react';
import { ModernPage } from '@/templates/ModernPageTemplate';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  MessageSquare,
  Phone,
  Mail,
  Clock,
  HelpCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function SupportPage() {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    orderNumber: '',
    message: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: 'Message sent!',
      description: "We'll respond within 24 hours.",
    });
    setFormData({ name: '', email: '', orderNumber: '', message: '' });
  };

  const faqs = [
    {
      question: 'What are your support hours?',
      answer: 'Live chat is available 24/7. Phone support is available Monday-Friday 9am-6pm EST. Email support responds within 24 hours.'
    },
    {
      question: 'How do I track my order?',
      answer: 'After placing your order, you will receive a tracking link via email and SMS. You can also track on our Track Order page using your order number.'
    },
    {
      question: 'What payment methods do you accept?',
      answer: 'We accept all major credit cards, debit cards, and digital payment methods. Payment terms can be customized per customer.'
    },
    {
      question: 'How do I reset my password?',
      answer: 'Go to the login page and click "Forgot Password". Enter your email and you will receive a reset link within a few minutes.'
    }
  ];

  return (
    <ModernPage
      title="Support"
      description="Get help with using FloraIQ"
      backButton
      showLogo
    >
      <div className="space-y-6">
        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow">
            <CardContent className="pt-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto">
                <MessageSquare className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold">Live Chat</h3>
              <p className="text-sm text-muted-foreground">Chat with our team</p>
              <Button className="w-full">Start Chat</Button>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-lg transition-shadow">
            <CardContent className="pt-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center mx-auto">
                <Phone className="h-6 w-6 text-blue-500" />
              </div>
              <h3 className="font-semibold">Phone Support</h3>
              <p className="text-sm text-muted-foreground">(555) 123-4567</p>
              <Button variant="outline" className="w-full" asChild>
                <a href="tel:5551234567">Call Us</a>
              </Button>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-lg transition-shadow">
            <CardContent className="pt-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center mx-auto">
                <Mail className="h-6 w-6 text-green-500" />
              </div>
              <h3 className="font-semibold">Email Support</h3>
              <p className="text-sm text-muted-foreground">support@floraiq.com</p>
              <Button variant="outline" className="w-full" asChild>
                <a href="mailto:support@floraiq.com">Send Email</a>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Contact Form and Support Hours */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Contact Form */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h3 className="font-semibold text-lg mb-4">Send us a message</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="orderNumber">Order Number (optional)</Label>
                  <Input
                    id="orderNumber"
                    placeholder="ORD-20250130-XXXX"
                    value={formData.orderNumber}
                    onChange={(e) => setFormData({ ...formData, orderNumber: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    rows={5}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    required
                  />
                </div>
                <Button type="submit" className="w-full">Send Message</Button>
              </form>
            </CardContent>
          </Card>

          {/* Support Hours */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <Clock className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-lg">Support Hours</h3>
              </div>
              <div className="space-y-4 text-sm">
                <div>
                  <p className="font-medium">Live Chat</p>
                  <p className="text-muted-foreground">24/7</p>
                </div>
                <div>
                  <p className="font-medium">Phone Support</p>
                  <p className="text-muted-foreground">Mon-Fri 9am-6pm EST</p>
                </div>
                <div>
                  <p className="font-medium">Email Support</p>
                  <p className="text-muted-foreground">Response within 24 hours</p>
                </div>
                <div>
                  <p className="font-medium">Emergency Support</p>
                  <p className="text-muted-foreground">Call (555) 911-HELP for urgent issues</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* FAQs */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-4">
              <HelpCircle className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-lg">Common Questions</h3>
            </div>
            <div className="space-y-4">
              {faqs.map((faq, index) => (
                <div key={index} className="border-b pb-4 last:border-0">
                  <p className="font-medium mb-2">{faq.question}</p>
                  <p className="text-sm text-muted-foreground">{faq.answer}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </ModernPage>
  );
}

