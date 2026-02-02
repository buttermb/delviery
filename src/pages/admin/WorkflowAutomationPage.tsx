/**
 * Workflow Automation Page
 * Visual workflow builder inspired by N8N, Activepieces, and Windmill
 */

import { AdvancedWorkflowBuilder } from '@/components/admin/workflow/AdvancedWorkflowBuilder';
import { SEOHead } from '@/components/SEOHead';
import { Button } from '@/components/ui/button';
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left";
import { useNavigate } from 'react-router-dom';

export default function WorkflowAutomationPage() {
  return (
    <>
      <SEOHead title="Workflow Automation" />
      <div className="container mx-auto p-6">
        <AdvancedWorkflowBuilder />
      </div>
    </>
  );
}

