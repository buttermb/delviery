// @ts-nocheck
import { logger } from '@/lib/logger';
// @ts-nocheck
/**
 * Create Tenant Page
 * Form for creating new tenants with trial subscription
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left";
import Building2 from "lucide-react/dist/esm/icons/building-2";
import { Link } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';

export default function CreateTenantPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    business_name: '',
    owner_email: '',
    owner_name: '',
    phone: '',
    state: '',
    industry: '',
    company_size: '',
    subscription_plan: 'starter',
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Generate slug from business name
      const slug = data.business_name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      // Call the atomic tenant creation function
      const { data: result, error } = await supabase.rpc('create_tenant_atomic', {
        p_auth_user_id: crypto.randomUUID(), // Temporary - will be replaced when owner signs up
        p_email: data.owner_email,
        p_business_name: data.business_name,
        p_owner_name: data.owner_name,
        p_phone: data.phone || null,
        p_state: data.state || null,
        p_industry: data.industry || null,
        p_company_size: data.company_size || null,
        p_slug: slug,
      });

      if (error) throw error;
      return result;
    },
    onSuccess: (result) => {
      logger.info('Tenant created successfully', { result });
      toast({
        title: 'Tenant Created',
        description: 'The tenant has been created successfully.',
      });
      navigate(`/super-admin/tenants/${result.tenant_id || ''}`);
    },
    onError: (error) => {
      logger.error('Failed to create tenant', error);
      toast({
        title: 'Error',
        description: 'Failed to create tenant. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.business_name || !formData.owner_email || !formData.owner_name) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    createMutation.mutate(formData);
  };

  return (
    <div className="container max-w-3xl py-8">
      <div className="mb-6">
        <Link to="/super-admin/tenants">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Tenants
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Building2 className="h-6 w-6 text-primary" />
            <div>
              <CardTitle>Create New Tenant</CardTitle>
              <CardDescription>
                Set up a new tenant account with a 14-day trial period
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Business Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Business Information</h3>
              
              <div className="space-y-2">
                <Label htmlFor="business_name">
                  Business Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="business_name"
                  value={formData.business_name}
                  onChange={(e) =>
                    setFormData({ ...formData, business_name: e.target.value })
                  }
                  placeholder="Enter business name"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="industry">Industry</Label>
                  <Select
                    value={formData.industry}
                    onValueChange={(value) =>
                      setFormData({ ...formData, industry: value })
                    }
                  >
                    <SelectTrigger id="industry">
                      <SelectValue placeholder="Select industry" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="retail">Retail</SelectItem>
                      <SelectItem value="dispensary">Dispensary</SelectItem>
                      <SelectItem value="distribution">Distribution</SelectItem>
                      <SelectItem value="manufacturing">Manufacturing</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company_size">Company Size</Label>
                  <Select
                    value={formData.company_size}
                    onValueChange={(value) =>
                      setFormData({ ...formData, company_size: value })
                    }
                  >
                    <SelectTrigger id="company_size">
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1-10">1-10 employees</SelectItem>
                      <SelectItem value="11-50">11-50 employees</SelectItem>
                      <SelectItem value="51-200">51-200 employees</SelectItem>
                      <SelectItem value="201+">201+ employees</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Owner Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Owner Information</h3>
              
              <div className="space-y-2">
                <Label htmlFor="owner_name">
                  Owner Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="owner_name"
                  value={formData.owner_name}
                  onChange={(e) =>
                    setFormData({ ...formData, owner_name: e.target.value })
                  }
                  placeholder="Enter owner's full name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="owner_email">
                  Email Address <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="owner_email"
                  type="email"
                  value={formData.owner_email}
                  onChange={(e) =>
                    setFormData({ ...formData, owner_email: e.target.value })
                  }
                  placeholder="owner@example.com"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    placeholder="(555) 123-4567"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) =>
                      setFormData({ ...formData, state: e.target.value })
                    }
                    placeholder="CA, NY, etc."
                    maxLength={2}
                  />
                </div>
              </div>
            </div>

            {/* Subscription Plan */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Initial Subscription</h3>
              
              <div className="space-y-2">
                <Label htmlFor="subscription_plan">Subscription Plan</Label>
                <Select
                  value={formData.subscription_plan}
                  onValueChange={(value) =>
                    setFormData({ ...formData, subscription_plan: value })
                  }
                >
                  <SelectTrigger id="subscription_plan">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">Starter - $79/month</SelectItem>
                    <SelectItem value="professional">Professional - $150/month</SelectItem>
                    <SelectItem value="enterprise">Enterprise - $499/month</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  All new tenants start with a 14-day free trial
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/super-admin/tenants')}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Tenant'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
