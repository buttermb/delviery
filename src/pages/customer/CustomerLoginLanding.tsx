/**
 * Customer Login Landing Page
 * Allows customers to search and select their business to log in
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { escapePostgresLike } from "@/lib/utils/searchSanitize";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Store, ArrowRight, HelpCircle } from "lucide-react";
import { LoadingFallback } from "@/components/LoadingFallback";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function CustomerLoginLanding() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");

  // Query tenants table for business search
  const { data: businesses, isLoading } = useQuery({
    queryKey: queryKeys.tenantSearchPage.byTerm(searchTerm),
    queryFn: async () => {
      let query = supabase
        .from("tenants")
        .select("id, slug, business_name, owner_name")
        .eq("subscription_status", "active")
        .order("business_name");

      if (searchTerm.trim()) {
        query = query.or(`business_name.ilike.%${escapePostgresLike(searchTerm)}%,slug.ilike.%${escapePostgresLike(searchTerm)}%`);
      }

      const { data, error } = await query.limit(20);

      if (error) throw error;
      return data ?? [];
    },
    enabled: true,
  });

  const handleBusinessSelect = (slug: string) => {
    navigate(`/${slug}/customer/login`);
  };

  return (
    <div className="min-h-dvh bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Store className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Customer Portal</h1>
          <p className="text-muted-foreground">
            Search for your business to access your customer account
          </p>
        </div>

        {/* Search Card */}
        <Card>
          <CardHeader>
            <CardTitle>Find Your Business</CardTitle>
            <CardDescription>
              Enter your business name or store ID to log in
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search business name or store ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
                aria-label="Search business name or store ID"
              />
            </div>

            {/* Results */}
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <LoadingFallback />
                </div>
              ) : businesses && businesses.length > 0 ? (
                businesses.map((business) => (
                  <Button
                    key={business.id}
                    variant="outline"
                    className="w-full justify-between h-auto py-3 px-4 hover:bg-accent"
                    onClick={() => handleBusinessSelect(business.slug)}
                  >
                    <div className="flex items-center gap-3 text-left">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                        <Store className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <div className="font-semibold">{business.business_name}</div>
                        <div className="text-xs text-muted-foreground">@{business.slug}</div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  </Button>
                ))
              ) : searchTerm ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Store className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No businesses found matching "{searchTerm}"</p>
                  <p className="text-sm mt-1">Try a different search term</p>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Start typing to search for businesses</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Help Section */}
        <Alert>
          <HelpCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Don't know your business name?</strong>
            <br />
            Contact your business owner or check your welcome email for your store ID.
            The store ID is usually in the format: businessname.com/<strong>store-id</strong>
          </AlertDescription>
        </Alert>

        {/* Back to Home */}
        <div className="text-center">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="text-muted-foreground"
          >
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
}
