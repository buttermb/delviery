import { Link } from "react-router-dom";
import { LucideIcon, ArrowRight } from "lucide-react";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  link?: string;
}

export function FeatureCard({ icon: Icon, title, description, link }: FeatureCardProps) {
  const content = (
    <div className="p-6 rounded-xl border border-[hsl(var(--marketing-border))] bg-white hover:border-[hsl(var(--marketing-primary))]/50 transition-all card-hover group">
      <div className="w-12 h-12 rounded-xl bg-[hsl(var(--marketing-primary))]/10 flex items-center justify-center mb-4 group-hover:bg-[hsl(var(--marketing-primary))]/20 transition-colors">
        <Icon className="h-6 w-6 text-[hsl(var(--marketing-primary))]" />
      </div>
      <h3 className="text-xl font-bold mb-2 text-[hsl(var(--marketing-text))]">{title}</h3>
      <p className="text-[hsl(var(--marketing-text-light))] mb-4">{description}</p>
      {link && (
        <Link to={link} className="inline-flex items-center text-[hsl(var(--marketing-primary))] font-medium hover:gap-2 transition-all">
          Learn More <ArrowRight className="ml-1 h-4 w-4" />
        </Link>
      )}
    </div>
  );

  return content;
}

