/**
 * Super Admin Page Header Component
 * 
 * @deprecated Use PageHeader from '@/components/shared/PageHeader' directly
 * This file is maintained for backward compatibility.
 */

import { ReactNode } from 'react';
import { Breadcrumbs } from './Breadcrumbs';
import { PageHeader as SharedPageHeader } from '@/components/shared/PageHeader';
import { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
}

export function PageHeader({ title, description, icon, actions }: PageHeaderProps) {
  return (
    <div className="space-y-4 mb-6">
      <div className="print:hidden">
        <Breadcrumbs />
      </div>
      <SharedPageHeader
        title={title}
        description={description}
        icon={icon}
        actions={actions}
        className="mb-0"
      />
    </div>
  );
}
