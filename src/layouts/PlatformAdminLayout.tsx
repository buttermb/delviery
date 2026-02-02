import { Outlet, Navigate } from 'react-router-dom';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
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
                    <main className="flex-1 overflow-visible">
                        <div className="p-8">
                            <Outlet />
                        </div>
                    </main>
                </div>
                <Toaster />
            </div>
        </SidebarProvider>
    );
}
