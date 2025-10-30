import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft } from "lucide-react";
import bugFinder from "@/utils/bugFinder";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
    // Report 404 to bug finder
    bugFinder.report404(location.pathname, {
      timestamp: new Date().toISOString(),
      referrer: document.referrer,
    });
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <div className="text-center px-6 max-w-md">
        <div className="mb-8">
          <h1 className="mb-4 text-8xl font-light text-emerald-500">404</h1>
          <h2 className="mb-4 text-3xl font-light text-white">Page Not Found</h2>
          <p className="mb-8 text-lg text-white/60 font-light leading-relaxed">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button 
            onClick={() => navigate('/')}
            className="group px-8 py-4 bg-emerald-500 text-black font-light hover:bg-emerald-400 transition-all duration-300"
          >
            <Home className="w-5 h-5 mr-2" />
            Go Home
          </Button>
          
          <Button 
            variant="outline"
            onClick={() => navigate(-1)}
            className="px-8 py-4 border border-white/20 text-white font-light hover:border-emerald-500 hover:text-emerald-500 transition-all duration-300 bg-transparent"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Go Back
          </Button>
        </div>
        
        <div className="mt-12 pt-8 border-t border-white/10">
          <p className="text-sm text-white/40 font-light">
            Licensed NYC Delivery • Lab Tested • Fast & Discreet
          </p>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
