
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  ArrowLeft,
  Truck,
  CreditCard,
  CheckCircle2,
  MapPin,
  Calendar,
  MessageSquare,
  Loader2
} from "lucide-react";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { formatSmartDate } from "@/lib/formatters";
import { useGuestCart } from "@/hooks/useGuestCart";
import { toast } from "sonner";
import { SuccessState } from "@/components/shared/SuccessState";
import type { User } from "@supabase/supabase-js";
import type { RenderCartItem } from "@/types/cart";
import type { LucideIcon } from "lucide-react";
import { CustomerMobileNav } from "@/components/customer/CustomerMobileNav";
import { CustomerMobileBottomNav } from "@/components/customer/CustomerMobileBottomNav";
import { queryKeys } from "@/lib/queryKeys";
import { STORAGE_KEYS } from "@/constants/storageKeys";

type CheckoutStep = "cart" | "delivery" | "payment" | "review";

export default function CheckoutPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tenant } = useCustomerAuth();
  const tenantId = tenant?.id;
  const { guestCart } = useGuestCart();
  const [user, setUser] = useState<User | null>(null);
  const [currentStep, setCurrentStep] = useState<CheckoutStep>("delivery");
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [showAddAddressDialog, setShowAddAddressDialog] = useState(false);
  const [newAddress, setNewAddress] = useState({
    street: "",
    city: "",
    state: "NY",
    zip: "",
    borough: "",
  });

  // Form state
  const [deliveryInfo, setDeliveryInfo] = useState({
    addressId: "",
    preferredDate: "",
    instructions: "",
  });

  const [paymentMethod, setPaymentMethod] = useState<"card" | "terms" | "cod">("card");
  const [isAddingAddress, setIsAddingAddress] = useState(false);

  // Get current user session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
  }, []);

  // Fetch cart items
  const { data: dbCartItems = [], isLoading: _dbLoading } = useQuery({
    queryKey: queryKeys.cart.user(user?.id, tenantId),
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
    staleTime: Infinity,
  });

  // Fetch product details for guest cart
  const { data: guestProducts = [] } = useQuery({
    queryKey: queryKeys.guestCartProducts.byIds(guestCart.map(i => i.product_id).sort().join(",")),
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
    staleTime: Infinity,
  });

  // Fetch saved addresses for authenticated users
  const { data: savedAddresses = [] } = useQuery({
    queryKey: queryKeys.customerAddresses.byUser(user?.id),
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("addresses")
        .select("*")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Combine cart items (optimized: Map for O(1) lookups)
  const guestCartItems = useMemo(() => {
    if (user) return [];

    // Create Map for O(1) product lookups instead of O(n) find() in loop
    const productMap = new Map(guestProducts.map(p => [p.id, p]));

    return guestCart.reduce<RenderCartItem[]>((acc, item) => {
      const product = productMap.get(item.product_id);
      if (product) {
        acc.push({
          ...item,
          id: `${item.product_id}-${item.selected_weight}`,
          products: product as unknown as RenderCartItem["products"]
        } as RenderCartItem);
      }
      return acc;
    }, []);
  }, [user, guestCart, guestProducts]);

  const cartItems = user ? dbCartItems : guestCartItems;

  // Get order notes from sessionStorage
  const orderNotes = typeof window !== "undefined" ? sessionStorage.getItem("orderNotes") || "" : "";

  // Calculate totals
  const getItemPrice = (item: RenderCartItem) => {
    const product = item?.products;
    if (!product) return 0;
    const selectedWeight = item?.selected_weight || "unit";
    if (product?.prices && typeof product.prices === 'object') {
      const price = product.prices[selectedWeight];
      return price ? Number(price) : Number(product.price) || 0;
    }
    return Number(product.price) || 0;
  };

  const subtotal = (cartItems as RenderCartItem[]).reduce((sum, item) => sum + getItemPrice(item) * item.quantity, 0);
  const taxRate = 0.085;
  const tax = subtotal * taxRate;
  const deliveryFee = subtotal >= 1000 ? 0 : 0;
  const total = subtotal + tax + deliveryFee;

  // Set default address
  useEffect(() => {
    if (savedAddresses.length > 0 && !deliveryInfo.addressId) {
      const defaultAddress = savedAddresses.find(addr => addr.is_default) || savedAddresses[0];
      setDeliveryInfo(prev => ({ ...prev, addressId: defaultAddress.id }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only set default address when savedAddresses loads, not when deliveryInfo changes
  }, [savedAddresses]);

  // Set default delivery date (7 days from now)
  useEffect(() => {
    if (!deliveryInfo.preferredDate) {
      const date = new Date();
      date.setDate(date.getDate() + 7);
      setDeliveryInfo(prev => ({
        ...prev,
        preferredDate: date.toISOString().split('T')[0]
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only set default date once on mount, not when deliveryInfo changes
  }, []);

  // Handle place order
  const handlePlaceOrder = async () => {
    if (cartItems.length === 0) {
      toast.error("Cart is empty");
      return;
    }

    if (!deliveryInfo.addressId && !user) {
      toast.error("Please provide delivery address");
      return;
    }

    try {
      // Generate order number
      const orderNum = `ORD-${Date.now().toString().slice(-6)}`;
      setOrderNumber(orderNum);

      // In a real implementation, you would:
      // 1. Create order in database
      // 2. Create order items
      // 3. Clear cart
      // 4. Send confirmation email

      // For now, simulate success
      setOrderPlaced(true);

      // Clear cart
      if (user) {
        await supabase.from("cart_items").delete().eq("user_id", user.id);
        queryClient.invalidateQueries({ queryKey: queryKeys.cart.user(user.id, tenantId) });
      } else {
        localStorage.removeItem(STORAGE_KEYS.GUEST_CART);
      }

      toast.success("Order placed successfully!", {
        description: `Order #${orderNum} has been placed.`,
      });
    } catch (error: unknown) {
      toast.error("Error placing order", {
        description: error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  };

  if (orderPlaced) {
    return (
      <div className="min-h-dvh bg-[hsl(var(--customer-bg))] flex items-center justify-center p-6">
        <SuccessState
          type="order_placed"
          details={orderNumber}
          primaryAction={{
            label: "View Order",
            onClick: () => navigate(`/${tenant?.slug}/shop/orders/${orderNumber}`),
          }}
          secondaryAction={{
            label: "Continue Shopping",
            onClick: () => navigate(`/${tenant?.slug}/shop/dashboard`),
          }}
        />
      </div>
    );
  }

  const steps: { id: CheckoutStep; label: string; icon: LucideIcon }[] = [
    { id: "delivery", label: "Delivery", icon: Truck },
    { id: "payment", label: "Payment", icon: CreditCard },
    { id: "review", label: "Review", icon: CheckCircle2 },
  ];

  const currentStepIndex = steps.findIndex(s => s.id === currentStep);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  const selectedAddress = savedAddresses.find(addr => addr.id === deliveryInfo.addressId);

  return (
    <div className="min-h-dvh bg-[hsl(var(--customer-bg))] pb-36 lg:pb-0">
      {/* Mobile Top Navigation */}
      <CustomerMobileNav />

      {/* Desktop Header */}
      <header className="hidden lg:block border-b border-[hsl(var(--customer-border))] bg-white sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate(`/${tenant?.slug}/shop/cart`)}
              className="text-[hsl(var(--customer-text))] hover:bg-[hsl(var(--customer-surface))]"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Cart
            </Button>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-[hsl(var(--customer-text))]">📝 Checkout</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto p-6">
        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-colors ${index <= currentStepIndex
                      ? "bg-[hsl(var(--customer-primary))] text-white"
                      : "bg-[hsl(var(--customer-surface))] text-[hsl(var(--customer-text-light))]"
                      }`}
                  >
                    <step.icon className="h-5 w-5" />
                  </div>
                  <span
                    className={`text-sm font-medium ${index <= currentStepIndex
                      ? "text-[hsl(var(--customer-primary))]"
                      : "text-[hsl(var(--customer-text-light))]"
                      }`}
                  >
                    {step.label}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-2 transition-colors ${index < currentStepIndex
                      ? "bg-[hsl(var(--customer-primary))]"
                      : "bg-[hsl(var(--customer-surface))]"
                      }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="w-full bg-[hsl(var(--customer-surface))] rounded-full h-2">
            <div
              className="bg-gradient-to-r from-[hsl(var(--customer-primary))] to-[hsl(var(--customer-secondary))] h-2 rounded-full transition-[width] duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT: Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {currentStep === "delivery" && (
              <Card className="bg-white border-[hsl(var(--customer-border))]">
                <CardHeader>
                  <CardTitle className="text-[hsl(var(--customer-text))] flex items-center gap-2">
                    <Truck className="h-5 w-5" />
                    Delivery Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Address Selection */}
                  {user && savedAddresses.length > 0 ? (
                    <div className="space-y-3">
                      <Label className="text-[hsl(var(--customer-text))]">Delivery Address</Label>
                      <RadioGroup
                        value={deliveryInfo.addressId}
                        onValueChange={(value) => setDeliveryInfo(prev => ({ ...prev, addressId: value }))}
                      >
                        {savedAddresses.map((address) => (
                          <div key={address.id} className="flex items-start space-x-3">
                            <RadioGroupItem value={address.id} id={address.id} className="mt-1" />
                            <label
                              htmlFor={address.id}
                              className="flex-1 cursor-pointer p-4 border rounded-lg hover:border-[hsl(var(--customer-primary))] transition-colors"
                            >
                              <div className="flex items-start justify-between">
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <MapPin className="h-4 w-4 text-[hsl(var(--customer-primary))]" />
                                    {address.is_default && (
                                      <Badge variant="outline" className="text-xs">
                                        Default
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="font-medium text-[hsl(var(--customer-text))]">
                                    {address.street}
                                    {address.apartment && `, ${address.apartment}`}
                                  </p>
                                  <p className="text-sm text-[hsl(var(--customer-text-light))]">
                                    {address.city}, {address.state} {address.zip_code}
                                  </p>
                                  {address.borough && (
                                    <p className="text-xs text-[hsl(var(--customer-text-light))] mt-1">
                                      {address.borough}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </label>
                          </div>
                        ))}
                      </RadioGroup>
                      <Dialog open={showAddAddressDialog} onOpenChange={setShowAddAddressDialog}>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full border-[hsl(var(--customer-border))]"
                          >
                            + Use Different Address
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                          <DialogHeader>
                            <DialogTitle>Add New Address</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div>
                              <Label htmlFor="new-street" className="text-[hsl(var(--customer-text))]">Street Address</Label>
                              <Input
                                id="new-street"
                                value={newAddress.street}
                                onChange={(e) => setNewAddress({ ...newAddress, street: e.target.value })}
                                placeholder="123 Main St"
                                className="border-[hsl(var(--customer-border))]"
                              />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <Label htmlFor="new-city" className="text-[hsl(var(--customer-text))]">City</Label>
                                <Input
                                  id="new-city"
                                  value={newAddress.city}
                                  onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                                  placeholder="New York"
                                  className="border-[hsl(var(--customer-border))]"
                                />
                              </div>
                              <div>
                                <Label htmlFor="new-state" className="text-[hsl(var(--customer-text))]">State</Label>
                                <Input
                                  id="new-state"
                                  value={newAddress.state}
                                  onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })}
                                  placeholder="NY"
                                  className="border-[hsl(var(--customer-border))]"
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <Label htmlFor="new-zip" className="text-[hsl(var(--customer-text))]">ZIP Code</Label>
                                <Input
                                  id="new-zip"
                                  value={newAddress.zip}
                                  onChange={(e) => setNewAddress({ ...newAddress, zip: e.target.value })}
                                  placeholder="10001"
                                  className="border-[hsl(var(--customer-border))]"
                                />
                              </div>
                              <div>
                                <Label htmlFor="new-borough" className="text-[hsl(var(--customer-text))]">Borough</Label>
                                <Input
                                  id="new-borough"
                                  value={newAddress.borough}
                                  onChange={(e) => setNewAddress({ ...newAddress, borough: e.target.value })}
                                  placeholder="Manhattan"
                                  className="border-[hsl(var(--customer-border))]"
                                />
                              </div>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button
                              variant="outline"
                              onClick={() => setShowAddAddressDialog(false)}
                              className="border-[hsl(var(--customer-border))]"
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={async () => {
                                if (isAddingAddress) return;

                                if (!newAddress.street || !newAddress.city || !newAddress.zip) {
                                  toast.error("Missing Information", {
                                    description: "Please fill in all required fields",
                                  });
                                  return;
                                }

                                setIsAddingAddress(true);
                                try {
                                  if (user) {
                                    // Save to database
                                    const { error } = await supabase
                                      .from("addresses")
                                      .insert({
                                        user_id: user.id,
                                        street: newAddress.street,
                                        city: newAddress.city,
                                        state: newAddress.state,
                                        zip_code: newAddress.zip,
                                        borough: newAddress.borough,
                                        is_default: savedAddresses.length === 0,
                                      });

                                    if (error) throw error;

                                    // Refresh addresses
                                    queryClient.invalidateQueries({ queryKey: queryKeys.customerAddresses.byUser(user.id) });
                                  }

                                  toast.success("Address Added", {
                                    description: "New address has been saved",
                                  });

                                  setNewAddress({ street: "", city: "", state: "NY", zip: "", borough: "" });
                                  setShowAddAddressDialog(false);
                                } catch (error: unknown) {
                                  toast.error("Error", {
                                    description: error instanceof Error ? error.message : "Failed to save address",
                                  });
                                } finally {
                                  setIsAddingAddress(false);
                                }
                              }}
                              disabled={isAddingAddress}
                              className="bg-[hsl(var(--customer-primary))] hover:bg-[hsl(var(--customer-primary))]/90 text-white"
                            >
                              {isAddingAddress ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Adding...
                                </>
                              ) : (
                                "Add Address"
                              )}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="street" className="text-[hsl(var(--customer-text))]">Street Address</Label>
                        <Input
                          id="street"
                          placeholder="123 Main St"
                          className="border-[hsl(var(--customer-border))] focus-visible:border-[hsl(var(--customer-primary))]"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="city" className="text-[hsl(var(--customer-text))]">City</Label>
                          <Input
                            id="city"
                            placeholder="Los Angeles"
                            className="border-[hsl(var(--customer-border))] focus-visible:border-[hsl(var(--customer-primary))]"
                          />
                        </div>
                        <div>
                          <Label htmlFor="state" className="text-[hsl(var(--customer-text))]">State</Label>
                          <Input
                            id="state"
                            placeholder="CA"
                            className="border-[hsl(var(--customer-border))] focus-visible:border-[hsl(var(--customer-primary))]"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="zip" className="text-[hsl(var(--customer-text))]">Zip Code</Label>
                        <Input
                          id="zip"
                          placeholder="90001"
                          className="border-[hsl(var(--customer-border))] focus-visible:border-[hsl(var(--customer-primary))]"
                        />
                      </div>
                    </div>
                  )}

                  {/* Preferred Delivery Date */}
                  <div>
                    <Label htmlFor="deliveryDate" className="text-[hsl(var(--customer-text))] flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Preferred Delivery Date
                    </Label>
                    <Input
                      id="deliveryDate"
                      type="date"
                      value={deliveryInfo.preferredDate}
                      onChange={(e) => setDeliveryInfo(prev => ({ ...prev, preferredDate: e.target.value }))}
                      min={new Date().toISOString().split('T')[0]}
                      className="border-[hsl(var(--customer-border))] focus-visible:border-[hsl(var(--customer-primary))]"
                    />
                  </div>

                  {/* Delivery Instructions */}
                  <div>
                    <Label htmlFor="instructions" className="text-[hsl(var(--customer-text))] flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Delivery Instructions
                    </Label>
                    <Textarea
                      id="instructions"
                      placeholder="Back entrance, ring bell twice..."
                      value={deliveryInfo.instructions}
                      onChange={(e) => setDeliveryInfo(prev => ({ ...prev, instructions: e.target.value }))}
                      className="border-[hsl(var(--customer-border))] focus-visible:border-[hsl(var(--customer-primary))]"
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {currentStep === "payment" && (
              <Card className="bg-white border-[hsl(var(--customer-border))]">
                <CardHeader>
                  <CardTitle className="text-[hsl(var(--customer-text))] flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Payment Method
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <RadioGroup
                    value={paymentMethod}
                    onValueChange={(value) => setPaymentMethod(value as "card" | "terms" | "cod")}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start space-x-3">
                        <RadioGroupItem value="card" id="card" className="mt-1" />
                        <label
                          htmlFor="card"
                          className="flex-1 cursor-pointer p-4 border rounded-lg hover:border-[hsl(var(--customer-primary))] transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-[hsl(var(--customer-text))]">Credit Card</p>
                              <p className="text-sm text-[hsl(var(--customer-text-light))]">
                                Visa ••4242
                              </p>
                            </div>
                            <CreditCard className="h-6 w-6 text-[hsl(var(--customer-text-light))]" />
                          </div>
                        </label>
                      </div>
                      <div className="flex items-start space-x-3">
                        <RadioGroupItem value="terms" id="terms" className="mt-1" />
                        <label
                          htmlFor="terms"
                          className="flex-1 cursor-pointer p-4 border rounded-lg hover:border-[hsl(var(--customer-primary))] transition-colors"
                        >
                          <div>
                            <p className="font-medium text-[hsl(var(--customer-text))]">Terms (Net 30)</p>
                            <p className="text-sm text-[hsl(var(--customer-text-light))]">
                              Pay within 30 days of delivery
                            </p>
                          </div>
                        </label>
                      </div>
                      <div className="flex items-start space-x-3">
                        <RadioGroupItem value="cod" id="cod" className="mt-1" />
                        <label
                          htmlFor="cod"
                          className="flex-1 cursor-pointer p-4 border rounded-lg hover:border-[hsl(var(--customer-primary))] transition-colors"
                        >
                          <div>
                            <p className="font-medium text-[hsl(var(--customer-text))]">Cash on Delivery</p>
                            <p className="text-sm text-[hsl(var(--customer-text-light))]">
                              Pay when order is delivered
                            </p>
                          </div>
                        </label>
                      </div>
                    </div>
                  </RadioGroup>
                </CardContent>
              </Card>
            )}

            {currentStep === "review" && (
              <Card className="bg-white border-[hsl(var(--customer-border))]">
                <CardHeader>
                  <CardTitle className="text-[hsl(var(--customer-text))] flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5" />
                    Review Your Order
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Order Summary */}
                  <div>
                    <h3 className="font-semibold text-[hsl(var(--customer-text))] mb-3">Order Items</h3>
                    <div className="space-y-3">
                      {(cartItems as RenderCartItem[]).map((item: RenderCartItem) => {
                        const product = item.products;
                        const price = getItemPrice(item);
                        return (
                          <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-3">
                              {product?.image_url ? (
                                <img
                                  src={product.image_url}
                                  alt={product.name}
                                  className="w-12 h-12 rounded object-cover"
                                  loading="lazy"
                                />
                              ) : null}
                              <div>
                                <p className="font-medium text-[hsl(var(--customer-text))]">{product?.name}</p>
                                <p className="text-sm text-[hsl(var(--customer-text-light))]">
                                  {item.quantity} × {formatCurrency(price)}
                                </p>
                              </div>
                            </div>
                            <p className="font-semibold text-[hsl(var(--customer-text))]">
                              {formatCurrency(price * item.quantity)}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Delivery Info Summary */}
                  {selectedAddress && (
                    <div>
                      <h3 className="font-semibold text-[hsl(var(--customer-text))] mb-2">Delivery Address</h3>
                      <div className="p-3 border rounded-lg bg-[hsl(var(--customer-surface))]">
                        <p className="text-[hsl(var(--customer-text))]">
                          {selectedAddress.street}
                          {selectedAddress.apartment && `, ${selectedAddress.apartment}`}
                        </p>
                        <p className="text-sm text-[hsl(var(--customer-text-light))]">
                          {selectedAddress.city}, {selectedAddress.state} {selectedAddress.zip_code}
                        </p>
                        {deliveryInfo.preferredDate && (
                          <p className="text-sm text-[hsl(var(--customer-text-light))] mt-2">
                            Preferred date: {formatSmartDate(deliveryInfo.preferredDate)}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Order Notes */}
                  {orderNotes && (
                    <div>
                      <h3 className="font-semibold text-[hsl(var(--customer-text))] mb-2">Order Notes</h3>
                      <div className="p-3 border rounded-lg bg-[hsl(var(--customer-surface))]">
                        <p className="text-sm text-[hsl(var(--customer-text))]">{orderNotes}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Navigation Buttons */}
            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  if (currentStep === "delivery") {
                    navigate(`/${tenant?.slug}/shop/cart`);
                  } else {
                    const stepOrder: CheckoutStep[] = ["delivery", "payment", "review"];
                    const currentIndex = stepOrder.indexOf(currentStep);
                    setCurrentStep(stepOrder[currentIndex - 1]);
                  }
                }}
                className="border-[hsl(var(--customer-border))] w-full sm:w-auto"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                {currentStep === "delivery" ? "Back to Cart" : "Previous"}
              </Button>
              <Button
                onClick={() => {
                  if (currentStep === "review") {
                    handlePlaceOrder();
                  } else {
                    const stepOrder: CheckoutStep[] = ["delivery", "payment", "review"];
                    const currentIndex = stepOrder.indexOf(currentStep);
                    setCurrentStep(stepOrder[currentIndex + 1]);
                  }
                }}
                className="bg-gradient-to-r from-[hsl(var(--customer-primary))] to-[hsl(var(--customer-secondary))] hover:opacity-90 text-white w-full sm:w-auto"
                disabled={!deliveryInfo.addressId && user && savedAddresses.length > 0}
              >
                {currentStep === "review" ? "Place Order" : "Continue"}
                <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
              </Button>
            </div>
          </div>

          {/* RIGHT: Order Summary */}
          <div className="lg:col-span-1">
            <Card className="bg-white border-[hsl(var(--customer-border))] sticky top-24">
              <CardHeader>
                <CardTitle className="text-[hsl(var(--customer-text))]">ORDER SUMMARY</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between text-[hsl(var(--customer-text))]">
                    <span>{cartItems.length} Items</span>
                    <span className="font-medium">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-[hsl(var(--customer-text))]">
                    <span>Subtotal:</span>
                    <span className="font-medium">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-[hsl(var(--customer-text))]">
                    <span>Tax (8.5%):</span>
                    <span className="font-medium">{formatCurrency(tax)}</span>
                  </div>
                  <div className="flex justify-between text-[hsl(var(--customer-text))]">
                    <span>Delivery:</span>
                    <span className="font-medium text-[hsl(var(--customer-secondary))]">
                      {deliveryFee === 0 ? "FREE" : formatCurrency(deliveryFee)}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-lg font-bold text-[hsl(var(--customer-text))]">
                    <span>TOTAL:</span>
                    <span className="text-[hsl(var(--customer-primary))]">
                      {formatCurrency(total)}
                    </span>
                  </div>
                </div>

                <div className="pt-4 border-t border-[hsl(var(--customer-border))]">
                  <p className="text-xs text-[hsl(var(--customer-text-light))] text-center mb-2">
                    We Accept:
                  </p>
                  <div className="flex justify-center gap-2 text-2xl">
                    <CreditCard className="h-6 w-6" />
                    <span>💰</span>
                    <span>📱</span>
                  </div>
                  <p className="text-xs text-[hsl(var(--customer-text-light))] text-center mt-2">
                    🔒 Secure Checkout
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Sticky Mobile Checkout Bar */}
      {cartItems.length > 0 && (
        <div className="fixed bottom-16 left-0 right-0 lg:hidden z-40">
          <div className="bg-white border-t border-[hsl(var(--customer-border))] shadow-lg p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs text-[hsl(var(--customer-text-light))]">Order Total</p>
                <p className="text-lg font-bold text-[hsl(var(--customer-primary))]">
                  {formatCurrency(total)}
                </p>
              </div>
              <Button
                onClick={() => {
                  if (currentStep === "review") {
                    handlePlaceOrder();
                  } else {
                    const stepOrder: CheckoutStep[] = ["delivery", "payment", "review"];
                    const currentIndex = stepOrder.indexOf(currentStep);
                    setCurrentStep(stepOrder[currentIndex + 1]);
                  }
                }}
                className="bg-gradient-to-r from-[hsl(var(--customer-primary))] to-[hsl(var(--customer-secondary))] hover:opacity-90 text-white flex-shrink-0"
                disabled={!deliveryInfo.addressId && user && savedAddresses.length > 0}
                size="lg"
              >
                {currentStep === "review" ? "Place Order" : "Continue"}
                <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation */}
      <CustomerMobileBottomNav />
    </div>
  );
}

