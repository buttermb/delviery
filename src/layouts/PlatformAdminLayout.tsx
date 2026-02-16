import { Outlet, Navigate } from 'react-router-dom';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { Loader2 } from 'lucide-react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { PlatformSidebar } from '@/components/admin/PlatformSidebar';
import { Toaster } from '@/components/ui/toaster';

export default function PlatformAdminLayout() {
    const { isPlatformAdmin, isLoading } = usePlatformAdmin();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-dvh">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    if (!isPlatformAdmin) {
        return <Navigate to="/" replace />;
    }

    return (
        <SidebarProvider>
            <div className="flex min-h-dvh w-full bg-muted/40 animate-in fade-in duration-300">
                <PlatformSidebar />
                {/* Main content offset matching sidebar width */}
                <div className="pl-64 flex-1 flex flex-col min-h-dvh">
                    <main id="main-content" tabIndex={-1} className="flex-1 overflow-visible focus:outline-none">
                        <div className="p-8">
                            <div className="max-w-7xl mx-auto w-full">
                                <Outlet />
                            </div>
                        </div>
                    </main>
                </div>
                <Toaster />
            </div>
        </SidebarProvider>
    );
}
