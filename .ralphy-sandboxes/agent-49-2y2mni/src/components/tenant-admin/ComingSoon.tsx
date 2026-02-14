/**
 * Coming Soon Component
 * Reusable component for features under development
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Sparkles } from "lucide-react";

interface ComingSoonProps {
  featureName: string;
  description?: string;
  expectedDate?: string;
}

export function ComingSoon({ 
  featureName, 
  description = "This feature is currently under development and will be available soon.",
  expectedDate 
}: ComingSoonProps) {
  const navigate = useNavigate();
  const { tenantSlug } = useParams();

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-6">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">{featureName}</CardTitle>
          <CardDescription className="text-base mt-2">
            {description}
          </CardDescription>
          {expectedDate && (
            <p className="text-sm text-muted-foreground mt-2">
              Expected Release: {expectedDate}
            </p>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button 
            onClick={() => navigate(`/${tenantSlug}/admin/dashboard`)}
            className="w-full"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <Button 
            variant="outline"
            onClick={() => navigate(`/${tenantSlug}/admin/help`)}
            className="w-full"
          >
            Contact Support
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
