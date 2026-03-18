import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCourier } from '@/contexts/CourierContext';
import { RoleIndicator } from '@/components/courier/RoleIndicator';

export default function CourierSettingsPage() {
  const navigate = useNavigate();
  const { courier, role } = useCourier();

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container flex h-16 items-center gap-4 px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/courier/dashboard')} aria-label="Back to courier dashboard">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Settings</h1>
            <RoleIndicator role={role} />
          </div>
        </div>
      </header>

      <main className="container px-4 py-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Name</p>
              <p className="font-medium">{courier?.full_name}</p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
