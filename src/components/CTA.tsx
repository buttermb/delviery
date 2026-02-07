import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Smartphone } from "lucide-react";
import { useNavigate } from "react-router-dom";

const CTA = () => {
  const navigate = useNavigate();
  
  return (
    <section className="py-20">
      <div className="container px-4 mx-auto">
        <Card className="max-w-4xl mx-auto border-2 border-primary/20 bg-gradient-hero overflow-hidden">
          <div className="p-12 text-center space-y-6">
            <div className="w-16 h-16 mx-auto rounded-full bg-gradient-primary flex items-center justify-center">
              <Smartphone className="w-8 h-8 text-primary-foreground" />
            </div>
            
            <h2 className="text-4xl md:text-5xl font-bold">
              Ready to Order?
            </h2>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Get started now and have premium flower delivered to your door in under 45 minutes.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button 
                variant="hero" 
                size="lg" 
                className="text-lg"
                onClick={() => {
                  const productsSection = document.getElementById('products');
                  productsSection?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Shop Now
              </Button>
              <Button 
                variant="outline" 
                size="lg" 
                className="text-lg"
                onClick={() => navigate('/support')}
              >
                Get Help
              </Button>
            </div>

            <p className="text-xs text-muted-foreground pt-4">
              Available in Brooklyn, Queens, and Manhattan • 21+ Only
            </p>
          </div>
        </Card>
      </div>
    </section>
  );
};

export default CTA;
