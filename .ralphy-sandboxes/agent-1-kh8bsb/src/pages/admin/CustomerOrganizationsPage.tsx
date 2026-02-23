/**
 * Customer Organizations Page
 *
 * Management page for customer organizations/groups.
 * Supports B2B wholesale relationships where multiple customers
 * can belong to one organization.
 */

import { useState } from 'react';
import { Building2 } from 'lucide-react';
import { toast } from 'sonner';

import { SEOHead } from '@/components/SEOHead';
import { OrganizationList } from '@/components/admin/customers/OrganizationList';
import { OrganizationForm } from '@/components/admin/customers/OrganizationForm';
import { OrganizationDetail } from '@/components/admin/customers/OrganizationDetail';
import { useOrganizations } from '@/hooks/useOrganizations';

import type {
  OrganizationWithStats,
  OrganizationFormValues,
} from '@/types/organization';

type ViewMode = 'list' | 'detail';

export default function CustomerOrganizationsPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedOrganization, setSelectedOrganization] = useState<OrganizationWithStats | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingOrganization, setEditingOrganization] = useState<OrganizationWithStats | null>(null);

  const { createOrganization, updateOrganization, isCreating, isUpdating } = useOrganizations();

  const handleCreateClick = () => {
    setEditingOrganization(null);
    setShowForm(true);
  };

  const handleViewClick = (org: OrganizationWithStats) => {
    setSelectedOrganization(org);
    setViewMode('detail');
  };

  const handleEditClick = (org: OrganizationWithStats) => {
    setEditingOrganization(org);
    setShowForm(true);
  };

  const handleBack = () => {
    setSelectedOrganization(null);
    setViewMode('list');
  };

  const handleFormSubmit = async (data: OrganizationFormValues): Promise<boolean> => {
    if (editingOrganization) {
      const result = await updateOrganization(editingOrganization.id, data);
      if (result) {
        toast.success('Organization updated successfully');
        // Update selected organization if viewing detail
        if (selectedOrganization?.id === editingOrganization.id) {
          setSelectedOrganization({ ...selectedOrganization, ...result } as OrganizationWithStats);
        }
        return true;
      } else {
        toast.error('Failed to update organization');
        return false;
      }
    } else {
      const result = await createOrganization(data);
      if (result) {
        toast.success('Organization created successfully');
        return true;
      } else {
        toast.error('Failed to create organization');
        return false;
      }
    }
  };

  return (
    <div className="min-h-dvh bg-gray-50 dark:bg-zinc-900 p-6">
      <SEOHead
        title="Customer Organizations | Admin"
        description="Manage customer organizations and groups for B2B wholesale relationships"
      />

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header - only show in list mode */}
        {viewMode === 'list' && (
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Customer Organizations</h1>
              <p className="text-muted-foreground">
                Manage organizations for B2B wholesale relationships and group pricing
              </p>
            </div>
          </div>
        )}

        {/* Content based on view mode */}
        {viewMode === 'list' ? (
          <OrganizationList
            onCreateClick={handleCreateClick}
            onViewClick={handleViewClick}
            onEditClick={handleEditClick}
          />
        ) : selectedOrganization ? (
          <OrganizationDetail
            organization={selectedOrganization}
            onBack={handleBack}
            onEdit={() => handleEditClick(selectedOrganization)}
          />
        ) : null}
      </div>

      {/* Create/Edit Form Dialog */}
      <OrganizationForm
        open={showForm}
        onOpenChange={setShowForm}
        organization={editingOrganization}
        onSubmit={handleFormSubmit}
        isSubmitting={isCreating || isUpdating}
      />
    </div>
  );
}
