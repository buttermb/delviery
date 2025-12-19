import { SEOHead } from "@/components/SEOHead";
import { DocsLayout } from "@/components/docs/DocsLayout";
import { ApiEndpointCard, ApiEndpoint } from "@/components/docs/ApiEndpointCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useState } from "react";

const endpoints: ApiEndpoint[] = [
  {
    method: "POST",
    path: "/admin-api-operations",
    title: "List Resources",
    description: "Retrieve a list of resources (products, customers, orders, etc.) for your tenant.",
    auth: true,
    parameters: [
      { name: "action", type: "string", required: true, description: "Must be 'list'" },
      { name: "resource", type: "string", required: true, description: "Resource type (e.g., 'products', 'customers', 'orders')" },
    ],
    requestBody: `{
  "action": "list",
  "resource": "products"
}`,
    responseExample: `{
  "data": [
    {
      "id": "uuid",
      "name": "Product Name",
      "price": 29.99,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}`,
    curlExample: `curl -X POST https://aejugtmhwwknrowfyzie.supabase.co/functions/v1/admin-api-operations \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -d '{"action": "list", "resource": "products"}'`,
  },
  {
    method: "POST",
    path: "/admin-api-operations",
    title: "Create Resource",
    description: "Create a new resource in your tenant's database.",
    auth: true,
    parameters: [
      { name: "action", type: "string", required: true, description: "Must be 'create'" },
      { name: "resource", type: "string", required: true, description: "Resource type to create" },
      { name: "data", type: "object", required: true, description: "Resource data" },
    ],
    requestBody: `{
  "action": "create",
  "resource": "products",
  "data": {
    "name": "New Product",
    "price": 49.99,
    "description": "Product description"
  }
}`,
    responseExample: `{
  "data": {
    "id": "uuid",
    "name": "New Product",
    "price": 49.99,
    "created_at": "2024-01-01T00:00:00Z"
  }
}`,
    curlExample: `curl -X POST https://aejugtmhwwknrowfyzie.supabase.co/functions/v1/admin-api-operations \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -d '{"action": "create", "resource": "products", "data": {"name": "New Product", "price": 49.99}}'`,
  },
  {
    method: "POST",
    path: "/admin-api-operations",
    title: "Update Resource",
    description: "Update an existing resource by ID.",
    auth: true,
    parameters: [
      { name: "action", type: "string", required: true, description: "Must be 'update'" },
      { name: "resource", type: "string", required: true, description: "Resource type" },
      { name: "id", type: "string", required: true, description: "Resource ID to update" },
      { name: "data", type: "object", required: true, description: "Updated resource data" },
    ],
    requestBody: `{
  "action": "update",
  "resource": "products",
  "id": "uuid",
  "data": {
    "price": 39.99
  }
}`,
    responseExample: `{
  "data": {
    "id": "uuid",
    "name": "Product Name",
    "price": 39.99,
    "updated_at": "2024-01-01T00:00:00Z"
  }
}`,
    curlExample: `curl -X POST https://aejugtmhwwknrowfyzie.supabase.co/functions/v1/admin-api-operations \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -d '{"action": "update", "resource": "products", "id": "uuid", "data": {"price": 39.99}}'`,
  },
  {
    method: "POST",
    path: "/admin-api-operations",
    title: "Delete Resource",
    description: "Delete a resource by ID.",
    auth: true,
    parameters: [
      { name: "action", type: "string", required: true, description: "Must be 'delete'" },
      { name: "resource", type: "string", required: true, description: "Resource type" },
      { name: "id", type: "string", required: true, description: "Resource ID to delete" },
    ],
    requestBody: `{
  "action": "delete",
  "resource": "products",
  "id": "uuid"
}`,
    responseExample: `{
  "data": {
    "success": true
  }
}`,
    curlExample: `curl -X POST https://aejugtmhwwknrowfyzie.supabase.co/functions/v1/admin-api-operations \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -d '{"action": "delete", "resource": "products", "id": "uuid"}'`,
  },
  {
    method: "POST",
    path: "/admin-auth",
    title: "Admin Login",
    description: "Authenticate as a tenant admin to receive an access token.",
    auth: false,
    parameters: [
      { name: "action", type: "string", required: true, description: "Must be 'login'" },
      { name: "email", type: "string", required: true, description: "Admin email address" },
      { name: "password", type: "string", required: true, description: "Admin password" },
    ],
    requestBody: `{
  "action": "login",
  "email": "admin@example.com",
  "password": "secure_password"
}`,
    responseExample: `{
  "session": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_at": "2024-01-01T08:00:00Z"
  },
  "admin": {
    "id": "uuid",
    "email": "admin@example.com",
    "full_name": "Admin User",
    "role": "admin"
  }
}`,
    curlExample: `curl -X POST https://aejugtmhwwknrowfyzie.supabase.co/functions/v1/admin-auth \\
  -H "Content-Type: application/json" \\
  -d '{"action": "login", "email": "admin@example.com", "password": "secure_password"}'`,
  },
  {
    method: "POST",
    path: "/customer-auth",
    title: "Customer Authentication",
    description: "Authenticate customers for the customer portal.",
    auth: false,
    parameters: [
      { name: "action", type: "string", required: true, description: "Action type ('login', 'signup', 'verify')" },
      { name: "email", type: "string", required: true, description: "Customer email" },
      { name: "password", type: "string", required: false, description: "Customer password (required for login/signup)" },
    ],
    requestBody: `{
  "action": "login",
  "email": "customer@example.com",
  "password": "customer_password"
}`,
    responseExample: `{
  "session": {
    "access_token": "token...",
    "expires_at": "2024-01-01T08:00:00Z"
  },
  "customer": {
    "id": "uuid",
    "email": "customer@example.com"
  }
}`,
    curlExample: `curl -X POST https://aejugtmhwwknrowfyzie.supabase.co/functions/v1/customer-auth \\
  -H "Content-Type: application/json" \\
  -d '{"action": "login", "email": "customer@example.com", "password": "password"}'`,
  },
  {
    method: "POST",
    path: "/create-order",
    title: "Create Order",
    description: "Create a new order for a customer.",
    auth: true,
    parameters: [
      { name: "customer_id", type: "string", required: true, description: "Customer UUID" },
      { name: "items", type: "array", required: true, description: "Array of order items" },
      { name: "total", type: "number", required: true, description: "Order total amount" },
    ],
    requestBody: `{
  "customer_id": "uuid",
  "items": [
    {
      "product_id": "uuid",
      "quantity": 2,
      "price": 29.99
    }
  ],
  "total": 59.98
}`,
    responseExample: `{
  "data": {
    "id": "uuid",
    "customer_id": "uuid",
    "total": 59.98,
    "status": "pending",
    "created_at": "2024-01-01T00:00:00Z"
  }
}`,
    curlExample: `curl -X POST https://aejugtmhwwknrowfyzie.supabase.co/functions/v1/create-order \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -d '{"customer_id": "uuid", "items": [...], "total": 59.98}'`,
  },
  {
    method: "POST",
    path: "/generate-product-images",
    title: "Generate Product Images",
    description: "Use AI to generate product images from text descriptions.",
    auth: true,
    parameters: [
      { name: "product_name", type: "string", required: true, description: "Product name" },
      { name: "description", type: "string", required: true, description: "Product description for AI" },
      { name: "style", type: "string", required: false, description: "Image style preference" },
    ],
    requestBody: `{
  "product_name": "Premium Coffee Beans",
  "description": "High-quality arabica coffee beans in a premium package",
  "style": "product_photography"
}`,
    responseExample: `{
  "data": {
    "image_url": "https://storage.../image.png",
    "product_id": "uuid"
  }
}`,
    curlExample: `curl -X POST https://aejugtmhwwknrowfyzie.supabase.co/functions/v1/generate-product-images \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -d '{"product_name": "Premium Coffee", "description": "..."}'`,
  },
  {
    method: "POST",
    path: "/send-sms",
    title: "Send SMS",
    description: "Send SMS notifications to customers via Twilio integration.",
    auth: true,
    parameters: [
      { name: "to", type: "string", required: true, description: "Recipient phone number" },
      { name: "message", type: "string", required: true, description: "SMS message content" },
    ],
    requestBody: `{
  "to": "+1234567890",
  "message": "Your order has been shipped!"
}`,
    responseExample: `{
  "data": {
    "sid": "SM...",
    "status": "sent"
  }
}`,
    curlExample: `curl -X POST https://aejugtmhwwknrowfyzie.supabase.co/functions/v1/send-sms \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -d '{"to": "+1234567890", "message": "Your order shipped!"}'`,
  },
  {
    method: "POST",
    path: "/detect-fraud",
    title: "Fraud Detection",
    description: "Analyze orders for potential fraud using AI-powered risk assessment.",
    auth: true,
    parameters: [
      { name: "order_id", type: "string", required: true, description: "Order UUID to analyze" },
      { name: "customer_id", type: "string", required: true, description: "Customer UUID" },
    ],
    requestBody: `{
  "order_id": "uuid",
  "customer_id": "uuid"
}`,
    responseExample: `{
  "data": {
    "risk_score": 0.15,
    "risk_level": "low",
    "flags": [],
    "recommendation": "approve"
  }
}`,
    curlExample: `curl -X POST https://aejugtmhwwknrowfyzie.supabase.co/functions/v1/detect-fraud \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -d '{"order_id": "uuid", "customer_id": "uuid"}'`,
  },
];

