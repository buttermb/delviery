import { Navigate } from 'react-router-dom';
import { useVendorAuth } from '@/contexts/VendorAuthContext';
import { Loader2 } from 'lucide-react';

export default function ProtectedVendorRoute({ children }: { children: React.ReactNode }) {
    const { vendor, loading, isAuthenticated } = useVendorAuth();

    if (loading) {
        return (
            <div className="flex h-dvh items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!isAuthenticated || !vendor) {
        return <Navigate to="/vendor/login" replace />;
    }

    return <>{children}</>;
}
