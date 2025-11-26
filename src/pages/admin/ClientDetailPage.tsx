import { useParams, useNavigate } from 'react-router-dom';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { useClient } from '@/hooks/crm/useClients';
import { useClientInvoices } from '@/hooks/crm/useInvoices';
import { useClientPreOrders } from '@/hooks/crm/usePreOrders';
import { NotesPanel } from '@/components/crm/NotesPanel';
import { MessagesThread } from '@/components/crm/MessagesThread';
import { ActivityTimeline } from '@/components/crm/ActivityTimeline';
import { EditClientDialog } from '@/components/crm/EditClientDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
    Loader2,
    ArrowLeft,
    Mail,
    Phone,
    ExternalLink,
    Copy,
    FileText,
    Receipt,
    DollarSign
} from 'lucide-react';
import { formatCurrency } from '@/utils/formatters';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { SwipeBackWrapper } from '@/components/mobile/SwipeBackWrapper';

export default function ClientDetailPage() {
    const { clientId } = useParams<{ clientId: string }>();
    const navigate = useNavigate();
    const { navigateToAdmin, buildAdminUrl } = useTenantNavigation();
    const { data: client, isLoading } = useClient(clientId);
    const { data: invoices } = useClientInvoices(clientId);
    const { data: preOrders } = useClientPreOrders(clientId);

    if (isLoading) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    if (!client) {
        return (
            <div className="container mx-auto py-8 text-center">
                <h2 className="text-2xl font-bold">Client not found</h2>
                <Button onClick={() => navigateToAdmin('crm/clients')} className="mt-4">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Clients
                </Button>
            </div>
        );
    }

    const copyPortalLink = () => {
        // In a real app, this would be a real URL
        const link = `${window.location.origin}/portal/login?email=${encodeURIComponent(client.email || '')}`;
        navigator.clipboard.writeText(link);
        toast.success('Portal link copied to clipboard');
    };

    return (
        <SwipeBackWrapper onBack={() => navigateToAdmin('crm/clients')}>
            <div className="container mx-auto py-8 space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => navigateToAdmin('crm/clients')}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                                {client.name}
                                <Badge variant={client.status === 'active' ? 'default' : 'secondary'}>
                                    {client.status}
                                </Badge>
                            </h1>
                            <div className="flex items-center gap-4 text-muted-foreground mt-1">
                                {client.email && (
                                    <div className="flex items-center gap-1 text-sm">
                                        <Mail className="h-3 w-3" />
                                        {client.email}
                                    </div>
                                )}
                                {client.phone && (
                                    <div className="flex items-center gap-1 text-sm">
                                        <Phone className="h-3 w-3" />
                                        {client.phone}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={copyPortalLink}>
                            <Copy className="mr-2 h-4 w-4" />
                            Copy Portal Link
                        </Button>
                        <EditClientDialog client={client} />
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Open Balance</CardTitle>
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className={`text-2xl font-bold ${client.open_balance > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                {formatCurrency(client.open_balance)}
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
                            <Receipt className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{invoices?.length || 0}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Active Pre-Orders</CardTitle>
                            <FileText className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {preOrders?.filter(p => p.status === 'pending').length || 0}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Main Content Tabs */}
                <Tabs defaultValue="invoices" className="space-y-4">
                    <TabsList>
                        <TabsTrigger value="invoices">Invoices</TabsTrigger>
                        <TabsTrigger value="pre-orders">Pre-Orders</TabsTrigger>
                        <TabsTrigger value="notes">Notes</TabsTrigger>
                        <TabsTrigger value="messages">Messages</TabsTrigger>
                        <TabsTrigger value="history">History</TabsTrigger>
                    </TabsList>

                    <TabsContent value="invoices" className="space-y-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle>Invoices</CardTitle>
                                <Button size="sm" onClick={() => navigateToAdmin('crm/invoices/new')}>
                                    Create Invoice
                                </Button>
                            </CardHeader>
                            <CardContent>
                                {invoices?.length === 0 ? (
                                    <p className="text-center text-muted-foreground py-8">No invoices found.</p>
                                ) : (
                                    <div className="space-y-4">
                                        {invoices?.map((invoice) => (
                                            <div
                                                key={invoice.id}
                                                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer"
                                                onClick={() => navigateToAdmin(`crm/invoices/${invoice.id}`)}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center">
                                                        <Receipt className="h-5 w-5 text-primary" />
                                                    </div>
                                                    <div>
                                                        <div className="font-medium">{invoice.invoice_number}</div>
                                                        <div className="text-sm text-muted-foreground">
                                                            {format(new Date(invoice.invoice_date), 'MMM d, yyyy')}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <Badge variant={
                                                        invoice.status === 'paid' ? 'default' :
                                                            invoice.status === 'overdue' ? 'destructive' :
                                                                'secondary'
                                                    }>
                                                        {invoice.status}
                                                    </Badge>
                                                    <div className="font-bold w-24 text-right">
                                                        {formatCurrency(invoice.total)}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="pre-orders" className="space-y-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle>Pre-Orders</CardTitle>
                                <Button size="sm" onClick={() => navigateToAdmin('crm/pre-orders/new')}>
                                    Create Pre-Order
                                </Button>
                            </CardHeader>
                            <CardContent>
                                {preOrders?.length === 0 ? (
                                    <p className="text-center text-muted-foreground py-8">No pre-orders found.</p>
                                ) : (
                                    <div className="space-y-4">
                                        {preOrders?.map((po) => (
                                            <div
                                                key={po.id}
                                                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer"
                                                onClick={() => navigateToAdmin(`crm/pre-orders/${po.id}`)}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="h-10 w-10 rounded bg-purple-100 flex items-center justify-center">
                                                        <FileText className="h-5 w-5 text-purple-600" />
                                                    </div>
                                                    <div>
                                                        <div className="font-medium">{po.pre_order_number}</div>
                                                        <div className="text-sm text-muted-foreground">
                                                            {format(new Date(po.created_at), 'MMM d, yyyy')}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <Badge variant={
                                                        po.status === 'converted' ? 'default' :
                                                            po.status === 'cancelled' ? 'destructive' :
                                                                'outline'
                                                    }>
                                                        {po.status}
                                                    </Badge>
                                                    <div className="font-bold w-24 text-right">
                                                        {formatCurrency(po.total)}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="notes">
                        <NotesPanel clientId={client.id} />
                    </TabsContent>

                    <TabsContent value="messages">
                        <MessagesThread clientId={client.id} />
                    </TabsContent>

                    <TabsContent value="history">
                        <ActivityTimeline clientId={client.id} />
                    </TabsContent>
                </Tabs>
            </div>
        </SwipeBackWrapper>
    );
}
