import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Bitcoin, DollarSign, Calendar as CalendarIcon, Clock, Zap, AlertTriangle, Download, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import Navigation from "@/components/Navigation";
import AuthModal from "@/components/AuthModal";
import MapboxAddressAutocomplete from "@/components/MapboxAddressAutocomplete";
import CheckoutUpsells from "@/components/CheckoutUpsells";
import CheckoutProgress from "@/components/CheckoutProgress";
import GuestCheckoutOption from "@/components/GuestCheckoutOption";
import HighValueCartNotice from "@/components/HighValueCartNotice";
import ExpressCheckoutButtons from "@/components/ExpressCheckoutButtons";
import LowCartValueUpsell from "@/components/LowCartValueUpsell";
import CouponInput from "@/components/CouponInput";
import { useCartValueTrigger } from "@/hooks/useCartValueTrigger";
import { getNeighborhoodFromZip, getRiskColor, getRiskLabel, getRiskTextColor } from "@/utils/neighborhoods";
import { analytics } from "@/utils/analytics";
import { useGuestCart } from "@/hooks/useGuestCart";
import { applyCoupon, getCouponByCode } from "@/lib/api/coupons";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";

const Checkout = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { guestCart, clearGuestCart } = useGuestCart();
  const queryClient = useQueryClient();
  const { triggerSelection, triggerSuccess, triggerError } = useHapticFeedback();
  
  // Load saved guest info from localStorage
  useEffect(() => {
    if (!user) {
      const saved = localStorage.getItem('guest_checkout_info');
      if (saved) {
        try {
          const data = JSON.parse(saved);
          setGuestName(data.name || "");
          setGuestPhone(data.phone || "");
          setGuestEmail(data.email || "");
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
  }, [user]);
  
  const [address, setAddress] = useState("");
  const [addressLat, setAddressLat] = useState<number>();
  const [addressLng, setAddressLng] = useState<number>();
  const [borough, setBorough] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number; couponId?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [deliveryType, setDeliveryType] = useState<"express" | "standard" | "economy">("standard");
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [detectedZipcode, setDetectedZipcode] = useState("");
  
  // Guest checkout fields
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  
  // Auth modal state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signup");
  
  // Legal confirmation checkboxes
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [legalConfirmed, setLegalConfirmed] = useState(false);
  const [termsConfirmed, setTermsConfirmed] = useState(false);
  
  // Save guest info to localStorage when changed
  useEffect(() => {
    if (!user && (guestName || guestPhone || guestEmail)) {
      localStorage.setItem('guest_checkout_info', JSON.stringify({
        name: guestName,
        phone: guestPhone,
        email: guestEmail
      }));
    }
  }, [guestName, guestPhone, guestEmail, user]);

  const timeSlots = [
    { value: "09:00-12:00", label: "Morning", time: "9:00 AM - 12:00 PM", icon: "🌅" },
    { value: "12:00-15:00", label: "Lunch", time: "12:00 PM - 3:00 PM", icon: "☀️" },
    { value: "15:00-18:00", label: "Afternoon", time: "3:00 PM - 6:00 PM", icon: "🌤️" },
    { value: "18:00-21:00", label: "Evening", time: "6:00 PM - 9:00 PM", icon: "🌆" },
  ];

  const getScheduledDateTime = () => {
    if (deliveryType !== "economy" || !selectedDate || !selectedTimeSlot) {
      return null;
    }
    const [startTime] = selectedTimeSlot.split("-");
    const [hours, minutes] = startTime.split(":");
    const dateTime = new Date(selectedDate);
    dateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    return dateTime.toISOString();
  };

  // Fetch authenticated user's cart
  const { data: dbCartItems = [] } = useQuery({
    queryKey: ["cart", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("cart_items")
        .select("*, products(*)")
        .eq("user_id", user.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Fetch product details for guest cart items
  const { data: guestProducts = [] } = useQuery({
    queryKey: ["guest-cart-products", guestCart.map(i => i.product_id).join(",")],
    queryFn: async () => {
      if (guestCart.length === 0) return [];
      const productIds = guestCart.map(item => item.product_id);
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .in("id", productIds);
      if (error) throw error;
      return data;
    },
    enabled: !user && guestCart.length > 0,
  });

  // Combine guest cart items with product data
  const guestCartItems = user ? [] : guestCart.map(item => ({
    ...item,
    id: `${item.product_id}-${item.selected_weight}`,
    products: guestProducts.find(p => p.id === item.product_id)
  })).filter(item => item.products);

  const cartItems = user ? dbCartItems : guestCartItems;

  const getItemPrice = (item: any) => {
    const product = item.products;
    const selectedWeight = item.selected_weight || "unit";
    
    if (product?.prices && typeof product.prices === 'object') {
      return product.prices[selectedWeight] || product.price || 0;
    }
    return product?.price || 0;
  };

  const subtotal = cartItems.reduce(
    (sum, item) => sum + getItemPrice(item) * item.quantity,
    0
  );

  // Guest checkout is now always available - no popup blocking

  // Fetch courier availability for dynamic pricing
  const { data: courierAvailability } = useQuery({
    queryKey: ["courier-availability"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("couriers")
        .select("id")
        .eq("is_online", true)
        .eq("is_active", true);
      
      if (error) throw error;
      return data?.length || 0;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Check if this is user's first order
  const { data: orderCount = 0 } = useQuery({
    queryKey: ["order-count", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count, error } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
  });

  const isFirstOrder = user && orderCount === 0;

  const calculateDeliveryFee = (isGuest = !user) => {
    if (!borough) return 0;
    
    // Free delivery for orders $100+ (both member and guest)
    if (subtotal >= 100) return 0;
    
    // Brooklyn/Queens pricing
    if (borough === "brooklyn" || borough === "queens") {
      return isGuest ? 5.50 : 5.00;
    }
    
    // Manhattan pricing (includes $5 city surcharge)
    if (borough === "manhattan") {
      return isGuest ? 11.00 : 10.00;
    }
    
    return 0;
  };

  const deliveryFee = calculateDeliveryFee();
  const guestDeliveryFee = calculateDeliveryFee(true);
  
  // Welcome discount (10% off for new users who just signed up)
  const { data: welcomeDiscount } = useQuery({
    queryKey: ["welcome-discount", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("user_welcome_discounts")
        .select("*")
        .eq("user_id", user.id)
        .eq("used", false)
        .gte("expires_at", new Date().toISOString())
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!user,
  });

  const welcomeDiscountAmount = welcomeDiscount ? subtotal * (welcomeDiscount.discount_percentage / 100) : 0;
  
  // First order discount for members only (10% off subtotal) - only if no welcome discount
  const firstOrderDiscount = isFirstOrder && !welcomeDiscount ? subtotal * 0.10 : 0;
  
  // Coupon discount
  const couponDiscount = appliedCoupon?.discount || 0;
  
  const total = subtotal + deliveryFee - welcomeDiscountAmount - firstOrderDiscount - couponDiscount;
  const guestTotal = subtotal + guestDeliveryFee - couponDiscount;

  const handleCouponApplied = async (discount: number, code: string) => {
    // Fetch full coupon details to get ID
    const coupon = await getCouponByCode(code);
    setAppliedCoupon({ 
      code, 
      discount,
      couponId: coupon?.id 
    });
  };

  const handleCouponRemoved = () => {
    setAppliedCoupon(null);
  };

  const handleAddressChange = (newAddress: string, lat?: number, lng?: number, detectedBorough?: string) => {
    setAddress(newAddress);
    if (lat) setAddressLat(lat);
    if (lng) setAddressLng(lng);
    
    // Auto-extract ZIP code from address
    const zipMatch = newAddress.match(/\b\d{5}\b/);
    if (zipMatch) {
      setDetectedZipcode(zipMatch[0]);
    }
    
    if (detectedBorough) {
      setBorough(detectedBorough);
      const boroughNames: Record<string, string> = {
        brooklyn: "Brooklyn",
        queens: "Queens",
        manhattan: "Manhattan"
      };
      toast.success(`✓ ${boroughNames[detectedBorough]} detected - Delivery fee updated`);
    }
  };

  const handlePlaceOrder = async () => {
    // Track checkout started
    analytics.trackCheckoutStarted(subtotal, cartItems.length, !user);

    if (cartItems.length === 0) {
      triggerError();
      toast.error("Your cart is empty");
      navigate("/");
      return;
    }

    if (!address || !borough) {
      triggerError();
      toast.error("Please enter a delivery address and select borough");
      return;
    }

    // Guest checkout validation
    if (!user) {
      if (!guestName.trim()) {
        triggerError();
        toast.error("Please enter your name");
        return;
      }
      if (!guestPhone.trim()) {
        triggerError();
        toast.error("Please enter your phone number");
        return;
      }
      if (!guestEmail.trim() || !guestEmail.includes('@')) {
        triggerError();
        toast.error("Please enter a valid email address");
        return;
      }
    }

    if (deliveryType === "economy" && (!selectedDate || !selectedTimeSlot)) {
      triggerError();
      toast.error("Please select a delivery date and time slot");
      return;
    }
    
    // Validate legal confirmations
    if (!ageConfirmed) {
      triggerError();
      toast.error("Please confirm you are 21+ to proceed");
      return;
    }
    
    if (!legalConfirmed) {
      triggerError();
      toast.error("Please accept the legal terms to proceed");
      return;
    }
    
    if (!termsConfirmed) {
      triggerError();
      toast.error("Please accept the terms and conditions to proceed");
      return;
    }

    setLoading(true);

    try {
      // Prepare order data for edge function
      const orderData = {
        userId: user?.id,
        deliveryAddress: address,
        deliveryBorough: borough,
        paymentMethod,
        deliveryFee,
        subtotal,
        totalAmount: total,
        scheduledDeliveryTime: getScheduledDateTime(),
        deliveryNotes: notes || undefined,
        dropoffLat: addressLat,
        dropoffLng: addressLng,
        customerName: user ? undefined : guestName,
        customerPhone: user ? undefined : guestPhone,
        customerEmail: user ? undefined : guestEmail,
        cartItems: cartItems.map(item => ({
          productId: item.product_id,
          quantity: item.quantity,
          price: getItemPrice(item),
          productName: item.products?.name || "",
          selectedWeight: item.selected_weight || "unit"
        }))
      };

      // Call optimized edge function
      const { data, error } = await supabase.functions.invoke('create-order', {
        body: orderData
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      // Mark welcome discount as used if applied
      if (welcomeDiscount && user?.id) {
        await supabase
          .from("user_welcome_discounts")
          .update({
            used: true,
            used_at: new Date().toISOString(),
            order_id: data.orderId
          })
          .eq("id", welcomeDiscount.id);
      }

      // Track coupon usage if applied
      if (appliedCoupon?.couponId && user?.id) {
        await applyCoupon(
          appliedCoupon.couponId,
          user.id,
          data.orderId,
          appliedCoupon.discount
        );
      }

      // Clear cart
      if (user) {
        // Authenticated user - edge function handles DB clear in background
        queryClient.invalidateQueries({ queryKey: ["cart", user.id] });
        queryClient.invalidateQueries({ queryKey: ["cart"] });
      } else {
        // Guest - clear localStorage cart
        clearGuestCart();
        queryClient.invalidateQueries({ queryKey: ["guest-cart-products"] });
      }

      triggerSuccess();
      toast.success("Order placed successfully!");
      
      // Track order completion
      analytics.trackOrderCompleted(total, couponDiscount, !user);
      
      navigate(`/order-confirmation?orderId=${data.orderId}`);
    } catch (error: any) {
      triggerError();
      console.error('Order error:', error);
      toast.error(error.message || "Failed to place order");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-background py-4 md:py-8 pb-24 md:pb-8">
        <div className="container max-w-4xl mx-auto px-4 md:px-6 w-full overflow-x-hidden">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Shop
          </Button>

        <h1 className="text-2xl md:text-3xl font-bold mb-2">Checkout</h1>
        
        <CheckoutProgress currentStep={2} />

        {/* Low cart value upsell - encourage adding more */}
        {!user && subtotal < 25 && (
          <LowCartValueUpsell currentTotal={subtotal} targetAmount={25} />
        )}

        {/* Guest Checkout Choice - Prominent at Top */}
        {!user && (
          <GuestCheckoutOption
            cartTotal={subtotal}
            borough={borough}
            memberDeliveryFee={calculateDeliveryFee(false)}
            guestDeliveryFee={calculateDeliveryFee(true)}
            onGuestCheckout={() => {
              // Scroll to guest information form
              const guestInfoCard = document.getElementById('guest-info-form');
              if (guestInfoCard) {
                guestInfoCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
                toast.success("Continue filling out your information below");
              }
            }}
            onSignup={() => {
              // Open signup modal
              setAuthMode("signup");
              setShowAuthModal(true);
            }}
          />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-8 w-full">
          <div className="lg:col-span-2 space-y-4 md:space-y-6 w-full min-w-0">
            {/* Guest Checkout Info */}
            {!user && (
              <Card id="guest-info-form" className="border-primary/20 bg-primary/5 scroll-mt-24">
                <CardHeader className="pb-3 md:pb-6">
                  <CardTitle className="text-base md:text-lg flex items-center gap-2">
                    <span className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs md:text-sm">
                      ℹ️
                    </span>
                    <span className="text-sm md:text-base">Your Information</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 md:space-y-4">
                  <div className="space-y-2 w-full">
                    <Label htmlFor="guest-name" className="text-sm font-medium">Full Name *</Label>
                    <Input
                      id="guest-name"
                      name="name"
                      autoComplete="name"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="John Doe"
                      className="w-full h-12 text-base"
                      required
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="guest-phone" className="text-sm font-medium">Phone Number *</Label>
                    <Input
                      id="guest-phone"
                      name="tel"
                      type="tel"
                      autoComplete="tel"
                      inputMode="numeric"
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value)}
                      placeholder="(555) 123-4567"
                      className="h-12 text-base"
                      required
                    />
                    <p className="text-xs text-muted-foreground mt-1.5">
                      For delivery updates
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="guest-email" className="text-sm font-medium">Email Address *</Label>
                    <Input
                      id="guest-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      placeholder="john@example.com"
                      className="h-12 text-base"
                      required
                    />
                    <p className="text-xs text-muted-foreground mt-1.5">
                      Order confirmation sent here
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 1: Delivery Address */}
            <Card>
              <CardHeader className="pb-3 md:pb-6">
                <CardTitle className="text-base md:text-lg flex items-center gap-2">
                  <span className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs md:text-sm">
                    1
                  </span>
                  <span className="text-sm md:text-base">Delivery Address</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 md:space-y-4">
                <MapboxAddressAutocomplete
                  value={address}
                  onChange={handleAddressChange}
                  placeholder="Start typing your NYC address..."
                  className="mb-4"
                />
                
                <div className="space-y-3">
                  <Label htmlFor="borough">
                    Select Borough {borough && <span className="text-primary font-semibold">• {borough.charAt(0).toUpperCase() + borough.slice(1)}</span>}
                  </Label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => !addressLat ? setBorough("brooklyn") : null}
                      disabled={addressLat && borough !== "brooklyn"}
                      className={cn(
                        "p-4 rounded-lg border-2 text-left transition-all",
                        borough === "brooklyn"
                          ? "border-primary bg-primary/10 shadow-lg"
                          : addressLat && borough !== "brooklyn"
                          ? "border-border/30 opacity-40 cursor-not-allowed"
                          : "border-border hover:border-primary/50 hover:scale-[1.02]"
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-2xl">🌉</span>
                        {borough === "brooklyn" && (
                          <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">✓</span>
                        )}
                      </div>
                      <h4 className="font-semibold mb-1">Brooklyn</h4>
                      <div className="text-xs space-y-0.5">
                        <p className="text-muted-foreground">Member: <span className="font-semibold text-foreground">$5</span></p>
                        <p className="text-muted-foreground">Guest: <span className="font-semibold text-foreground">$5.50</span></p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => !addressLat ? setBorough("queens") : null}
                      disabled={addressLat && borough !== "queens"}
                      className={cn(
                        "p-4 rounded-lg border-2 text-left transition-all",
                        borough === "queens"
                          ? "border-primary bg-primary/10 shadow-lg"
                          : addressLat && borough !== "queens"
                          ? "border-border/30 opacity-40 cursor-not-allowed"
                          : "border-border hover:border-primary/50 hover:scale-[1.02]"
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-2xl">👑</span>
                        {borough === "queens" && (
                          <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">✓</span>
                        )}
                      </div>
                      <h4 className="font-semibold mb-1">Queens</h4>
                      <div className="text-xs space-y-0.5">
                        <p className="text-muted-foreground">Member: <span className="font-semibold text-foreground">$5</span></p>
                        <p className="text-muted-foreground">Guest: <span className="font-semibold text-foreground">$5.50</span></p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => !addressLat ? setBorough("manhattan") : null}
                      disabled={addressLat && borough !== "manhattan"}
                      className={cn(
                        "p-4 rounded-lg border-2 text-left transition-all",
                        borough === "manhattan"
                          ? "border-primary bg-primary/10 shadow-lg"
                          : addressLat && borough !== "manhattan"
                          ? "border-border/30 opacity-40 cursor-not-allowed"
                          : "border-border hover:border-primary/50 hover:scale-[1.02]"
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-2xl">🏙️</span>
                        {borough === "manhattan" && (
                          <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">✓</span>
                        )}
                      </div>
                      <h4 className="font-semibold mb-1">Manhattan</h4>
                      <div className="text-xs space-y-0.5">
                        <p className="text-muted-foreground">Member: <span className="font-semibold text-foreground">$10</span></p>
                        <p className="text-muted-foreground">Guest: <span className="font-semibold text-foreground">$11</span></p>
                        <p className="text-orange-600 dark:text-orange-400 font-medium">(+$5 city surcharge)</p>
                      </div>
                    </button>
                  </div>
                  <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                    <p className="text-xs font-medium text-primary flex items-center gap-1.5">
                      💡 FREE delivery on all orders $100+
                    </p>
                  </div>
                </div>

                {/* Free Delivery Progress */}
                {subtotal < 100 && (
                  <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-primary">🚚 Free Delivery Progress</span>
                      <span className="font-semibold text-primary">${(100 - subtotal).toFixed(2)} away!</span>
                    </div>
                    <div className="relative w-full h-3 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min((subtotal / 100) * 100, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Add ${(100 - subtotal).toFixed(2)} more to qualify for FREE delivery!
                    </p>
                  </div>
                )}

                {subtotal >= 100 && (
                  <div className="p-4 bg-primary/10 border border-primary/30 rounded-lg">
                    <p className="text-sm font-semibold text-primary flex items-center gap-2">
                      ✓ FREE delivery unlocked! 🎉
                    </p>
                    <p className="text-xs text-primary/80 mt-1">
                      No delivery fee on this order
                    </p>
                  </div>
                )}

                {/* Delivery Timing */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Delivery Speed</Label>
                    {deliveryType && (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {deliveryType === "express" && "~25-45 min"}
                        {deliveryType === "standard" && "~45-90 min"}
                        {deliveryType === "economy" && "Scheduled"}
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => setDeliveryType("express")}
                      className={cn(
                        "w-full flex items-center justify-between p-4 border-2 rounded-lg cursor-pointer transition-all",
                        deliveryType === "express" 
                          ? "border-primary bg-primary/5" 
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Zap className="w-5 h-5 text-primary" />
                        </div>
                        <div className="text-left">
                          <h4 className="font-semibold flex items-center gap-2">
                            Express
                            <span className="text-xs font-normal text-primary">~25-45 min</span>
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            {subtotal >= 500 ? 'FREE!' : subtotal >= 100 ? '+30% delivery fee' : '+30% delivery fee'}
                          </p>
                        </div>
                      </div>
                      {deliveryType === "express" && (
                        <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">✓</span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeliveryType("standard")}
                      className={cn(
                        "w-full flex items-center justify-between p-4 border-2 rounded-lg cursor-pointer transition-all",
                        deliveryType === "standard" 
                          ? "border-primary bg-primary/5" 
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Clock className="w-5 h-5 text-primary" />
                        </div>
                        <div className="text-left">
                          <h4 className="font-semibold flex items-center gap-2">
                            Standard
                            <span className="text-xs font-normal text-primary">~45-90 min</span>
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            {subtotal >= 100 ? 'FREE!' : 'Normal delivery fee'}
                          </p>
                        </div>
                      </div>
                      {deliveryType === "standard" && (
                        <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">✓</span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeliveryType("economy")}
                      className={cn(
                        "w-full flex items-center justify-between p-4 border-2 rounded-lg cursor-pointer transition-all",
                        deliveryType === "economy" 
                          ? "border-primary bg-primary/5" 
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <CalendarIcon className="w-5 h-5 text-primary" />
                        </div>
                        <div className="text-left">
                          <h4 className="font-semibold flex items-center gap-2">
                            Schedule for Later
                            <span className="text-xs font-normal text-primary">Pick time</span>
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            {subtotal >= 100 ? 'FREE!' : 'Choose date & time'}
                          </p>
                        </div>
                      </div>
                      {deliveryType === "economy" && (
                        <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">✓</span>
                      )}
                    </button>
                  </div>

                  {deliveryType === "economy" && (
                    <div className="space-y-4 pt-2 animate-in fade-in-50 duration-300">
                      {/* Date Selection */}
                      <div className="space-y-2">
                        <Label>Select Date</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !selectedDate && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={selectedDate}
                              onSelect={setSelectedDate}
                              disabled={(date) => date < new Date() || date > new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)}
                              initialFocus
                              className={cn("p-3 pointer-events-auto")}
                            />
                          </PopoverContent>
                        </Popover>
                        <p className="text-xs text-muted-foreground">
                          Available up to 7 days in advance
                        </p>
                      </div>

                      {/* Time Slot Selection */}
                      {selectedDate && (
                        <div className="space-y-2 animate-in fade-in-50 duration-300">
                          <Label>Select Time Slot</Label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {timeSlots.map((slot) => (
                              <Button
                                key={slot.value}
                                type="button"
                                variant={selectedTimeSlot === slot.value ? "default" : "outline"}
                                className={cn(
                                  "h-auto py-3 flex-col items-start gap-1 transition-all",
                                  selectedTimeSlot === slot.value && "ring-2 ring-primary ring-offset-2"
                                )}
                                onClick={() => setSelectedTimeSlot(slot.value)}
                              >
                                <div className="flex items-center gap-2 w-full">
                                  <span className="text-lg">{slot.icon}</span>
                                  <span className="font-semibold">{slot.label}</span>
                                </div>
                                <span className="text-xs opacity-80">{slot.time}</span>
                              </Button>
                            ))}
                          </div>
                          {selectedTimeSlot && (
                            <div className="p-3 bg-primary/10 rounded-lg">
                              <p className="text-sm font-medium text-primary">
                                📅 Scheduled for {format(selectedDate, "EEEE, MMMM d")} • {timeSlots.find(s => s.value === selectedTimeSlot)?.time}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Delivery Notes (Optional)</Label>
                  <Input
                    id="notes"
                    name="delivery-notes"
                    autoComplete="off"
                    placeholder="Apt #, building instructions, buzzer code"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>

                {detectedZipcode.length === 5 && (() => {
                  const neighborhood = getNeighborhoodFromZip(detectedZipcode);
                  if (!neighborhood) return null;
                  
                  return (
                    <Card className="border-2 animate-in fade-in-50 duration-300">
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-4">
                          <div className={`w-16 h-16 ${getRiskColor(neighborhood.risk)} rounded-lg flex flex-col items-center justify-center text-white flex-shrink-0`}>
                            <div className="text-2xl font-bold">{neighborhood.risk}</div>
                            <div className="text-xs">/10</div>
                          </div>
                          <div className="flex-1">
                            <div className="font-semibold text-lg">{neighborhood.name}</div>
                            <div className="text-sm text-muted-foreground">{neighborhood.borough}</div>
                            <div className={`text-sm font-semibold mt-1 flex items-center gap-2 ${getRiskTextColor(neighborhood.risk)}`}>
                              <AlertTriangle className="w-4 h-4" />
                              {getRiskLabel(neighborhood.risk)} Delivery Zone
                            </div>
                          </div>
                          {neighborhood.risk >= 7 && (
                            <div className="text-xs bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-3 py-2 rounded-lg">
                              <div className="font-bold">High Risk Area</div>
                              <div>Extra verification required</div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}
              </CardContent>
            </Card>

            {/* Step 2: Payment Method */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm">
                    2
                  </span>
                  Payment Method
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Express Checkout Options */}
                <div className="space-y-3">
                  <p className="text-sm font-medium text-muted-foreground">Express Checkout</p>
                  <ExpressCheckoutButtons />
                </div>

                <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
                  <div className="flex items-center space-x-2 p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value="cash" id="cash" />
                    <Label htmlFor="cash" className="flex items-center gap-3 cursor-pointer flex-1">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <DollarSign className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">Cash on Delivery</div>
                        <div className="text-sm text-muted-foreground">Pay the courier when you receive your order</div>
                      </div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value="bitcoin" id="bitcoin" />
                    <Label htmlFor="bitcoin" className="flex items-center gap-3 cursor-pointer flex-1">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Bitcoin className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">Bitcoin / USDC</div>
                        <div className="text-sm text-muted-foreground">We'll send payment instructions after order</div>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>

                {paymentMethod === "bitcoin" && (
                  <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                    <p className="text-sm font-medium">Cryptocurrency Payment Instructions:</p>
                    <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                      <li>After placing your order, you'll receive payment details</li>
                      <li>We accept Bitcoin (BTC) and USDC</li>
                      <li>Your order will be prepared once payment is confirmed</li>
                      <li>Confirmation typically takes 10-30 minutes</li>
                    </ul>
                  </div>
                )}

                {paymentMethod === "cash" && (
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      💡 Please have exact change ready. Our couriers will verify your ID (must be 21+) before completing delivery.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Upsells - Frequently Bought Together */}
            <CheckoutUpsells cartItems={cartItems} />
          </div>

          {/* Order Summary */}
          <div>
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {cartItems.map((item) => {
                    const itemPrice = getItemPrice(item);
                    const selectedWeight = item.selected_weight || "unit";
                    const coaUrl = item.products?.coa_url || item.products?.coa_pdf_url || item.products?.lab_results_url;
                    
                    return (
                      <div key={item.id} className="border-b pb-3 last:border-0 last:pb-0">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium">
                            {item.products?.name} x{item.quantity}
                            {selectedWeight !== "unit" && (
                              <span className="text-muted-foreground ml-1">
                                ({selectedWeight})
                              </span>
                            )}
                          </span>
                          <span className="font-semibold">
                            ${(itemPrice * item.quantity).toFixed(2)}
                          </span>
                        </div>
                        {coaUrl && (
                          <a 
                            href={coaUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            <Download className="w-3 h-3" />
                            View COA
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2">
                      Delivery Fee
                      {subtotal >= 100 && (
                        <span className="text-xs px-1.5 py-0.5 bg-primary/20 text-primary rounded font-semibold">
                          FREE ✓
                        </span>
                      )}
                      {!user && (
                        <span className="text-xs px-1.5 py-0.5 bg-muted rounded">
                          Guest
                        </span>
                      )}
                    </span>
                    <span className={subtotal >= 100 ? "line-through text-muted-foreground" : ""}>
                      ${deliveryFee.toFixed(2)}
                    </span>
                  </div>
                  {borough === "manhattan" && deliveryFee > 0 && (
                    <div className="text-xs text-muted-foreground pl-4">
                      <div>Base fee: ${user ? "5.00" : "5.50"}</div>
                      <div>City surcharge: ${user ? "5.00" : "5.50"}</div>
                    </div>
                  )}
                  {welcomeDiscountAmount > 0 && (
                    <div className="flex justify-between text-sm text-primary">
                      <span className="flex items-center gap-2">
                        Welcome Discount ({welcomeDiscount?.discount_percentage}%)
                        <span className="text-xs px-1.5 py-0.5 bg-primary/20 rounded font-semibold">
                          NEW
                        </span>
                      </span>
                      <span>-${welcomeDiscountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  {firstOrderDiscount > 0 && (
                    <div className="flex justify-between text-sm text-primary">
                      <span className="flex items-center gap-2">
                        First Order Discount (10%)
                        <span className="text-xs px-1.5 py-0.5 bg-primary/20 rounded font-semibold">
                          NEW
                        </span>
                      </span>
                      <span>-${firstOrderDiscount.toFixed(2)}</span>
                    </div>
                  )}
                   {couponDiscount > 0 && (
                     <div className="flex justify-between text-sm text-primary">
                       <span>Coupon Discount ({appliedCoupon?.code})</span>
                       <span>-${couponDiscount.toFixed(2)}</span>
                     </div>
                   )}
                </div>

                <Separator />

                 {/* Coupon Code Input */}
                 <div className="space-y-2">
                   <Label>Promo Code</Label>
                   <CouponInput
                     cartTotal={subtotal}
                     onCouponApplied={handleCouponApplied}
                     onCouponRemoved={handleCouponRemoved}
                     appliedCode={appliedCoupon?.code}
                   />
                 </div>

                <Separator />

                {/* Member Savings Display */}
                {(welcomeDiscountAmount > 0 || firstOrderDiscount > 0) && (
                  <div className="p-4 bg-primary/10 border border-primary/30 rounded-lg space-y-2">
                    <p className="text-sm font-semibold text-primary flex items-center gap-2">
                      🎉 You're saving ${((welcomeDiscountAmount || firstOrderDiscount) + (guestDeliveryFee - deliveryFee)).toFixed(2)} today!
                    </p>
                    <div className="text-xs text-primary/80 space-y-1">
                      {welcomeDiscountAmount > 0 && <div>• ${welcomeDiscountAmount.toFixed(2)} welcome discount</div>}
                      {firstOrderDiscount > 0 && <div>• ${firstOrderDiscount.toFixed(2)} first order discount</div>}
                      <div>• ${(guestDeliveryFee - deliveryFee).toFixed(2)} member delivery rate</div>
                    </div>
                  </div>
                )}

                {/* Guest Upsell to Member */}
                {!user && subtotal < 100 && (
                  <div className="p-4 bg-muted rounded-lg space-y-2">
                    <p className="text-sm font-medium">💰 Create account to save ${((subtotal * 0.1) + (guestDeliveryFee - calculateDeliveryFee(false))).toFixed(2)}</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        setAuthMode("signup");
                        setShowAuthModal(true);
                      }}
                      className="w-full"
                    >
                      Switch to Member Checkout
                    </Button>
                  </div>
                )}

                <Separator />

                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>

                {/* Legal Confirmation Progress */}
                {(ageConfirmed || legalConfirmed || termsConfirmed) && (
                  <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-primary">Legal Confirmations</span>
                      <span className="font-semibold text-primary">
                        {[ageConfirmed, legalConfirmed, termsConfirmed].filter(Boolean).length} / 3 completed
                      </span>
                    </div>
                    <div className="mt-2 flex gap-1">
                      {[ageConfirmed, legalConfirmed, termsConfirmed].map((checked, i) => (
                        <div
                          key={i}
                          className={cn(
                            "h-1 flex-1 rounded-full transition-colors",
                            checked ? "bg-primary" : "bg-muted"
                          )}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Legal Confirmation Checkboxes */}
                <div className="space-y-3 pt-2">
                  <div className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border-2 transition-all",
                    ageConfirmed 
                      ? "bg-primary/5 border-primary/30" 
                      : "bg-muted/50 border-muted"
                  )}>
                    <Checkbox 
                      id="age-confirm"
                      checked={ageConfirmed}
                      onCheckedChange={(checked) => {
                        triggerSelection();
                        setAgeConfirmed(checked as boolean);
                      }}
                      className="mt-0.5"
                    />
                    <label htmlFor="age-confirm" className="text-sm flex-1 cursor-pointer leading-relaxed">
                      <span className="font-semibold text-primary">Age Verification Required:</span> I certify that I am 21 years of age or older and will provide valid government ID at delivery. I acknowledge that the courier will verify my age before completing the delivery.
                    </label>
                  </div>
                  
                  <div className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border-2 transition-all",
                    legalConfirmed 
                      ? "bg-primary/5 border-primary/30" 
                      : "bg-muted/50 border-muted"
                  )}>
                    <Checkbox 
                      id="legal-confirm"
                      checked={legalConfirmed}
                      onCheckedChange={(checked) => {
                        triggerSelection();
                        setLegalConfirmed(checked as boolean);
                      }}
                      className="mt-0.5"
                    />
                    <label htmlFor="legal-confirm" className="text-sm flex-1 cursor-pointer leading-relaxed">
                      <span className="font-semibold text-primary">Legal Compliance:</span> I understand these products are derived from hemp, may produce effects when consumed, and may result in positive drug tests. I am responsible for compliance with local laws regarding hemp-derived products.
                    </label>
                  </div>
                  
                  <div className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border-2 transition-all",
                    termsConfirmed 
                      ? "bg-primary/5 border-primary/30" 
                      : "bg-muted/50 border-muted"
                  )}>
                    <Checkbox 
                      id="terms-confirm"
                      checked={termsConfirmed}
                      onCheckedChange={(checked) => {
                        triggerSelection();
                        setTermsConfirmed(checked as boolean);
                      }}
                      className="mt-0.5"
                    />
                    <label htmlFor="terms-confirm" className="text-sm flex-1 cursor-pointer leading-relaxed">
                      <span className="font-semibold text-primary">Terms & Conditions:</span> I agree to the terms of sale, delivery policy, and refund policy. I understand all sales are final unless the product is defective or incorrect. I agree to receive delivery updates via phone/SMS.
                    </label>
                  </div>
                </div>

                <Button
                  variant="hero"
                  className="w-full h-14 text-lg"
                  size="lg"
                  onClick={handlePlaceOrder}
                  disabled={!address || !borough || loading || !ageConfirmed || !legalConfirmed || !termsConfirmed}
                >
                  {loading ? "Placing Order..." : (ageConfirmed && legalConfirmed && termsConfirmed) ? "Place Order" : "Accept All Terms to Continue"}
                </Button>

                {/* Prominent 21+ Age Verification Notice */}
                <div className="p-4 bg-primary/5 rounded-lg border-2 border-primary/20">
                  <p className="text-sm text-center font-semibold mb-1">
                    🔞 Age Verification Required
                  </p>
                  <p className="text-xs text-center text-muted-foreground">
                    Must be 21+ • Valid ID required at delivery
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        </div>
      </div>
      
      <AuthModal
        open={showAuthModal}
        onOpenChange={setShowAuthModal}
        mode={authMode}
        onModeChange={setAuthMode}
      />
    </>
  );
};

export default Checkout;
