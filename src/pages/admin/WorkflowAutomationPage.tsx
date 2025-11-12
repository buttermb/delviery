/**
 * Workflow Automation Page
 * Visual workflow builder inspired by N8N, Activepieces, and Windmill
 */

import { AdvancedWorkflowBuilder } from '@/components/admin/workflow/AdvancedWorkflowBuilder';
import { SEOHead } from '@/components/SEOHead';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function WorkflowAutomationPage() {
  const navigate = useNavigate();

  return (
    <>
      <SEOHead title="Workflow Automation" />
      <div className="container mx-auto p-6">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate(-1)}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <AdvancedWorkflowBuilder />
      </div>
    </>
  );
}

