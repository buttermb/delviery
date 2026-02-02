import { Navigate } from 'react-router-dom';
import { useCourier } from '@/contexts/CourierContext';
import Loader2 from "lucide-react/dist/esm/icons/loader-2";

export default function ProtectedCourierRoute({ children }: { children: React.ReactNode }) {
  const { courier, loading } = useCourier();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!courier) {
    return <Navigate to="/courier/login" replace />;
  }

  return <>{children}</>;
}
