import { useState } from 'react';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useDisposableMenus } from '@/hooks/useDisposableMenus';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import Plus from "lucide-react/dist/esm/icons/plus";
import Search from "lucide-react/dist/esm/icons/search";
import Eye from "lucide-react/dist/esm/icons/eye";
import Users from "lucide-react/dist/esm/icons/users";
import ShoppingCart from "lucide-react/dist/esm/icons/shopping-cart";
import DollarSign from "lucide-react/dist/esm/icons/dollar-sign";
import MenuIcon from "lucide-react/dist/esm/icons/menu";
import LayoutGrid from "lucide-react/dist/esm/icons/layout-grid";
import List from "lucide-react/dist/esm/icons/list";
import Filter from "lucide-react/dist/esm/icons/filter";
import { formatCurrency } from '@/utils/formatters';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { usePagination } from '@/hooks/usePagination';
import { StandardPagination } from '@/components/shared/StandardPagination';
import { MenuCard, Menu } from '@/components/admin/disposable-menus/MenuCard';
import { CreateMenuDialog } from '@/components/admin/disposable-menus/CreateMenuDialog';
import { cn } from '@/lib/utils';

type ViewMode = 'grid' | 'list';
type StatusFilter = 'all' | 'active' | 'soft_burned' | 'hard_burned';

export function MenusListPage() {
    const { tenant } = useTenantAdminAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [viewMode, setViewMode] = useState<ViewMode>('grid');
    const [createDialogOpen, setCreateDialogOpen] = useState(false);

    const { data: menus, isLoading } = useDisposableMenus(tenant?.id);

    const filteredMenus = menus?.filter((menu) => {
        const matchesSearch =
            menu.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (menu.description && typeof menu.description === 'string' &&
                menu.description.toLowerCase().includes(searchQuery.toLowerCase()));

        const matchesStatus = statusFilter === 'all' ? true : menu.status === statusFilter;

        return matchesSearch && matchesStatus;
    }) || [];

    // Pagination
    const {
        paginatedItems: paginatedMenus,
        currentPage,
        pageSize,
        totalPages,
        totalItems,
        goToPage,
        changePageSize,
        pageSizeOptions,
    } = usePagination(filteredMenus, {
        defaultPageSize: 12,
        persistInUrl: true,
        urlKey: 'menus',
    });

    // Calculate stats
    const activeMenus = menus?.filter(m => m.status === 'active').length || 0;
    const totalViews = menus?.reduce((sum, m) => sum + (m.view_count || 0), 0) || 0;
    const totalOrders = menus?.reduce((sum, m) => sum + (m.order_count || 0), 0) || 0;
    const totalRevenue = menus?.reduce((sum, m) => sum + (m.total_revenue || 0), 0) || 0;

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'active':
                return <Badge className="bg-success text-success-foreground">Active</Badge>;
            case 'soft_burned':
                return <Badge className="bg-warning text-warning-foreground">Soft Burned</Badge>;
            case 'hard_burned':
                return <Badge variant="destructive">Burned</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    return (
        <div className="space-y-6 p-6 pb-16">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Product Menus</h1>
                    <p className="text-muted-foreground">
                        Create and manage secure product menus for your customers.
                    </p>
                </div>
                <Button onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Create Menu
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Menus</CardTitle>
                        <MenuIcon className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{activeMenus}</div>
                        <p className="text-xs text-muted-foreground">
                            {menus?.length || 0} total menus
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Views</CardTitle>
                        <Eye className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalViews.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">
                            Across all menus
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                        <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalOrders.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">
                            From menu sales
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                        <DollarSign className="h-4 w-4 text-success" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-success">{formatCurrency(totalRevenue)}</div>
                        <p className="text-xs text-muted-foreground">
                            From menu orders
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Filters and View Controls */}
            <Card>
                <CardHeader className="p-4">
                    <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-3.5 h-4 w-4 text-muted-foreground md:top-2.5" />
                            <Input
                                placeholder="Search menus..."
                                className="pl-8 h-11 md:h-10 text-base md:text-sm"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2">
                            <Select
                                value={statusFilter}
                                onValueChange={(value: StatusFilter) => setStatusFilter(value)}
                            >
                                <SelectTrigger className="w-[150px] h-11 md:h-10">
                                    <Filter className="h-4 w-4 mr-2" />
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Statuses</SelectItem>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="soft_burned">Soft Burned</SelectItem>
                                    <SelectItem value="hard_burned">Burned</SelectItem>
                                </SelectContent>
                            </Select>
                            <div className="hidden md:flex border rounded-md">
                                <Button
                                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                                    size="icon"
                                    className="rounded-r-none h-10 w-10"
                                    onClick={() => setViewMode('grid')}
                                >
                                    <LayoutGrid className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                                    size="icon"
                                    className="rounded-l-none h-10 w-10"
                                    onClick={() => setViewMode('list')}
                                >
                                    <List className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                    {isLoading ? (
                        <div className={cn(
                            viewMode === 'grid'
                                ? "grid gap-4 md:grid-cols-2 lg:grid-cols-3"
                                : "space-y-4"
                        )}>
                            {[...Array(6)].map((_, i) => (
                                <Card key={i} className="p-4">
                                    <div className="space-y-3">
                                        <div className="flex justify-between">
                                            <Skeleton className="h-5 w-32" />
                                            <Skeleton className="h-5 w-16 rounded-full" />
                                        </div>
                                        <Skeleton className="h-4 w-48" />
                                        <div className="flex gap-4">
                                            <Skeleton className="h-4 w-12" />
                                            <Skeleton className="h-4 w-12" />
                                            <Skeleton className="h-4 w-12" />
                                        </div>
                                        <div className="flex gap-2 pt-2 border-t">
                                            <Skeleton className="h-8 w-8" />
                                            <Skeleton className="h-8 w-8" />
                                            <Skeleton className="h-8 w-8" />
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    ) : filteredMenus.length === 0 ? (
                        <EnhancedEmptyState
                            icon={MenuIcon}
                            title={searchQuery || statusFilter !== 'all' ? "No Menus Found" : "No Menus Yet"}
                            description={
                                searchQuery || statusFilter !== 'all'
                                    ? "No menus match your current filters."
                                    : "Create your first product menu to start sharing with customers."
                            }
                            primaryAction={!searchQuery && statusFilter === 'all' ? {
                                label: "Create Menu",
                                onClick: () => setCreateDialogOpen(true),
                                icon: Plus
                            } : undefined}
                        />
                    ) : (
                        <>
                            <div className={cn(
                                viewMode === 'grid'
                                    ? "grid gap-4 md:grid-cols-2 lg:grid-cols-3"
                                    : "space-y-4"
                            )}>
                                {paginatedMenus.map((menu: Menu) => (
                                    <MenuCard
                                        key={menu.id}
                                        menu={menu}
                                        compact={viewMode === 'list'}
                                    />
                                ))}
                            </div>

                            {/* Pagination */}
                            {totalItems > pageSize && (
                                <div className="mt-6 pt-4 border-t">
                                    <StandardPagination
                                        currentPage={currentPage}
                                        totalPages={totalPages}
                                        totalItems={totalItems}
                                        pageSize={pageSize}
                                        onPageChange={goToPage}
                                        onPageSizeChange={changePageSize}
                                        pageSizeOptions={pageSizeOptions}
                                    />
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Create Menu Dialog */}
            <CreateMenuDialog
                open={createDialogOpen}
                onOpenChange={setCreateDialogOpen}
            />
        </div>
    );
}

export default MenusListPage;
