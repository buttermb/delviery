import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShoppingCart, Star, ArrowLeft, FileText, Plus, Minus, Award, Shield, ChevronDown } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useProductViewTracking } from "@/hooks/useProductViewTracking";
import StickyAddToCart from "@/components/StickyAddToCart";
import CustomerLayout from "@/layouts/CustomerLayout";
import { haptics } from "@/utils/haptics";
import { NativeShare } from "@/components/NativeShare";
import { ImageGallerySwipe } from "@/components/ImageGallerySwipe";

const ProductDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [quantity, setQuantity] = useState(1);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);
  const { trackProductView } = useProductViewTracking();

  // Track product view
  useEffect(() => {
    if (id) {
      trackProductView(id);
    }
  }, [id, trackProductView]);

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Product not found");
      return data;
    },
  });

  const { data: reviews } = useQuery({
    queryKey: ["reviews", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("*, profiles(user_id)")
        .eq("product_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const addToCart = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");

      const { data: existing } = await supabase
        .from("cart_items")
        .select()
        .eq("user_id", user.id)
        .eq("product_id", id!)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("cart_items")
          .update({ quantity: existing.quantity + quantity })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("cart_items")
          .insert({ user_id: user.id, product_id: id!, quantity });
        if (error) throw error;
      }
    },
    onMutate: () => {
      setIsAdding(true);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      toast({ title: "Added to cart!" });
      haptics.success(); // Success haptic
      setAddedToCart(true);
      setTimeout(() => setAddedToCart(false), 2000);
      setIsAdding(false);
    },
    onError: () => {
      toast({ title: "Failed to add to cart", variant: "destructive" });
      haptics.error(); // Error haptic
      setIsAdding(false);
    },
  });

  const submitReview = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("reviews").insert({
        user_id: user.id,
        product_id: id!,
        rating,
        comment,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews", id] });
      toast({ title: "Review submitted!" });
      setComment("");
      setRating(5);
    },
    onError: (error: any) => {
      if (error.message?.includes("duplicate")) {
        toast({ title: "You've already reviewed this product", variant: "destructive" });
      } else {
        toast({ title: "Failed to submit review", variant: "destructive" });
      }
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Product not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <CustomerLayout>
      <div className="container mx-auto px-4 py-8 pb-24 md:pb-8">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

      <div className="grid md:grid-cols-2 gap-8 mb-12">
        <div>
          {product.image_url && (
            <ImageGallerySwipe
              images={[product.image_url]}
              alt={product.name}
            />
          )}
        </div>

        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-4xl font-bold">{product.name}</h1>
              <NativeShare
                title={product.name}
                text={`Check out ${product.name} on NY Minute NYC`}
                url={`/product/${id}`}
              />
            </div>
            <div className="flex items-center gap-2 mb-4">
              <Badge variant="secondary">{product.category}</Badge>
              {product.average_rating > 0 && (
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="text-sm font-medium">{product.average_rating.toFixed(1)}</span>
                  <span className="text-sm text-muted-foreground">({product.review_count} reviews)</span>
                </div>
              )}
            </div>
            <p className="text-3xl font-bold text-primary">${product.price}</p>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold">Description</h3>
            <p className="text-muted-foreground">{product.description}</p>
          </div>

          {product.strain_info && (
            <div className="space-y-2">
              <h3 className="font-semibold">About This Strain</h3>
              <p className="text-muted-foreground">{product.strain_info}</p>
            </div>
          )}

          {/* Lab Testing & Compliance - Expandable Section */}
          <Collapsible className="border rounded-lg">
            <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
              <span className="font-semibold flex items-center gap-2">
                <Award className="w-5 h-5 text-primary" />
                Lab Testing & Compliance
              </span>
              <ChevronDown className="w-5 h-5 transition-transform ui-expanded:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="p-4 pt-0 space-y-3">
              <div className="text-sm space-y-2">
                <p className="flex items-center gap-2">
                  <span className="text-primary">✓</span>
                  <span>Third-party lab tested</span>
                </p>
                <p className="flex items-center gap-2">
                  <span className="text-primary">✓</span>
                  <span>Complies with federal and NY regulations</span>
                </p>
                <p className="flex items-center gap-2">
                  <span className="text-primary">✓</span>
                  <span>Certificate of Analysis available</span>
                </p>
              </div>
              
              <div className="pt-3 border-t space-y-2">
                <p className="font-semibold text-sm">Cannabinoid Profile:</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="p-2 bg-muted rounded">
                    <p className="text-xs text-muted-foreground">Total Cannabinoids</p>
                    <p className="font-bold">{product.thca_percentage || 0}%</p>
                  </div>
                  <div className="p-2 bg-muted rounded">
                    <p className="text-xs text-muted-foreground">CBD</p>
                    <p className="font-bold">&lt;1%</p>
                  </div>
                </div>
              </div>
              
              <div className="pt-3 border-t space-y-2">
                <p className="font-semibold text-sm">Safety Testing:</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <p className="flex items-center gap-1"><span className="text-primary">✓</span> Pesticide-free</p>
                  <p className="flex items-center gap-1"><span className="text-primary">✓</span> Heavy metals tested</p>
                  <p className="flex items-center gap-1"><span className="text-primary">✓</span> Microbial testing passed</p>
                  <p className="flex items-center gap-1"><span className="text-primary">✓</span> Residual solvents clean</p>
                </div>
              </div>
              
              <p className="text-xs text-muted-foreground italic pt-2">
                * This product is derived from hemp and contains less than 0.3% Delta-9 THC on a dry-weight basis.
              </p>
            </CollapsibleContent>
          </Collapsible>

          {/* Important Information - Expandable Section */}
          <Collapsible className="border rounded-lg">
            <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
              <span className="font-semibold flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Important Information
              </span>
              <ChevronDown className="w-5 h-5 transition-transform ui-expanded:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="p-4 pt-0 space-y-3 text-sm">
              <div className="space-y-2">
                <p className="font-semibold">Age Requirement:</p>
                <p className="text-muted-foreground">
                  Must be 21+ with valid government ID. ID verification required at delivery.
                </p>
              </div>
              
              <div className="space-y-2">
                <p className="font-semibold">Effects Notice:</p>
                <p className="text-muted-foreground">
                  This product contains cannabinoids that may produce intoxicating effects when heated or consumed. 
                  Do not operate vehicles or machinery after use.
                </p>
              </div>
              
              <div className="space-y-2">
                <p className="font-semibold">Drug Testing:</p>
                <p className="text-muted-foreground">
                  Use may result in positive drug test results.
                </p>
              </div>
              
              <div className="space-y-2">
                <p className="font-semibold">Legal Notice:</p>
                <p className="text-muted-foreground">
                  Customer is responsible for compliance with all local laws and regulations.
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {product.lab_results_url && (
            <Button variant="outline" asChild className="w-full">
              <a href={product.lab_results_url} target="_blank" rel="noopener noreferrer">
                <FileText className="mr-2 h-4 w-4" />
                View Lab Results
              </a>
            </Button>
          )}

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setQuantity(Math.max(1, quantity - 1))}>
                -
              </Button>
              <span className="w-12 text-center">{quantity}</span>
              <Button variant="outline" size="sm" onClick={() => setQuantity(quantity + 1)}>
                +
              </Button>
            </div>

            <Button
              className="flex-1"
              onClick={() => addToCart.mutate()}
              disabled={!product.in_stock || addToCart.isPending}
            >
              {addToCart.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ShoppingCart className="mr-2 h-4 w-4" />
              )}
              {product.in_stock ? "Add to Cart" : "Out of Stock"}
            </Button>
          </div>

          {!product.in_stock && (
            <p className="text-sm text-destructive">This product is currently out of stock</p>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Customer Reviews</h2>

        {user && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h3 className="font-semibold">Write a Review</h3>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button key={star} onClick={() => setRating(star)} className="focus:outline-none">
                    <Star
                      className={`h-6 w-6 ${
                        star <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
                      }`}
                    />
                  </button>
                ))}
              </div>
              <Textarea
                placeholder="Share your thoughts about this product..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <Button onClick={() => submitReview.mutate()} disabled={submitReview.isPending}>
                {submitReview.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit Review
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {reviews?.map((review) => (
            <Card key={review.id}>
              <CardContent className="pt-6">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-4 w-4 ${
                          star <= review.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {new Date(review.created_at).toLocaleDateString()}
                  </span>
                </div>
                {review.comment && <p className="text-muted-foreground">{review.comment}</p>}
              </CardContent>
            </Card>
          ))}

          {reviews?.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No reviews yet. Be the first to review!</p>
          )}
        </div>
      </div>

      {/* Sticky Add to Cart for Mobile */}
      <StickyAddToCart
        productName={product.name}
        price={product.price}
        quantity={quantity}
        onQuantityChange={setQuantity}
        onAddToCart={() => addToCart.mutate()}
        loading={isAdding}
        added={addedToCart}
      />
    </div>
    </CustomerLayout>
  );
};

export default ProductDetail;
