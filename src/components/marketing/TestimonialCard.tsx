import { Star } from "lucide-react";

interface TestimonialCardProps {
  quote: string;
  author: string;
  role: string;
  rating?: number;
  photo?: string;
}

export function TestimonialCard({ quote, author, role, rating = 5, photo }: TestimonialCardProps) {
  return (
    <div className="p-6 rounded-2xl bg-[hsl(var(--marketing-bg))] border border-[hsl(var(--marketing-border))] hover:shadow-lg transition-shadow">
      <div className="flex gap-1 mb-4">
        {[...Array(rating)].map((_, i) => (
          <Star key={i} className="h-4 w-4 fill-[hsl(var(--marketing-accent))] text-[hsl(var(--marketing-accent))]" />
        ))}
      </div>
      <p className="text-[hsl(var(--marketing-text-light))] mb-4 italic">"{quote}"</p>
      <div className="flex items-center gap-3">
        {photo && (
          <img src={photo} alt={author} className="w-10 h-10 rounded-full object-cover" />
        )}
        <div>
          <div className="font-medium text-[hsl(var(--marketing-text))]">{author}</div>
          <div className="text-sm text-[hsl(var(--marketing-text-light))]">{role}</div>
        </div>
      </div>
    </div>
  );
}

