/**
 * Help Hub Page
 * Consolidated help center with tabs:
 * - Getting Started: Onboarding and tutorials
 * - Documentation: Guides and FAQs
 * - Support: Submit tickets, contact support
 * - Feedback: Report bugs, request features
 */

import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    PlayCircle,
    BookOpen,
    Headphones,
    MessageSquareText,
    CheckCircle2,
    Video,
    HelpCircle,
    Mail,
    MessageSquare,
    Bug,
    Lightbulb,
    ExternalLink,
} from 'lucide-react';
import { lazy, Suspense, useCallback, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

const TabSkeleton = () => (
    <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64 w-full" />
    </div>
);

const tabs = [
    // Learning
    { id: 'getting-started', label: 'Start', icon: PlayCircle, group: 'Learning' },
    { id: 'docs', label: 'Docs', icon: BookOpen, group: 'Learning' },
    // Support
    { id: 'support', label: 'Support', icon: Headphones, group: 'Support' },
    { id: 'feedback', label: 'Feedback', icon: MessageSquareText, group: 'Support' },
] as const;

type TabId = typeof tabs[number]['id'];

// Onboarding checklist items
const onboardingSteps = [
    { id: 'profile', label: 'Complete your business profile', completed: true },
    { id: 'products', label: 'Add your first products', completed: true },
    { id: 'menu', label: 'Create a menu', completed: false },
    { id: 'storefront', label: 'Set up your storefront', completed: false },
    { id: 'payment', label: 'Configure payment methods', completed: false },
    { id: 'first-order', label: 'Process your first order', completed: false },
];

// Video tutorials
const tutorials = [
    {
        id: 'import-products',
        title: 'How to Import Products',
        description: 'Learn how to bulk import products from CSV',
        duration: '2 min',
        category: 'Getting Started',
    },
    {
        id: 'create-menu',
        title: 'Creating Your First Menu',
        description: 'Step-by-step guide to menu creation',
        duration: '1.5 min',
        category: 'Getting Started',
    },
    {
        id: 'manage-orders',
        title: 'Managing Orders',
        description: 'Process, fulfill, and track orders',
        duration: '3 min',
        category: 'Orders',
    },
    {
        id: 'analytics',
        title: 'Understanding Analytics',
        description: 'Make data-driven decisions',
        duration: '4 min',
        category: 'Analytics',
    },
];

// FAQ items
const faqs = [
    {
        question: 'How do I add products to my inventory?',
        answer: 'You can add products individually through the Products page or import multiple products at once using a CSV file.',
    },
    {
        question: 'How do I share a menu with customers?',
        answer: 'After creating a menu, you\'ll receive a unique link that you can share. Customers can access it without creating an account.',
    },
    {
        question: 'What happens when my trial ends?',
        answer: 'Your data is preserved when your trial ends. Upgrade to a paid plan to continue using the platform.',
    },
    {
        question: 'How is the platform fee calculated?',
        answer: 'We charge a small platform fee on completed orders. View your transactions in the Billing section.',
    },
];

export default function HelpHubPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = (searchParams.get('tab') as TabId) || 'getting-started';
    const { toast } = useToast();
    const [feedbackType, setFeedbackType] = useState<'bug' | 'feature'>('feature');
    const [feedbackText, setFeedbackText] = useState('');
    const [ticketSubject, setTicketSubject] = useState('');
    const [ticketMessage, setTicketMessage] = useState('');

    const handleTabChange = useCallback((tab: string) => {
        setSearchParams({ tab });
    }, [setSearchParams]);

    const completedSteps = onboardingSteps.filter(s => s.completed).length;
    const progressPercentage = (completedSteps / onboardingSteps.length) * 100;

    const handleSubmitTicket = () => {
        toast({
            title: 'Ticket Submitted',
            description: 'We\'ll get back to you within 24 hours.',
        });
        setTicketSubject('');
        setTicketMessage('');
    };

    const handleSubmitFeedback = () => {
        toast({
            title: feedbackType === 'bug' ? 'Bug Report Submitted' : 'Feature Request Submitted',
            description: 'Thank you for your feedback!',
        });
        setFeedbackText('');
    };

    return (
        <div className="min-h-screen bg-background">
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                {/* Header */}
                <div className="border-b bg-card px-4 py-4">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-2xl font-bold">Help Center</h1>
                            <p className="text-muted-foreground text-sm">
                                Tutorials, documentation, and support resources
                            </p>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <TabsList className="inline-flex min-w-max gap-0.5">
                            {tabs.map((tab, index) => {
                                const prevTab = index > 0 ? tabs[index - 1] : null;
                                const showSeparator = prevTab && prevTab.group !== tab.group;
                                return (
                                    <>
                                        {showSeparator && (
                                            <div key={`sep-${index}`} className="w-px h-6 bg-border mx-1" />
                                        )}
                                        <TabsTrigger key={tab.id} value={tab.id} className="flex items-center gap-2">
                                            <tab.icon className="h-4 w-4" />
                                            <span className="hidden sm:inline">{tab.label}</span>
                                        </TabsTrigger>
                                    </>
                                );
                            })}
                        </TabsList>
                    </div>
                </div>

                {/* Getting Started Tab */}
                <TabsContent value="getting-started" className="m-0 p-6">
                    <div className="space-y-6">
                        {/* Onboarding Progress */}
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle>Setup Checklist</CardTitle>
                                        <CardDescription>Complete these steps to get started</CardDescription>
                                    </div>
                                    <Badge variant={progressPercentage === 100 ? 'default' : 'secondary'}>
                                        {completedSteps}/{onboardingSteps.length} complete
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <Progress value={progressPercentage} className="mb-4" />
                                <div className="space-y-3">
                                    {onboardingSteps.map((step) => (
                                        <div
                                            key={step.id}
                                            className={`flex items-center gap-3 p-3 rounded-lg border ${step.completed ? 'bg-primary/5 border-primary/20' : 'bg-muted/50'
                                                }`}
                                        >
                                            <CheckCircle2
                                                className={`h-5 w-5 ${step.completed ? 'text-primary' : 'text-muted-foreground'
                                                    }`}
                                            />
                                            <span className={step.completed ? 'line-through text-muted-foreground' : ''}>
                                                {step.label}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Video Tutorials */}
                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-2">
                                    <Video className="h-5 w-5 text-primary" />
                                    <CardTitle>Video Tutorials</CardTitle>
                                </div>
                                <CardDescription>Quick video guides to help you get started</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    {tutorials.map((tutorial) => (
                                        <Card key={tutorial.id} className="cursor-pointer hover:shadow-md transition-shadow">
                                            <div className="aspect-video bg-muted rounded-t-lg flex items-center justify-center">
                                                <PlayCircle className="h-12 w-12 text-muted-foreground" />
                                            </div>
                                            <CardContent className="pt-4">
                                                <div className="flex items-start justify-between mb-1">
                                                    <h4 className="font-medium text-sm">{tutorial.title}</h4>
                                                    <Badge variant="outline" className="text-xs">
                                                        {tutorial.duration}
                                                    </Badge>
                                                </div>
                                                <p className="text-xs text-muted-foreground">{tutorial.description}</p>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Documentation Tab */}
                <TabsContent value="docs" className="m-0 p-6">
                    <div className="space-y-6">
                        {/* Quick Links */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Card className="hover:shadow-md transition-shadow cursor-pointer">
                                <CardContent className="pt-6">
                                    <div className="flex items-center gap-3 mb-2">
                                        <BookOpen className="h-6 w-6 text-primary" />
                                        <h3 className="font-semibold">User Guide</h3>
                                    </div>
                                    <p className="text-sm text-muted-foreground mb-4">
                                        Complete documentation for all features
                                    </p>
                                    <Button variant="outline" className="w-full">
                                        <ExternalLink className="h-4 w-4 mr-2" />
                                        View Guide
                                    </Button>
                                </CardContent>
                            </Card>

                            <Card className="hover:shadow-md transition-shadow cursor-pointer">
                                <CardContent className="pt-6">
                                    <div className="flex items-center gap-3 mb-2">
                                        <HelpCircle className="h-6 w-6 text-primary" />
                                        <h3 className="font-semibold">API Reference</h3>
                                    </div>
                                    <p className="text-sm text-muted-foreground mb-4">
                                        Technical documentation for developers
                                    </p>
                                    <Button variant="outline" className="w-full">
                                        <ExternalLink className="h-4 w-4 mr-2" />
                                        View API Docs
                                    </Button>
                                </CardContent>
                            </Card>

                            <Card className="hover:shadow-md transition-shadow cursor-pointer">
                                <CardContent className="pt-6">
                                    <div className="flex items-center gap-3 mb-2">
                                        <Video className="h-6 w-6 text-primary" />
                                        <h3 className="font-semibold">Video Library</h3>
                                    </div>
                                    <p className="text-sm text-muted-foreground mb-4">
                                        All tutorial videos in one place
                                    </p>
                                    <Button variant="outline" className="w-full">
                                        <ExternalLink className="h-4 w-4 mr-2" />
                                        Watch Videos
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>

                        {/* FAQs */}
                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-2">
                                    <HelpCircle className="h-5 w-5 text-primary" />
                                    <CardTitle>Frequently Asked Questions</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {faqs.map((faq, index) => (
                                        <div key={index} className="border-b pb-4 last:border-0 last:pb-0">
                                            <h4 className="font-semibold mb-2">{faq.question}</h4>
                                            <p className="text-sm text-muted-foreground">{faq.answer}</p>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Support Tab */}
                <TabsContent value="support" className="m-0 p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Submit Ticket */}
                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-2">
                                    <Headphones className="h-5 w-5 text-primary" />
                                    <CardTitle>Submit a Ticket</CardTitle>
                                </div>
                                <CardDescription>We'll respond within 24 hours</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="subject">Subject</Label>
                                    <Input
                                        id="subject"
                                        placeholder="Brief description of your issue"
                                        value={ticketSubject}
                                        onChange={(e) => setTicketSubject(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="message">Message</Label>
                                    <Textarea
                                        id="message"
                                        placeholder="Describe your issue in detail..."
                                        rows={5}
                                        value={ticketMessage}
                                        onChange={(e) => setTicketMessage(e.target.value)}
                                    />
                                </div>
                                <Button onClick={handleSubmitTicket} className="w-full">
                                    Submit Ticket
                                </Button>
                            </CardContent>
                        </Card>

                        {/* Contact Options */}
                        <div className="space-y-4">
                            <Card className="hover:shadow-md transition-shadow">
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

                            <Card className="hover:shadow-md transition-shadow">
                                <CardContent className="pt-6">
                                    <div className="flex items-center gap-3 mb-2">
                                        <Mail className="h-6 w-6 text-primary" />
                                        <h3 className="font-semibold">Email Support</h3>
                                    </div>
                                    <p className="text-sm text-muted-foreground mb-4">
                                        support@example.com
                                    </p>
                                    <Button variant="outline" className="w-full" asChild>
                                        <a href="mailto:support@example.com">Send Email</a>
                                    </Button>
                                </CardContent>
                            </Card>

                            <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
                                <CardContent className="pt-6">
                                    <div className="flex items-center gap-3 mb-2">
                                        <Headphones className="h-6 w-6 text-primary" />
                                        <h3 className="font-semibold">Priority Support</h3>
                                        <Badge>Enterprise</Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground mb-4">
                                        Dedicated support with 1-hour response time
                                    </p>
                                    <Button className="w-full">
                                        Upgrade to Enterprise
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                {/* Feedback Tab */}
                <TabsContent value="feedback" className="m-0 p-6">
                    <div className="max-w-2xl mx-auto space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Share Your Feedback</CardTitle>
                                <CardDescription>Help us improve by reporting bugs or requesting features</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex gap-2">
                                    <Button
                                        variant={feedbackType === 'bug' ? 'default' : 'outline'}
                                        onClick={() => setFeedbackType('bug')}
                                        className="flex-1"
                                    >
                                        <Bug className="h-4 w-4 mr-2" />
                                        Report Bug
                                    </Button>
                                    <Button
                                        variant={feedbackType === 'feature' ? 'default' : 'outline'}
                                        onClick={() => setFeedbackType('feature')}
                                        className="flex-1"
                                    >
                                        <Lightbulb className="h-4 w-4 mr-2" />
                                        Request Feature
                                    </Button>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="feedback">
                                        {feedbackType === 'bug' ? 'Describe the bug' : 'Describe your feature idea'}
                                    </Label>
                                    <Textarea
                                        id="feedback"
                                        placeholder={
                                            feedbackType === 'bug'
                                                ? 'What happened? What did you expect to happen?'
                                                : 'What feature would you like to see? How would it help you?'
                                        }
                                        rows={6}
                                        value={feedbackText}
                                        onChange={(e) => setFeedbackText(e.target.value)}
                                    />
                                </div>

                                <Button onClick={handleSubmitFeedback} className="w-full">
                                    Submit {feedbackType === 'bug' ? 'Bug Report' : 'Feature Request'}
                                </Button>
                            </CardContent>
                        </Card>

                        <Card className="bg-muted/50">
                            <CardContent className="pt-6">
                                <div className="text-center">
                                    <h3 className="font-semibold mb-2">Thank you for your feedback!</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Your input helps us build a better product for everyone.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
