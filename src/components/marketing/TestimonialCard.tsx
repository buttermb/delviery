import Star from "lucide-react/dist/esm/icons/star";
import { motion } from "framer-motion";

interface TestimonialCardProps {
  quote: string;
  author: string;
  role: string;
  rating?: number;
  photo?: string;
}

export function TestimonialCard({ quote, author, role, rating = 5, photo }: TestimonialCardProps) {
  return (
    <motion.div 
      className="p-6 rounded-2xl bg-[hsl(var(--marketing-bg))] border border-[hsl(var(--marketing-border))] hover:shadow-lg transition-shadow"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex gap-1 mb-4">
        {[...Array(rating)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ 
              duration: 0.3, 
              delay: i * 0.1,
              type: "spring",
              stiffness: 200
            }}
          >
            <Star className="h-4 w-4 fill-[hsl(var(--marketing-accent))] text-[hsl(var(--marketing-accent))]" />
          </motion.div>
        ))}
      </div>
      <p className="text-[hsl(var(--marketing-text-light))] mb-4 italic">"{quote}"</p>
      <div className="flex items-center gap-3">
        {photo && (
          <motion.img 
            src={photo} 
            alt={author} 
            className="w-10 h-10 rounded-full object-cover"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          />
        )}
        <motion.div
          initial={{ x: -10, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <div className="font-medium text-[hsl(var(--marketing-text))]">{author}</div>
          <div className="text-sm text-[hsl(var(--marketing-text-light))]">{role}</div>
        </motion.div>
      </div>
    </motion.div>
  );
}

