import { RouteOptimizer } from '@/components/ui/lazy-mapbox';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function RouteOptimizationPage() {
  const navigate = useNavigate();

  return (
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
      <RouteOptimizer />
    </div>
  );
}
