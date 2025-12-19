import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

const AGE_VERIFIED_KEY = "age_verified";

const AgeVerificationModal = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Check if user has already verified their age
    const isVerified = localStorage.getItem(AGE_VERIFIED_KEY);
    if (!isVerified) {
      setOpen(true);
    }
  }, []);

  const handleVerify = (isOver21: boolean) => {
    if (isOver21) {
      // Store age verification in localStorage
      localStorage.setItem(AGE_VERIFIED_KEY, "true");
      setOpen(false);
    } else {
      // Redirect under-age users away
      window.location.href = "https://google.com";
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md [&>button]:hidden">{/* Hide close button */}
          <DialogHeader>
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8 text-primary" />
            </div>
            <DialogTitle className="text-2xl text-center">Age Verification Required</DialogTitle>
            <DialogDescription className="text-center text-base pt-2">
              You must be 21 years or older to access this website and purchase products.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-4">
            <Button 
              variant="hero" 
              size="lg" 
              className="w-full text-lg"
              onClick={() => handleVerify(true)}
            >
              I am 21 or older
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              className="w-full text-lg"
              onClick={() => handleVerify(false)}
            >
              I am under 21
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center pt-4">
            By entering, you confirm you are 21 years or older and agree to our Terms of Service and Privacy Policy.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AgeVerificationModal;
