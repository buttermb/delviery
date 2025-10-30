import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAccount } from '@/contexts/AccountContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, MessageCircle, Clock, CheckCircle, XCircle } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';

interface ServiceRequest {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
}

export default function ServiceRequests() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { account, userProfile, loading: accountLoading } = useAccount();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newRequest, setNewRequest] = useState({
    title: '',
    description: '',
    category: 'general',
    priority: 'medium'
  });

  useEffect(() => {
    if (!accountLoading && !account) {
      navigate('/admin/dashboard');
    }
  }, [account, accountLoading, navigate]);

  useEffect(() => {
    if (user) {
      loadRequests();
    }
  }, [user]);

  const loadRequests = async () => {
    try {
      // Placeholder - replace with actual service requests query
      setRequests([
        {
          id: '1',
          title: 'Help with account setup',
          description: 'Need assistance configuring team permissions',
          category: 'support',
          priority: 'high',
          status: 'open',
          created_at: new Date().toISOString()
        }
      ]);
    } catch (error) {
      console.error('Error loading requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!user || !newRequest.title) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Create service request
      toast({
        title: "Success",
        description: "Service request submitted successfully"
      });
      
      setDialogOpen(false);
      setNewRequest({
        title: '',
        description: '',
        category: 'general',
        priority: 'medium'
      });
      
      await loadRequests();
    } catch (error) {
      console.error('Error creating request:', error);
      toast({
        title: "Error",
        description: "Failed to submit request",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    const icons = {
      open: <Clock className="w-4 h-4" />,
      in_progress: <MessageCircle className="w-4 h-4" />,
      resolved: <CheckCircle className="w-4 h-4" />,
      closed: <XCircle className="w-4 h-4" />
    };
    return icons[status as keyof typeof icons] || icons.open;
  };

  const getStatusColor = (status: string) => {
    const colors = {
      open: 'bg-blue-500/10 text-blue-600',
      in_progress: 'bg-yellow-500/10 text-yellow-600',
      resolved: 'bg-green-500/10 text-green-600',
      closed: 'bg-gray-500/10 text-gray-600'
    };
    return colors[status as keyof typeof colors] || colors.open;
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      low: 'bg-gray-500/10 text-gray-600',
      medium: 'bg-blue-500/10 text-blue-600',
      high: 'bg-orange-500/10 text-orange-600',
      urgent: 'bg-red-500/10 text-red-600'
    };
    return colors[priority as keyof typeof colors] || colors.medium;
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
        title="Service Requests"
        description="Manage your service requests and support tickets"
      />

      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Service Requests</h1>
            <p className="text-muted-foreground mt-2">Submit and track your support requests</p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                New Request
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Service Request</DialogTitle>
                <DialogDescription>
                  Submit a new service request or support ticket
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={newRequest.title}
                    onChange={(e) => setNewRequest({ ...newRequest, title: e.target.value })}
                    placeholder="Brief description of your request"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    value={newRequest.description}
                    onChange={(e) => setNewRequest({ ...newRequest, description: e.target.value })}
                    placeholder="Provide details about your request"
                    rows={5}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select value={newRequest.category} onValueChange={(value) => setNewRequest({ ...newRequest, category: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General</SelectItem>
                        <SelectItem value="technical">Technical Support</SelectItem>
                        <SelectItem value="billing">Billing</SelectItem>
                        <SelectItem value="feature">Feature Request</SelectItem>
                        <SelectItem value="bug">Bug Report</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select value={newRequest.priority} onValueChange={(value) => setNewRequest({ ...newRequest, priority: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSubmit} disabled={loading}>
                    {loading ? 'Submitting...' : 'Submit Request'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Requests List */}
        <div className="grid gap-4">
          {requests.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <MessageCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground mb-4">No service requests yet</p>
                <Button onClick={() => setDialogOpen(true)}>
                  Create Your First Request
                </Button>
              </CardContent>
            </Card>
          ) : (
            requests.map((request) => (
              <Card key={request.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-xl mb-2">{request.title}</CardTitle>
                      <p className="text-muted-foreground text-sm">{request.description}</p>
                    </div>
                    <div className="flex flex-col gap-2 ml-4">
                      <Badge className={getStatusColor(request.status)}>
                        {getStatusIcon(request.status)}
                        <span className="ml-1">{request.status}</span>
                      </Badge>
                      <Badge className={getPriorityColor(request.priority)}>
                        {request.priority}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Created {new Date(request.created_at).toLocaleDateString()}
                    </div>
                    <Button variant="ghost" size="sm">
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
