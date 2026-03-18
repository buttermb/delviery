/**
 * Reviews Admin Page
 * Main page for managing product reviews
 */

import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { ReviewModerationQueue } from '@/components/reviews/ReviewModerationQueue';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare } from 'lucide-react';

export default function ReviewsPage() {
    const { tenant } = useTenantAdminAuth();

    if (!tenant) {
        return <EnhancedLoadingState variant="card" message="Loading reviews..." />;
    }

    return (
        <div className="container mx-auto p-4 space-y-4">
            {/* Header */}
            <div>
                <div className="flex items-center gap-3 mb-2">
                    <MessageSquare className="w-8 h-8" />
                    <h1 className="text-xl font-bold">Product Reviews</h1>
                </div>
                <p className="text-muted-foreground">
                    Manage customer reviews and feedback for your products
                </p>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="all" className="space-y-6">
                <TabsList>
                    <TabsTrigger value="all">All Reviews</TabsTrigger>
                    <TabsTrigger value="pending">Pending</TabsTrigger>
                    <TabsTrigger value="approved">Approved</TabsTrigger>
                    <TabsTrigger value="rejected">Rejected</TabsTrigger>
                </TabsList>

                <TabsContent value="all">
                    <ReviewModerationQueue tenantId={tenant.id} />
                </TabsContent>

                <TabsContent value="pending">
                    <ReviewModerationQueue tenantId={tenant.id} />
                </TabsContent>

                <TabsContent value="approved">
                    <ReviewModerationQueue tenantId={tenant.id} />
                </TabsContent>

                <TabsContent value="rejected">
                    <ReviewModerationQueue tenantId={tenant.id} />
                </TabsContent>
            </Tabs>

            {/* Guidelines Card */}
            <Card>
                <CardHeader>
                    <CardTitle>Review Guidelines</CardTitle>
                    <CardDescription>Best practices for managing customer reviews</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                    <div>
                        <strong>Approve reviews that:</strong>
                        <ul className="list-disc list-inside ml-4 mt-1 text-muted-foreground">
                            <li>Provide genuine feedback about the product</li>
                            <li>Are respectful and professional</li>
                            <li>Help other customers make informed decisions</li>
                        </ul>
                    </div>
                    <div>
                        <strong>Reject reviews that:</strong>
                        <ul className="list-disc list-inside ml-4 mt-1 text-muted-foreground">
                            <li>Contain spam or promotional content</li>
                            <li>Include offensive language or personal attacks</li>
                            <li>Are not relevant to the product</li>
                            <li>Violate our community guidelines</li>
                        </ul>
                    </div>
                    <div>
                        <strong>Responding to reviews:</strong>
                        <ul className="list-disc list-inside ml-4 mt-1 text-muted-foreground">
                            <li>Thank customers for positive feedback</li>
                            <li>Address concerns professionally and promptly</li>
                            <li>Provide helpful information or solutions</li>
                            <li>Keep responses concise and friendly</li>
                        </ul>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
