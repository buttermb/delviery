import { useState, useMemo, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { TruncatedText } from '@/components/shared/TruncatedText';
import {
  Search,
  Plus,
  Star,
  Clock,
  AlertCircle,
  TrendingUp,
  CheckCircle2,
  Building2,
  RefreshCw,
} from 'lucide-react';
import { useWholesaleClients } from '@/hooks/useWholesaleData';
import { useRecentClients } from '@/hooks/useRecentClients';
import { useClientSuggestions, useToggleClientFavorite } from '@/hooks/useClientSuggestions';
import { CreateWholesaleClientDialog } from '@/components/wholesale/CreateWholesaleClientDialog';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatSmartDate } from '@/lib/utils/formatDate';
import { cn } from '@/lib/utils';

interface WholesaleClient {
  id: string;
  business_name: string;
  contact_name: string;
  credit_limit: number;
  outstanding_balance: number;
  status: string;
  address?: string;
  phone?: string;
  email?: string;
  is_favorite?: boolean;
  last_order_date?: string;
  last_order_amount?: number;
}

interface SmartClientPickerProps {
  selectedClient: WholesaleClient | null;
  onSelect: (client: WholesaleClient) => void;
  onClear?: () => void;
}

/**
 * Smart Client Picker with:
 * - Recent clients horizontal row
 * - Smart suggestions based on patterns
 * - Search with autocomplete
 * - Quick create slide-out
 * - Credit health indicators
 */
