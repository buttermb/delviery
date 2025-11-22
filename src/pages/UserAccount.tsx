import { logger } from '@/lib/logger';
// @ts-nocheck
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { 
  Shield, TrendingUp, CheckCircle, AlertTriangle, FileText, 
  Gift, Settings, User, Package, Heart, Tag, HeadphonesIcon, 
  Share2, MapPin, CreditCard, Star, ShoppingBag, Award,
  Calendar, DollarSign
} from "lucide-react";
import CopyButton from "@/components/CopyButton";
import { BetterEmptyState } from "@/components/BetterEmptyState";
import PurchaseGiveawayEntries from "@/components/account/PurchaseGiveawayEntries";
import LoyaltyPoints from "@/components/LoyaltyPoints";
import IDVerificationUpload from "@/components/IDVerificationUpload";
import CustomerLayout from "@/layouts/CustomerLayout";
import { Link } from "react-router-dom";
import { Home } from "lucide-react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import UserActivityFeed from "@/components/account/UserActivityFeed";
import AddressBook from "@/components/account/AddressBook";
import PaymentMethods from "@/components/account/PaymentMethods";
import NotificationPreferences from "@/components/account/NotificationPreferences";
import { logger } from "@/utils/logger";

export default function UserAccount() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserData();
    
    // Set up realtime subscription to keep data updated
    const channel = supabase
      .channel('user-account-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
        },
        () => {
          logger.debug('Profile updated, refreshing', { component: 'UserAccount' });
          fetchUserData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        () => {
          logger.debug('Order updated, refreshing orders', { component: 'UserAccount' });
          fetchUserData();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.debug('Successfully subscribed to user account updates', { component: 'UserAccount' });
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logger.error('Failed to subscribe to user account updates', { status, component: 'UserAccount' });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/");
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (profileError) throw profileError;
      if (!profileData) {
        toast.error("Profile not found. Please contact support.");
        navigate("/");
        return;
      }

      const { data: ordersData } = await supabase
        .from("orders")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      setProfile(profileData);
      setOrders(ordersData || []);
    } catch (error: any) {
      logger.error("Error fetching user data", error, { component: 'UserAccount' });
      toast.error("Failed to load account data");
    } finally {
      setLoading(false);
    }
  };

  const getTrustLevelColor = (level: string) => {
    switch (level) {
      case "vip": return "bg-green-500";
      case "regular": return "bg-blue-500";
      case "new": return "bg-yellow-500";
      default: return "bg-red-500";
    }
  };

  const getRiskScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-blue-600";
    if (score >= 40) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <CustomerLayout>
      <div className="container mx-auto p-6 max-w-7xl pb-20 md:pb-6">
        {/* Back to Home Button */}
        <div className="mb-6">
          <Link 
            to="/"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
          >
            <Home className="w-4 h-4" />
            <span>Back to Home</span>
          </Link>
        </div>

        {/* Breadcrumbs */}
        <div className="mb-6">
          <Breadcrumbs />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">My Account</h1>
            <p className="text-muted-foreground mt-1">Manage your profile, orders, and preferences</p>
          </div>
          <Button onClick={() => navigate("/account/settings")}>
            <Settings className="w-4 h-4 mr-2" />
            Edit Profile
          </Button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="space-y-6">
            <Skeleton className="h-12 w-full" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-48" />
                ))}
              </div>
              <div className="space-y-4">
                {[...Array(2)].map((_, i) => (
                  <Skeleton key={i} className="h-48" />
                ))}
              </div>
            </div>
          </div>
        )}

        {!loading && !profile && (
          <BetterEmptyState
            icon={User}
            title="Profile not found"
            description="We couldn't load your account information. Please try refreshing the page."
            action={{ label: "Refresh Page", onClick: () => window.location.reload() }}
          />
        )}

        {!loading && profile && (
          <>
            {/* Account Status Alert */}
            {profile.account_status !== "active" && (
              <Alert variant="destructive" className="mb-6">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Your account status is: {profile.account_status.toUpperCase()}
                  {profile.account_status === "suspended" && " - Please contact support."}
                </AlertDescription>
              </Alert>
            )}

            {/* Main Content with Tabs */}
            <Tabs defaultValue="overview" className="space-y-6">
              <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 lg:w-auto">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="orders">Orders</TabsTrigger>
                <TabsTrigger value="rewards">Rewards</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 space-y-6">
                    {/* Trust Score Card */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Shield className="w-5 h-5" />
                          Your Trust Score
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-4xl font-bold">
                                <span className={getRiskScoreColor(profile.risk_score || 50)}>
                                  {profile.risk_score || 50}
                                </span>
                                <span className="text-lg text-muted-foreground">/100</span>
                              </p>
                              <p className="text-sm text-muted-foreground mt-1">
                                Trust Level: <Badge className={getTrustLevelColor(profile.trust_level)}>
                                  {profile.trust_level?.toUpperCase() || "NEW"}
                                </Badge>
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-muted-foreground">Account Status</p>
                              <Badge variant={profile.account_status === "active" ? "default" : "destructive"}>
                                {profile.account_status?.toUpperCase() || "ACTIVE"}
                              </Badge>
                            </div>
                          </div>

                          <Progress value={profile.risk_score || 50} className="h-3" />

                          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                            <div>
                              <p className="text-sm text-muted-foreground">Build Trust By:</p>
                              <ul className="text-sm mt-2 space-y-1">
                                <li className="flex items-center gap-2">
                                  {profile.id_verified ? (
                                    <CheckCircle className="w-4 h-4 text-green-600" />
                                  ) : (
                                    <span className="w-4 h-4 border-2 rounded-full" />
                                  )}
                                  Verify ID
                                </li>
                                <li className="flex items-center gap-2">
                                  {profile.total_orders > 0 ? (
                                    <CheckCircle className="w-4 h-4 text-green-600" />
                                  ) : (
                                    <span className="w-4 h-4 border-2 rounded-full" />
                                  )}
                                  Complete orders
                                </li>
                                <li className="flex items-center gap-2">
                                  {profile.total_orders >= 5 ? (
                                    <CheckCircle className="w-4 h-4 text-green-600" />
                                  ) : (
                                    <span className="w-4 h-4 border-2 rounded-full" />
                                  )}
                                  Reach 5+ orders
                                </li>
                              </ul>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Benefits:</p>
                              <ul className="text-sm mt-2 space-y-1">
                                <li>• Higher spending limits</li>
                                <li>• Priority delivery</li>
                                <li>• Exclusive deals</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Spending Overview */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <TrendingUp className="w-5 h-5" />
                          Spending Overview
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Total Spent</p>
                            <p className="text-2xl font-bold">${profile.total_spent?.toFixed(2) || "0.00"}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Total Orders</p>
                            <p className="text-2xl font-bold">{profile.total_orders || 0}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Avg Order</p>
                            <p className="text-2xl font-bold">${profile.average_order_value?.toFixed(2) || "0.00"}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Lifetime Value</p>
                            <p className="text-2xl font-bold">${profile.lifetime_value?.toFixed(2) || "0.00"}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Quick Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card>
                        <CardContent className="p-6">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                              <ShoppingBag className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">This Month</p>
                              <p className="text-2xl font-bold">{orders.filter(o => new Date(o.created_at).getMonth() === new Date().getMonth()).length || 0}</p>
                              <p className="text-xs text-muted-foreground">orders</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-6">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                              <DollarSign className="w-6 h-6 text-emerald-500" />
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Saved</p>
                              <p className="text-2xl font-bold">${profile.total_discounts?.toFixed(2) || "0.00"}</p>
                              <p className="text-xs text-muted-foreground">in discounts</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-6">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                              <Award className="w-6 h-6 text-blue-500" />
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Loyalty</p>
                              <p className="text-2xl font-bold">{profile.total_orders * 10 || 0}</p>
                              <p className="text-xs text-muted-foreground">points</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>

                  {/* Sidebar */}
                  <div className="space-y-6">
                    {/* Account Info */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Account Info</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">User ID</span>
                          <span className="font-mono text-xs flex items-center gap-2">
                            {profile.user_id_code || "Pending"}
                            {profile.user_id_code && (
                              <CopyButton text={profile.user_id_code} label="User ID" size="icon" showLabel={false} />
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Member Since</span>
                          <span>{new Date(profile.created_at).toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">ID Verified</span>
                          <span>{profile.id_verified ? "✓ Yes" : "✗ No"}</span>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Spending Limits */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Spending Limits</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Daily Limit</span>
                            <span className="font-semibold">${profile.daily_limit?.toFixed(0) || 500}</span>
                          </div>
                          <Progress value={50} className="h-2" />
                        </div>
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Weekly Limit</span>
                            <span className="font-semibold">${profile.weekly_limit?.toFixed(0) || 2000}</span>
                          </div>
                          <Progress value={30} className="h-2" />
                        </div>
                        <div className="pt-2 border-t">
                          <p className="text-sm text-muted-foreground">
                            Orders per day: <span className="font-semibold">{profile.order_limit || 3}</span>
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Quick Actions */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Quick Actions</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <Button variant="outline" className="w-full justify-start" onClick={() => navigate("/my-orders")}>
                          <Package className="w-4 h-4 mr-2" />
                          View All Orders
                        </Button>
                        <Button variant="outline" className="w-full justify-start" onClick={() => navigate("/account/settings")}>
                          <Settings className="w-4 h-4 mr-2" />
                          Account Settings
                        </Button>
                        <Button variant="outline" className="w-full justify-start" onClick={() => navigate("/track-order")}>
                          <FileText className="w-4 h-4 mr-2" />
                          Track Order
                        </Button>
                        <Button variant="outline" className="w-full justify-start" onClick={() => navigate("/support")}>
                          <HeadphonesIcon className="w-4 h-4 mr-2" />
                          Contact Support
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>

              {/* Orders Tab */}
              <TabsContent value="orders" className="space-y-6">
                <Card>
                  <CardHeader className="flex items-center justify-between">
                    <CardTitle>Order History</CardTitle>
                    <Button variant="outline" onClick={() => navigate("/my-orders")}>
                      View All Orders
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {orders.length === 0 ? (
                      <BetterEmptyState
                        icon={Package}
                        title="No orders yet"
                        description="Your recent orders will appear here once you place one."
                        action={{ label: "Browse Products", onClick: () => navigate("/") }}
                      />
                    ) : (
                      <div className="space-y-4">
                        {orders.map((order) => (
                          <div key={order.id} className="flex justify-between items-center p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <p className="font-semibold">{order.order_number}</p>
                                {order.order_number && (
                                  <CopyButton text={order.order_number} label="Order #" size="icon" showLabel={false} />
                                )}
                              </div>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {new Date(order.created_at).toLocaleDateString()}
                                </span>
                                <span>${order.total_amount?.toFixed(2)}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <Badge variant={order.status === "delivered" ? "default" : "outline"}>
                                {order.status}
                              </Badge>
                              <Button variant="ghost" size="sm" onClick={() => navigate(`/track/${order.tracking_code || order.order_number}`)}>
                                Track
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Rewards Tab */}
              <TabsContent value="rewards" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Loyalty Points */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Gift className="w-5 h-5" />
                        Loyalty & Rewards
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <LoyaltyPoints />
                    </CardContent>
                  </Card>

                  {/* Giveaway Entries */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Star className="w-5 h-5" />
                        Giveaway Entries
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <PurchaseGiveawayEntries />
                    </CardContent>
                  </Card>
                </div>

                {/* ID Verification */}
                {!profile.id_verified && (
                  <Card>
                    <CardContent className="p-6">
                      <IDVerificationUpload />
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Settings Tab */}
              <TabsContent value="settings" className="space-y-6">
                <div className="grid grid-cols-1 gap-6">
                  {/* Address Book */}
                  <AddressBook />
                  
                  {/* Payment Methods */}
                  <PaymentMethods />
                  
                  {/* Notification Preferences */}
                  <NotificationPreferences />
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Settings className="w-5 h-5" />
                          Account Settings
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <Button variant="outline" className="w-full justify-start" onClick={() => navigate("/account/settings")}>
                          <User className="w-4 h-4 mr-2" />
                          Edit Profile
                        </Button>
                        <Button variant="outline" className="w-full justify-start" disabled>
                          <Shield className="w-4 h-4 mr-2" />
                          Security Settings
                        </Button>
                      </CardContent>
                    </Card>
                    
                    {/* Activity Feed */}
                    {profile && <UserActivityFeed userId={profile.user_id} />}
                  </div>

                  {/* Referral Card */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Share2 className="w-5 h-5" />
                        Refer Friends
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <p className="text-sm text-muted-foreground mb-2">Your Referral Code</p>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 p-3 bg-muted rounded-lg font-mono text-sm">
                              {profile.referral_code || "Loading..."}
                            </code>
                            <CopyButton text={profile.referral_code || ""} label="Referral Code" />
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Share your code with friends and earn rewards when they sign up!
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </CustomerLayout>
  );
}
