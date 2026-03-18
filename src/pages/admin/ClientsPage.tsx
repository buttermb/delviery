import { useCallback, useState, useEffect } from 'react';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { useClients } from '@/hooks/crm/useClients';
import { CreateClientDialog } from '@/components/crm/CreateClientDialog';
import { Button } from '@/components/ui/button';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { User, Phone, Mail, DollarSign, Users, Plus, AlertCircle, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { ResponsiveTable, ResponsiveColumn } from '@/components/shared/ResponsiveTable';
import { SearchInput } from '@/components/shared/SearchInput';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { sanitizeSearchInput } from '@/lib/utils/searchSanitize';
import { toast } from 'sonner';
import { ExportButton } from '@/components/ui/ExportButton';

interface Client {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    open_balance: number;
    status: string;
}

interface ClientFilters {
    q: string;
    status: string;
    [key: string]: unknown;
}

const CLIENTS_FILTER_CONFIG: Array<{ key: keyof ClientFilters; defaultValue: string }> = [
    { key: 'q', defaultValue: '' },
    { key: 'status', defaultValue: 'active' },
];

function ClientsPageSkeleton() {
    return (
        <div className="container mx-auto py-4 sm:py-8 px-4 sm:px-4 space-y-4 sm:space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
                <div className="space-y-2">
                    <Skeleton className="h-7 sm:h-9 w-32 sm:w-40" />
                    <Skeleton className="h-4 w-56 sm:w-72" />
                </div>
                <Skeleton className="h-10 w-full sm:w-32" />
            </div>
            {/* Search and filter controls */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center justify-between">
                <Skeleton className="h-10 w-full sm:w-96" />
                <Skeleton className="h-10 w-full sm:w-[180px]" />
            </div>
            {/* Table skeleton */}
            <div className="border rounded-lg">
                {/* Table header */}
                <div className="hidden md:grid grid-cols-5 gap-4 p-4 border-b bg-muted/50">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-16 ml-auto" />
                </div>
                {/* Table rows */}
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="hidden md:grid grid-cols-5 gap-4 p-4 border-b last:border-b-0 items-center">
                        <div className="flex items-center gap-3">
                            <Skeleton className="h-10 w-10 rounded-full" />
                            <Skeleton className="h-4 w-28" />
                        </div>
                        <div className="flex flex-col gap-1">
                            <Skeleton className="h-3 w-36" />
                            <Skeleton className="h-3 w-24" />
                        </div>
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-5 w-16 rounded-full" />
                        <Skeleton className="h-8 w-24 ml-auto" />
                    </div>
                ))}
                {/* Mobile card skeletons */}
                <div className="md:hidden space-y-4 p-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="border rounded-lg p-4 space-y-3">
                            <div className="flex items-center gap-3">
                                <Skeleton className="h-10 w-10 rounded-full" />
                                <div className="space-y-1">
                                    <Skeleton className="h-4 w-28" />
                                    <Skeleton className="h-5 w-16 rounded-full" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Skeleton className="h-3 w-40" />
                                <Skeleton className="h-3 w-28" />
                            </div>
                            <div className="pt-2 border-t flex items-center justify-between">
                                <Skeleton className="h-4 w-20" />
                                <Skeleton className="h-8 w-24" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default function ClientsPage() {
    const { navigateToAdmin } = useTenantNavigation();
    const { tenant } = useTenantAdminAuth();
    const queryClient = useQueryClient();

    // Filter state — persisted in URL for back-button & navigation support
    const [filters, setFilters] = useUrlFilters<ClientFilters>(CLIENTS_FILTER_CONFIG);
    const searchTerm = sanitizeSearchInput(filters.q);
    const statusFilter = (filters.status || 'active') as 'active' | 'archived';

    // Bulk selection state
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

    // Prefetch client detail on hover
    const handlePrefetchClient = useCallback((clientId: string) => {
        queryClient.prefetchQuery({
            queryKey: queryKeys.crm.clients.detail(clientId),
            queryFn: async () => {
                const { data, error } = await supabase
                    .from('crm_clients')
                    .select('*')
                    .eq('id', clientId)
                    .maybeSingle();

                if (error) {
                    logger.error('Failed to prefetch client', { error, clientId });
                    throw error;
                }
                return data;
            },
            staleTime: 30_000,
            retry: 2,
        });
    }, [queryClient]);

    const handleSearchChange = useCallback((v: string) => setFilters({ q: v }), [setFilters]);
    const handleStatusFilterChange = useCallback((v: string) => setFilters({ status: v }), [setFilters]);

    const { data: clients, isLoading, isError, isFetching, refetch } = useClients(statusFilter);

    // Clear selection on page/filter change
    useEffect(() => {
        setSelectedIds(new Set());
    }, [searchTerm, statusFilter]);

    if (isLoading && !clients) {
        return <ClientsPageSkeleton />;
    }

    if (isError) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center">
                <AlertCircle className="h-8 w-8 text-destructive mb-2" />
                <p className="text-sm text-muted-foreground">Failed to load clients. Please try again.</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>
                    Retry
                </Button>
            </div>
        );
    }

    const filteredClients = clients?.filter(client =>
        client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (client.email && client.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (client.phone && client.phone.includes(searchTerm))
    ) ?? [];

    // Bulk actions
    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(new Set(filteredClients.map(c => c.id)));
        } else {
            setSelectedIds(new Set());
        }
    };

    const handleSelectClient = (id: string, checked: boolean) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (checked) {
                newSet.add(id);
            } else {
                newSet.delete(id);
            }
            return newSet;
        });
    };

    const bulkDeleteMutation = useMutation({
        mutationFn: async (ids: string[]) => {
            if (!tenant?.id) throw new Error('Tenant required');
            const { error } = await supabase
                .from('crm_clients')
                .delete()
                .in('id', ids)
                .eq('account_id', tenant.id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.crm.clients.all });
            toast.success(`Deleted ${selectedIds.size} client${selectedIds.size > 1 ? 's' : ''}`);
            setSelectedIds(new Set());
            setBulkDeleteOpen(false);
        },
        onError: (error) => {
            logger.error('Bulk delete failed', { error });
            toast.error('Failed to delete clients');
        },
    });

    const handleBulkDelete = () => {
        setBulkDeleteOpen(true);
    };

    const columns: ResponsiveColumn<Client>[] = [
        {
            header: (
                <Checkbox
                    checked={filteredClients.length > 0 && selectedIds.size === filteredClients.length}
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all"
                />
            ) as unknown as string,
            className: "w-[50px]",
            cell: (client) => (
                <Checkbox
                    checked={selectedIds.has(client.id)}
                    onCheckedChange={(checked) => handleSelectClient(client.id, checked as boolean)}
                    onClick={(e) => e.stopPropagation()}
                />
            )
        },
        {
            header: 'Name',
            cell: (client) => (
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                    </div>
                    <div className="font-medium">{client.name}</div>
                </div>
            )
        },
        {
            header: 'Contact',
            cell: (client) => (
                <div className="flex flex-col gap-1 text-sm min-w-0">
                    {client.email && (
                        <div className="flex items-center gap-2 text-muted-foreground min-w-0">
                            <Mail className="h-3 w-3 shrink-0" />
                            <span className="truncate">{client.email}</span>
                        </div>
                    )}
                    {client.phone && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Phone className="h-3 w-3 shrink-0" />
                            {client.phone}
                        </div>
                    )}
                </div>
            )
        },
        {
            header: 'Open Balance',
            accessorKey: 'open_balance',
            cell: (client) => (
                <div className={`font-medium flex items-center gap-1 ${client.open_balance > 0 ? 'text-red-500' : 'text-green-500'}`}>
                    <DollarSign className="h-4 w-4" />
                    {formatCurrency(client.open_balance)}
                </div>
            )
        },
        {
            header: 'Status',
            accessorKey: 'status',
            cell: (client) => (
                <Badge variant={client.status === 'active' ? 'default' : 'secondary'}>
                    {client.status}
                </Badge>
            )
        },
        {
            header: 'Actions',
            cell: () => (
                <div className="flex justify-end">
                    <Button variant="ghost" size="sm">
                        View Details
                    </Button>
                </div>
            )
        }
    ];

    const renderMobileCard = (client: Client) => (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                        <div className="font-medium truncate">{client.name}</div>
                        <Badge variant={client.status === 'active' ? 'default' : 'secondary'} className="mt-1">
                            {client.status}
                        </Badge>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-2 text-sm text-muted-foreground">
                {client.email && (
                    <div className="flex items-center gap-2 min-w-0">
                        <Mail className="h-3 w-3 shrink-0" />
                        <span className="truncate">{client.email}</span>
                    </div>
                )}
                {client.phone && (
                    <div className="flex items-center gap-2">
                        <Phone className="h-3 w-3 shrink-0" />
                        {client.phone}
                    </div>
                )}
            </div>

            <div className="pt-2 border-t flex items-center justify-between">
                <div className={`font-medium flex items-center gap-1 ${client.open_balance > 0 ? 'text-red-500' : 'text-green-500'}`}>
                    <DollarSign className="h-4 w-4" />
                    {formatCurrency(client.open_balance)}
                </div>
                <Button variant="outline" size="sm" className="min-h-[44px] min-w-[44px]">View Details</Button>
            </div>
        </div>
    );

    return (
        <div className="container mx-auto py-4 sm:py-8 px-4 sm:px-4 space-y-4 sm:space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Clients</h1>
                        {isFetching && !isLoading && (
                            <span className="text-xs text-muted-foreground animate-pulse ml-2">Refreshing...</span>
                        )}
                    </div>
                    <p className="text-sm sm:text-base text-muted-foreground">
                        Manage your client relationships and track their activity.
                    </p>
                </div>
                <div className="flex gap-2">
                    <ExportButton
                        data={filteredClients.map(c => ({
                            name: c.name,
                            email: c.email ?? '',
                            phone: c.phone ?? '',
                            type: '', // Not available in current data model
                            tags: '', // Not available in current data model
                            created: new Date(c.created_at).toLocaleDateString(),
                            total_orders: '', // Not available in current data model
                            total_spent: '', // Not available in current data model
                            status: c.status,
                        }))}
                        filename="clients-export"
                        columns={[
                            { key: "name", label: "Name" },
                            { key: "email", label: "Email" },
                            { key: "phone", label: "Phone" },
                            { key: "type", label: "Type" },
                            { key: "tags", label: "Tags" },
                            { key: "created", label: "Created" },
                            { key: "total_orders", label: "Total Orders" },
                            { key: "total_spent", label: "Total Spent" },
                            { key: "status", label: "Status" },
                        ]}
                    />
                    {selectedIds.size > 0 && (
                        <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete ({selectedIds.size})
                        </Button>
                    )}
                    <CreateClientDialog />
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center justify-between">
                <div className="relative w-full sm:w-96">
                    <SearchInput
                        placeholder="Search clients..."
                        onSearch={handleSearchChange}
                        defaultValue={searchTerm}
                    />
                </div>
                <Select
                    value={statusFilter}
                    onValueChange={(value: 'active' | 'archived') => handleStatusFilterChange(value)}
                >
                    <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="active">Active Clients</SelectItem>
                        <SelectItem value="archived">Archived Clients</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Bulk Action Bar */}
            {selectedIds.size > 0 && (
                <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-2 text-sm">
                    <span className="font-medium">{selectedIds.size} {selectedIds.size === 1 ? 'client' : 'clients'} selected</span>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedIds(new Set())}
                    >
                        Clear selection
                    </Button>
                </div>
            )}

            <ResponsiveTable
                columns={columns}
                data={filteredClients}
                keyExtractor={(client) => client.id}
                isLoading={isLoading}
                onRowClick={(client) => navigateToAdmin(`crm/clients/${client.id}`)}
                onRowHover={(client) => handlePrefetchClient(client.id)}
                mobileRenderer={renderMobileCard}
                emptyState={{
                    type: searchTerm ? undefined : "no_customers",
                    icon: Users,
                    title: searchTerm ? "No clients found" : "No Clients Yet",
                    description: searchTerm
                        ? "No clients match your search criteria."
                        : "Add your first client to start managing relationships.",
                    primaryAction: searchTerm
                        ? { label: "Clear Search", onClick: () => handleSearchChange('') }
                        : { label: "Add Your First Client", onClick: () => navigateToAdmin('crm/clients/new'), icon: Plus },
                }}
            />

            <ConfirmDeleteDialog
                open={bulkDeleteOpen}
                onOpenChange={setBulkDeleteOpen}
                onConfirm={() => bulkDeleteMutation.mutate(Array.from(selectedIds))}
                itemType={`${selectedIds.size} client${selectedIds.size > 1 ? 's' : ''}`}
                isLoading={bulkDeleteMutation.isPending}
            />
        </div>
    );
}
