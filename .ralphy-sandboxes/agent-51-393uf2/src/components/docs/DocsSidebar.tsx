import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Book, Code2, Shield, Zap, BookOpen, AlertCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const navItems = [
  {
    title: "Getting Started",
    icon: Zap,
    href: "/docs/getting-started",
  },
  {
    title: "Authentication",
    icon: Shield,
    href: "/docs/authentication",
  },
  {
    title: "API Reference",
    icon: Code2,
    children: [
      { title: "Admin Operations", href: "/docs/api/admin-operations" },
      { title: "Authentication", href: "/docs/api/auth" },
      { title: "Product Management", href: "/docs/api/products" },
      { title: "Order Management", href: "/docs/api/orders" },
      { title: "Menu System", href: "/docs/api/menus" },
      { title: "Customer Management", href: "/docs/api/customers" },
      { title: "Analytics & Reports", href: "/docs/api/analytics" },
      { title: "Communications", href: "/docs/api/communications" },
      { title: "Fraud & Security", href: "/docs/api/fraud" },
      { title: "Logistics", href: "/docs/api/logistics" },
    ],
  },
  {
    title: "Guides",
    icon: BookOpen,
    children: [
      { title: "Webhook Setup", href: "/docs/guides/webhooks" },
      { title: "Bulk Operations", href: "/docs/guides/bulk-operations" },
      { title: "Multi-tenant Setup", href: "/docs/guides/multi-tenant" },
      { title: "AI Features", href: "/docs/guides/ai-features" },
    ],
  },
  {
    title: "Security",
    icon: Shield,
    href: "/docs/security",
  },
  {
    title: "Error Codes",
    icon: AlertCircle,
    href: "/docs/errors",
  },
];

export function DocsSidebar() {
  const location = useLocation();

  return (
    <aside className="w-64 border-r border-border bg-card/50 backdrop-blur-sm">
      <ScrollArea className="h-[calc(100vh-4rem)]">
        <nav className="p-4 space-y-2">
          <Link
            to="/docs"
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
              location.pathname === "/docs"
                ? "bg-primary/10 text-primary"
                : "hover:bg-muted text-muted-foreground"
            )}
          >
            <Book className="h-4 w-4" />
            <span className="font-medium">Documentation Home</span>
          </Link>

          {navItems.map((item) => (
            <div key={item.title}>
              {item.href ? (
                <Link
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                    location.pathname === item.href
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted text-muted-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="font-medium">{item.title}</span>
                </Link>
              ) : (
                <>
                  <div className="flex items-center gap-3 px-3 py-2 text-sm font-semibold text-foreground">
                    <item.icon className="h-4 w-4" />
                    {item.title}
                  </div>
                  {item.children && (
                    <div className="ml-7 space-y-1 mt-1">
                      {item.children.map((child) => (
                        <Link
                          key={child.href}
                          to={child.href}
                          className={cn(
                            "block px-3 py-1.5 text-sm rounded-lg transition-colors",
                            location.pathname === child.href
                              ? "bg-primary/10 text-primary font-medium"
                              : "hover:bg-muted text-muted-foreground"
                          )}
                        >
                          {child.title}
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </nav>
      </ScrollArea>
    </aside>
  );
}
