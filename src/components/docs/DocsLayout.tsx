import { ReactNode } from "react";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { DocsSidebar } from "./DocsSidebar";

interface DocsLayoutProps {
  children: ReactNode;
}

export function DocsLayout({ children }: DocsLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />
      <div className="flex">
        <DocsSidebar />
        <main className="flex-1">
          <div className="container mx-auto px-6 py-12 max-w-5xl">
            {children}
          </div>
        </main>
      </div>
      <MarketingFooter />
    </div>
  );
}
