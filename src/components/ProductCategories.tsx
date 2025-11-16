import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Flower, Candy, Wind, Droplet } from "lucide-react";

const categories = [
  {
    icon: Flower,
    name: "Flower",
    description: "Premium strains, lab-tested",
    popular: true,
    sectionId: "flower",
  },
  {
    icon: Candy,
    name: "Edibles",
    description: "Gummies, chocolates, more",
    popular: false,
    sectionId: "edibles",
  },
  {
    icon: Wind,
    name: "Vapes",
    description: "Cartridges and disposables",
    popular: true,
    sectionId: "vapes",
  },
  {
    icon: Droplet,
    name: "Concentrates",
    description: "Wax, shatter, diamonds",
    popular: false,
    sectionId: "concentrates",
  },
];

const ProductCategories = () => {
  return (
    <section className="py-20 bg-gradient-hero">
      <div className="container px-4 mx-auto">
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-4xl md:text-5xl font-bold">Shop by Category</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Explore our full range of premium products
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto mb-12">
          {categories.map((category, index) => {
            const Icon = category.icon;
            return (
              <Card 
                key={index} 
                className="relative border-2 hover:border-primary transition-all duration-300 cursor-pointer hover:shadow-elegant hover:-translate-y-2 group"
                onClick={() => {
                  const categorySection = document.getElementById(category.sectionId);
                  if (categorySection) {
                    categorySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  } else {
                    // Fallback to products section if category not found
                    const productsSection = document.getElementById('products');
                    productsSection?.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
              >
                {category.popular && (
                  <div className="absolute -top-3 -right-3 px-3 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-full shadow-strong">
                    Popular
                  </div>
                )}
                <CardHeader className="text-center">
                  <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <Icon className="w-8 h-8 text-primary group-hover:scale-110 transition-transform" />
                  </div>
                  <CardTitle className="text-xl">{category.name}</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <p className="text-sm text-muted-foreground">{category.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="text-center">
          <Button 
            variant="hero" 
            size="lg"
            className="shadow-strong"
            onClick={() => {
              const productsSection = document.getElementById('products');
              productsSection?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            View All Products
          </Button>
        </div>
      </div>
    </section>
  );
};

export default ProductCategories;