export function SmartClientPicker({
  selectedClient,
  onSelect,
  onClear,
}: SmartClientPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAllClients, setShowAllClients] = useState(false);

  const { data: allClients = [], isLoading: clientsLoading } = useWholesaleClients();
  const { recentClients, addRecentClient, isLoading: recentLoading } = useRecentClients();
  const { suggestions, recurringClients: _recurringClients, overdueClients: _overdueClients, isLoading: suggestionsLoading } = useClientSuggestions();
  const { toggleFavorite } = useToggleClientFavorite();

  // Filter clients by search query
  const filteredClients = useMemo(() => {
    if (!searchQuery) return allClients;
    const query = searchQuery.toLowerCase();
    return allClients.filter(
      (client) =>
        client.business_name?.toLowerCase().includes(query) ||
        client.contact_name?.toLowerCase().includes(query) ||
        client.email?.toLowerCase().includes(query) ||
        client.phone?.includes(query)
    );
  }, [allClients, searchQuery]);

  // Get credit health color
  const getCreditHealth = useCallback((client: WholesaleClient) => {
    const usedPercent = (client.outstanding_balance / client.credit_limit) * 100;
    if (usedPercent >= 90) return { color: 'text-red-500', bg: 'bg-red-500', label: 'Critical' };
    if (usedPercent >= 70) return { color: 'text-yellow-500', bg: 'bg-yellow-500', label: 'Warning' };
    if (usedPercent >= 50) return { color: 'text-orange-500', bg: 'bg-orange-500', label: 'Moderate' };
    return { color: 'text-emerald-500', bg: 'bg-emerald-500', label: 'Healthy' };
  }, []);

  // Handle client selection
  const handleSelect = useCallback(
    (client: WholesaleClient) => {
      addRecentClient(client);
      onSelect(client);
    },
    [addRecentClient, onSelect]
  );

  // Handle favorite toggle
  const handleToggleFavorite = async (e: React.MouseEvent, clientId: string, currentFavorite: boolean) => {
    e.stopPropagation();
    await toggleFavorite(clientId, !currentFavorite);
  };

  // If a client is selected, show summary
  if (selectedClient) {
    const health = getCreditHealth(selectedClient);
    const availableCredit = selectedClient.credit_limit - selectedClient.outstanding_balance;

    return (
      <div className="space-y-4">
        <Card className="p-4 border-emerald-500/50 bg-emerald-500/5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={cn('w-12 h-12 rounded-full flex items-center justify-center', health.bg + '/20')}>
                <Building2 className={cn('h-6 w-6', health.color)} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-lg">{selectedClient.business_name}</h3>
                  <Badge variant="outline" className="text-emerald-600 border-emerald-500/30">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Selected
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{selectedClient.contact_name}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={onClear}>
              Change
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
            <div>
              <p className="text-xs text-muted-foreground">Credit Limit</p>
              <p className="font-mono font-semibold">{formatCurrency(selectedClient.credit_limit)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Outstanding</p>
              <p className={cn('font-mono font-semibold', selectedClient.outstanding_balance > 0 ? 'text-red-500' : '')}>
                {formatCurrency(selectedClient.outstanding_balance)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Available</p>
              <p className={cn('font-mono font-semibold', health.color)}>
                {formatCurrency(availableCredit)}
              </p>
            </div>
          </div>

          {selectedClient.outstanding_balance > 0 && (
            <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
              <div className="text-sm">
                <span className="font-medium text-yellow-600">Outstanding Balance</span>
                <p className="text-muted-foreground">
                  Client has {formatCurrency(selectedClient.outstanding_balance)} overdue
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>
    );
  }

  const isLoading = clientsLoading || recentLoading || suggestionsLoading;

  return (
    <div className="space-y-6">
      {/* Search & Create */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search clients by name, email, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            aria-label="Search clients"
          />
        </div>
        <Button variant="outline" onClick={() => setShowCreateDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New Client</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : searchQuery ? (
        /* Search Results */
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            Search Results ({filteredClients.length})
          </h3>
          {filteredClients.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground mb-4">No clients match your search</p>
              <Button variant="outline" onClick={() => setShowCreateDialog(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Create New Client
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredClients.slice(0, 10).map((client) => (
                <ClientCard
                  key={client.id}
                  client={client}
                  getCreditHealth={getCreditHealth}
                  onSelect={handleSelect}
                  onToggleFavorite={handleToggleFavorite}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Recent Clients */}
          {recentClients.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Recent Clients
              </h3>
              <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex gap-3 pb-2">
                  {recentClients.map((client) => (
                    <RecentClientCard
                      key={client.id}
                      client={client}
                      getCreditHealth={getCreditHealth}
                      onSelect={handleSelect}
                    />
                  ))}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>
          )}

          {/* Smart Suggestions */}
          {suggestions.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                Suggested Clients
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {suggestions.slice(0, 4).map((suggestion) => (
                  <SuggestionCard
                    key={suggestion.id}
                    suggestion={suggestion}
                    getCreditHealth={getCreditHealth}
                    onSelect={handleSelect}
                  />
                ))}
              </div>
            </div>
          )}

          {/* All Clients */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">All Clients ({allClients.length})</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllClients(true)}
                className="text-xs"
              >
                View All
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {allClients.slice(0, 6).map((client) => (
                <ClientCard
                  key={client.id}
                  client={client}
                  getCreditHealth={getCreditHealth}
                  onSelect={handleSelect}
                  onToggleFavorite={handleToggleFavorite}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Create Client Dialog */}
      <CreateWholesaleClientDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSuccess={(clientId) => {
          setShowCreateDialog(false);
          // Refetch and select the new client
          const newClient = allClients.find((c) => c.id === clientId);
          if (newClient) {
            handleSelect(newClient as WholesaleClient);
          }
        }}
      />

      {/* All Clients Sheet */}
      <Sheet open={showAllClients} onOpenChange={setShowAllClients}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>All Clients</SheetTitle>
            <SheetDescription>Select a client for this order</SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            {allClients.map((client) => (
              <ClientCard
                key={client.id}
                client={client}
                getCreditHealth={getCreditHealth}
                onSelect={(c) => {
                  handleSelect(c);
                  setShowAllClients(false);
                }}
                onToggleFavorite={handleToggleFavorite}
              />
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// Recent Client Card (horizontal scroll)
function RecentClientCard({
  client,
  getCreditHealth,
  onSelect,
}: {
  client: WholesaleClient;
  getCreditHealth: (client: WholesaleClient) => { color: string; bg: string; label: string };
  onSelect: (client: WholesaleClient) => void;
}) {
  const health = getCreditHealth(client);

  return (
    <Card
      className="p-3 min-w-[200px] cursor-pointer hover:border-emerald-500 transition-colors shrink-0"
      onClick={() => onSelect(client)}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className={cn('w-2 h-2 rounded-full', health.bg)} />
        <TruncatedText text={client.business_name} className="font-medium text-sm" />
      </div>
      <TruncatedText text={client.contact_name} className="text-xs text-muted-foreground" as="div" />
      {client.last_order_date && (
        <div className="text-xs text-muted-foreground mt-1">
          Last: {formatSmartDate(client.last_order_date)}
        </div>
      )}
    </Card>
  );
}

interface ClientSuggestion extends WholesaleClient {
  suggestion_type: string;
  suggestion_reason: string;
}

// Suggestion Card
function SuggestionCard({
  suggestion,
  getCreditHealth,
  onSelect,
}: {
  suggestion: ClientSuggestion;
  getCreditHealth: (client: WholesaleClient) => { color: string; bg: string; label: string };
  onSelect: (client: WholesaleClient) => void;
}) {
  const health = getCreditHealth(suggestion);

  const getIcon = () => {
    switch (suggestion.suggestion_type) {
      case 'recurring':
        return <RefreshCw className="h-4 w-4 text-blue-500" />;
      case 'overdue':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'high_value':
        return <TrendingUp className="h-4 w-4 text-emerald-500" />;
      case 'favorite':
        return <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />;
      default:
        return <Building2 className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <Card
      className="p-4 cursor-pointer hover:border-emerald-500 transition-colors"
      onClick={() => onSelect(suggestion)}
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-muted">{getIcon()}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <TruncatedText text={suggestion.business_name} className="font-medium" />
            <div className={cn('w-2 h-2 rounded-full shrink-0', health.bg)} />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {suggestion.suggestion_reason}
          </p>
        </div>
      </div>
    </Card>
  );
}

// Client Card
function ClientCard({
  client,
  getCreditHealth,
  onSelect,
  onToggleFavorite,
}: {
  client: WholesaleClient;
  getCreditHealth: (client: WholesaleClient) => { color: string; bg: string; label: string };
  onSelect: (client: WholesaleClient) => void;
  onToggleFavorite: (e: React.MouseEvent, clientId: string, currentFavorite: boolean) => void;
}) {
  const health = getCreditHealth(client);
  const availableCredit = client.credit_limit - client.outstanding_balance;

  return (
    <Card
      className="p-4 cursor-pointer hover:border-emerald-500 transition-colors"
      onClick={() => onSelect(client)}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn('w-3 h-3 rounded-full shrink-0', health.bg)} />
          <TruncatedText text={client.business_name} className="font-medium" />
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={(e) => onToggleFavorite(e, client.id, client.is_favorite || false)}
        >
          <Star
            className={cn(
              'h-4 w-4',
              client.is_favorite ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground'
            )}
          />
        </Button>
      </div>

      <div className="text-sm text-muted-foreground mb-3">{client.contact_name}</div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Available Credit</span>
        <span className={cn('font-mono font-medium', health.color)}>
          {formatCurrency(availableCredit)}
        </span>
      </div>

      {client.outstanding_balance > 0 && (
        <div className="mt-2 px-2 py-1 bg-yellow-500/10 rounded text-xs text-yellow-600 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {formatCurrency(client.outstanding_balance)} outstanding
        </div>
      )}
    </Card>
  );
}

export default SmartClientPicker;

