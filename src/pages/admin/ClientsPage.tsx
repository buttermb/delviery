import { useCallback } from 'react';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { useClients } from '@/hooks/crm/useClients';
import { CreateClientDialog } from '@/components/crm/CreateClientDialog';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { User, Phone, Mail, DollarSign, Users, Plus } from 'lucide-react';
import { formatCurrency } from '@/utils/formatters';
import { ResponsiveTable, ResponsiveColumn } from '@/components/shared/ResponsiveTable';
import { SearchInput } from '@/components/shared/SearchInput';
import { useUrlFilters } from '@/hooks/useUrlFilters';

interface Client {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    open_balance: number;
    status: string;
}

const CLIENTS_FILTER_CONFIG = [
    { key: 'q', defaultValue: '' },
    { key: 'status', defaultValue: 'active' },
];

export default function ClientsPage() {
    const { navigateToAdmin } = useTenantNavigation();

    // Filter state — persisted in URL for back-button & navigation support
    const [filters, setFilters] = useUrlFilters(CLIENTS_FILTER_CONFIG);
    const searchTerm = filters.q as string;
    const statusFilter = (filters.status || 'active') as 'active' | 'archived';

    const handleSearchChange = useCallback((v: string) => setFilters({ q: v }), [setFilters]);
    const handleStatusFilterChange = useCallback((v: string) => setFilters({ status: v }), [setFilters]);

    const { data: clients, isLoading } = useClients(statusFilter);

    const filteredClients = clients?.filter(client =>
        client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (client.email && client.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (client.phone && client.phone.includes(searchTerm))
    ) || [];

    const columns: ResponsiveColumn<Client>[] = [
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
                <div className="flex flex-col gap-1 text-sm">
                    {client.email && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            {client.email}
                        </div>
                    )}
                    {client.phone && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Phone className="h-3 w-3" />
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
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <div className="font-medium">{client.name}</div>
                        <Badge variant={client.status === 'active' ? 'default' : 'secondary'} className="mt-1">
                            {client.status}
                        </Badge>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-2 text-sm text-muted-foreground">
                {client.email && (
                    <div className="flex items-center gap-2">
                        <Mail className="h-3 w-3" />
                        {client.email}
                    </div>
                )}
                {client.phone && (
                    <div className="flex items-center gap-2">
                        <Phone className="h-3 w-3" />
                        {client.phone}
                    </div>
                )}
            </div>

            <div className="pt-2 border-t flex items-center justify-between">
                <div className={`font-medium flex items-center gap-1 ${client.open_balance > 0 ? 'text-red-500' : 'text-green-500'}`}>
                    <DollarSign className="h-4 w-4" />
                    {formatCurrency(client.open_balance)}
                </div>
                <Button variant="outline" size="sm">View Details</Button>
            </div>
        </div>
    );

    return (
        <div className="container mx-auto py-8 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
                    <p className="text-muted-foreground">
                        Manage your client relationships and track their activity.
                    </p>
                </div>
                <CreateClientDialog />
            </div>

            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full md:w-96">
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
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="active">Active Clients</SelectItem>
                        <SelectItem value="archived">Archived Clients</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <ResponsiveTable
                columns={columns}
                data={filteredClients}
                keyExtractor={(client) => client.id}
                isLoading={isLoading}
                onRowClick={(client) => navigateToAdmin(`crm/clients/${client.id}`)}
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
        </div>
    );
}