export default function ApiReferencePage() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredEndpoints = endpoints.filter(
    (endpoint) =>
      endpoint.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      endpoint.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      endpoint.path.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <SEOHead 
        title="API Reference - DevPanel Documentation"
        description="Complete API reference for DevPanel. Explore all endpoints, parameters, and code examples."
      />
      
      <DocsLayout>
        <div className="space-y-8">
          <div>
            <h1 className="text-4xl font-bold mb-4 text-foreground">API Reference</h1>
            <p className="text-lg text-muted-foreground">
              Complete reference for all DevPanel API endpoints. Includes request parameters, response formats, and code examples.
            </p>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search endpoints..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <Tabs defaultValue="all" className="space-y-6">
            <TabsList>
              <TabsTrigger value="all">All Endpoints</TabsTrigger>
              <TabsTrigger value="admin">Admin Operations</TabsTrigger>
              <TabsTrigger value="auth">Authentication</TabsTrigger>
              <TabsTrigger value="orders">Orders</TabsTrigger>
              <TabsTrigger value="ai">AI Features</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-6">
              {filteredEndpoints.map((endpoint, index) => (
                <ApiEndpointCard key={index} endpoint={endpoint} />
              ))}
            </TabsContent>

            <TabsContent value="admin" className="space-y-6">
              {filteredEndpoints
                .filter((e) => e.path.includes("admin-api-operations"))
                .map((endpoint, index) => (
                  <ApiEndpointCard key={index} endpoint={endpoint} />
                ))}
            </TabsContent>

            <TabsContent value="auth" className="space-y-6">
              {filteredEndpoints
                .filter((e) => e.path.includes("auth"))
                .map((endpoint, index) => (
                  <ApiEndpointCard key={index} endpoint={endpoint} />
                ))}
            </TabsContent>

            <TabsContent value="orders" className="space-y-6">
              {filteredEndpoints
                .filter((e) => e.path.includes("order"))
                .map((endpoint, index) => (
                  <ApiEndpointCard key={index} endpoint={endpoint} />
                ))}
            </TabsContent>

            <TabsContent value="ai" className="space-y-6">
              {filteredEndpoints
                .filter((e) => e.path.includes("generate") || e.path.includes("detect"))
                .map((endpoint, index) => (
                  <ApiEndpointCard key={index} endpoint={endpoint} />
                ))}
            </TabsContent>
          </Tabs>
        </div>
      </DocsLayout>
    </>
  );
}
