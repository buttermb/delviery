import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAccount } from '@/contexts/AccountContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Ticket, AlertCircle, Clock, CheckCircle,
  ArrowLeft, Search, MessageSquare
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { format } from 'date-fns';

export default function SuperAdminSupport() {
  const navigate = useNavigate();
  const { isSuperAdmin, loading: accountLoading } = useAccount();
  const [tickets, setTickets] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'pending' | 'resolved'>('all');

  useEffect(() => {
    if (!accountLoading && !isSuperAdmin) {
      navigate('/admin/dashboard');
    }
  }, [isSuperAdmin, accountLoading, navigate]);

  useEffect(() => {
    if (isSuperAdmin) {
      loadTickets();
    }
  }, [isSuperAdmin]);

  const loadTickets = async () => {
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select(`
          *,
          account:accounts(company_name, slug)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTickets(data || []);
    } catch (error) {
      console.error('Error loading tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500/10 text-red-600 border-red-500/20';
      case 'high': return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
      case 'medium': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      case 'low': return 'bg-green-500/10 text-green-600 border-green-500/20';
      default: return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'pending': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      case 'resolved': return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'closed': return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
      default: return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
    }
  };

  const filteredTickets = tickets
    .filter(ticket => {
      if (filter !== 'all' && ticket.status !== filter) return false;
      if (search && !ticket.subject.toLowerCase().includes(search.toLowerCase()) &&
          !ticket.account?.company_name.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      return true;
    });

  const metrics = {
    open: tickets.filter(t => t.status === 'open').length,
    pending: tickets.filter(t => t.status === 'pending').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
    avgResponseTime: '2.5 hrs' // TODO: Calculate from data
  };

  if (accountLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEOHead 
        title="Support Tickets | Super Admin"
        description="Manage customer support tickets"
      />

      {/* Header */}
      <div className="border-b border-border/40 bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/super-admin/dashboard')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
          <h1 className="text-2xl font-bold">Support Tickets</h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Metrics */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Open</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{metrics.open}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{metrics.pending}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Resolved</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{metrics.resolved}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{metrics.avgResponseTime}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tickets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              onClick={() => setFilter('all')}
            >
              All
            </Button>
            <Button
              variant={filter === 'open' ? 'default' : 'outline'}
              onClick={() => setFilter('open')}
            >
              Open
            </Button>
            <Button
              variant={filter === 'pending' ? 'default' : 'outline'}
              onClick={() => setFilter('pending')}
            >
              Pending
            </Button>
            <Button
              variant={filter === 'resolved' ? 'default' : 'outline'}
              onClick={() => setFilter('resolved')}
            >
              Resolved
            </Button>
          </div>
        </div>

        {/* Tickets List */}
        <div className="grid gap-4">
          {filteredTickets.map((ticket) => (
            <Card key={ticket.id} className="hover:border-primary/50 transition-colors cursor-pointer">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">{ticket.subject}</h3>
                      <Badge className={getPriorityColor(ticket.priority)}>
                        {ticket.priority}
                      </Badge>
                      <Badge className={getStatusColor(ticket.status)}>
                        {ticket.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{ticket.account?.company_name}</p>
                    <p className="text-sm line-clamp-2">{ticket.description}</p>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    {format(new Date(ticket.created_at), 'MMM d, yyyy h:mm a')}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" variant="outline">
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Reply
                  </Button>
                  <Button size="sm" variant="outline">
                    View Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredTickets.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Ticket className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No tickets found</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
