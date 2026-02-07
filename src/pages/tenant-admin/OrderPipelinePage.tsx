/**
 * Order Pipeline Page
 * Full-screen view for the order status pipeline board
 */

import { OrderPipelineBoard } from '@/components/tenant-admin/OrderPipelineBoard';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

export default function OrderPipelinePage() {
    const navigate = useNavigate();
    const { tenantSlug } = useParams<{ tenantSlug: string }>();

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] p-4 md:p-6 space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate(`/${tenantSlug}/admin/wholesale-orders`)}
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold">Order Pipeline</h1>
                        <p className="text-sm text-muted-foreground">
                            Drag and drop orders to update status
                        </p>
                    </div>
                </div>
                <Button onClick={() => navigate(`/${tenantSlug}/admin/wholesale-orders/new`)}>
                    <Plus className="h-4 w-4 mr-2" />
                    New Order
                </Button>
            </div>

            <OrderPipelineBoard />
        </div>
    );
}
