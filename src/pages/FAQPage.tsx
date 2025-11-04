import { useState } from 'react';
import { ModernPage } from '@/templates/ModernPageTemplate';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Search, HelpCircle } from 'lucide-react';

export default function FAQPage() {
  const [searchQuery, setSearchQuery] = useState('');

  const faqs = [
    {
      category: 'General',
      questions: [
        {
          question: 'How do I create my first order?',
          answer: 'Go to Orders → New Order, select a customer, add products, and confirm. The order will be processed and you can track it in real-time.'
        },
        {
          question: 'What payment methods do you accept?',
          answer: 'We accept credit cards, ACH transfers, and Bitcoin (coming soon). Payment terms can be customized per customer.'
        },
        {
          question: 'How do I add team members?',
          answer: 'Go to Team → User Management, click "Add User", and assign their role. You can set permissions for each team member.'
        },
        {
          question: 'Can I export my data?',
          answer: 'Yes! Go to Reports → Data Export to download your data in CSV or PDF format. You can export orders, customers, inventory, and financial reports.'
        }
      ]
    },
    {
      category: 'Inventory',
      questions: [
        {
          question: 'How do I track fronted inventory?',
          answer: 'Navigate to Fronted Inventory to see all outstanding products and payments. You can filter by customer, date, or status.'
        },
        {
          question: 'How do I manage inventory batches?',
          answer: 'Go to Inventory → Batches to create, track, and manage inventory batches. Each batch can have its own expiration date and location.'
        },
        {
          question: 'Can I set up low stock alerts?',
          answer: 'Yes! Go to Settings → Notifications to enable low stock alerts. You can set thresholds for each product.'
        }
      ]
    },
    {
      category: 'Orders & Customers',
      questions: [
        {
          question: 'How do I process a return?',
          answer: 'Go to the order details, click "Return" and select the items to return. The system will update inventory and create a credit memo.'
        },
        {
          question: 'Can I create custom pricing for customers?',
          answer: 'Yes! In customer settings, you can set custom pricing tiers, discounts, and payment terms for each customer.'
        },
        {
          question: 'How do I track delivery status?',
          answer: 'Use the Live Map feature to see real-time delivery tracking. You can also view delivery status in the order details.'
        }
      ]
    },
    {
      category: 'Reports & Analytics',
      questions: [
        {
          question: 'What reports are available?',
          answer: 'We offer sales reports, inventory reports, customer reports, financial reports, and custom reports. All can be exported to CSV or PDF.'
        },
        {
          question: 'Can I schedule automated reports?',
          answer: 'Yes! In Reports → Scheduled Reports, you can set up daily, weekly, or monthly automated reports sent to your email.'
        }
      ]
    },
    {
      category: 'Billing & Subscription',
      questions: [
        {
          question: 'How does billing work?',
          answer: 'Billing is monthly or annual based on your plan. You can upgrade, downgrade, or cancel anytime. Changes take effect at the next billing cycle.'
        },
        {
          question: 'What happens if I cancel?',
          answer: 'Your account remains active until the end of your billing period. After cancellation, your data is retained for 90 days, then permanently deleted.'
        }
      ]
    }
  ];

  const filteredFaqs = faqs.map(category => ({
    ...category,
    questions: category.questions.filter(q =>
      q.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.answer.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(category => category.questions.length > 0);

  return (
    <ModernPage
      title="Frequently Asked Questions"
      description="Find answers to common questions about BigMike Wholesale"
      backButton
    >
      <div className="space-y-6">
        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search FAQs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* FAQs by Category */}
        {filteredFaqs.length > 0 ? (
          <div className="space-y-6">
            {filteredFaqs.map((category, categoryIndex) => (
              <Card key={categoryIndex}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-4">
                    <HelpCircle className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold text-lg">{category.category}</h3>
                  </div>
                  <Accordion type="single" collapsible className="space-y-2">
                    {category.questions.map((faq, index) => (
                      <AccordionItem
                        key={index}
                        value={`item-${categoryIndex}-${index}`}
                        className="border rounded-lg px-4"
                      >
                        <AccordionTrigger className="text-left hover:no-underline">
                          <span className="font-medium">{faq.question}</span>
                        </AccordionTrigger>
                        <AccordionContent className="text-sm text-muted-foreground pt-2">
                          {faq.answer}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="pt-6 text-center py-12">
              <p className="text-muted-foreground">No FAQs found matching your search.</p>
            </CardContent>
          </Card>
        )}

        {/* Still Need Help */}
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <h3 className="font-semibold text-lg">Still have questions?</h3>
              <p className="text-sm text-muted-foreground">
                Our support team is here to help. Contact us via email, phone, or live chat.
              </p>
              <div className="flex flex-wrap gap-4 justify-center text-sm">
                <a href="/support" className="text-primary hover:underline">Contact Support</a>
                <span className="text-muted-foreground">•</span>
                <a href="/contact" className="text-primary hover:underline">Contact Us</a>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </ModernPage>
  );
}

