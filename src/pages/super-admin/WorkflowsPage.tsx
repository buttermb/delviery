/**
 * Workflows Page
 * Visual workflow designer and automation management
 */

import { WorkflowBuilder } from '@/components/super-admin/automation/WorkflowBuilder';
import { ScheduledJobsManager } from '@/components/super-admin/automation/ScheduledJobsManager';
import { AlertConfig } from '@/components/super-admin/automation/AlertConfig';
import { PageHeader } from '@/components/super-admin/ui/PageHeader';
import { SEOHead } from '@/components/SEOHead';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Workflow, Clock, Bell } from 'lucide-react';

export default function WorkflowsPage() {
  return (
    <>
      <SEOHead title="Workflows - Super Admin" />
      <div className="container mx-auto p-6 space-y-6">
        <PageHeader
          title="Workflow Automation"
          description="Build and manage automated workflows for tenant onboarding, payments, and more"
          icon={Workflow}
        />

        <Tabs defaultValue="workflows" className="space-y-4">
          <TabsList>
            <TabsTrigger value="workflows">Workflows</TabsTrigger>
            <TabsTrigger value="jobs">Scheduled Jobs</TabsTrigger>
            <TabsTrigger value="alerts">Alert Configuration</TabsTrigger>
          </TabsList>

          <TabsContent value="workflows">
            <WorkflowBuilder />
          </TabsContent>

          <TabsContent value="jobs">
            <ScheduledJobsManager />
          </TabsContent>

          <TabsContent value="alerts">
            <AlertConfig />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

