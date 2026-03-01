import { cleanProductName } from '@/utils/productName'
import ProductImage from '@/components/ProductImage'

interface LuxuryProductCardProps {
  name: string
  type: 'Indica' | 'Sativa' | 'Hybrid' | string
  description: string
  price: number
  rating: number
  reviews: number
  image?: string
  featured?: boolean
}

export default function LuxuryProductCard({
  name,
  type,
  description,
  price,
  rating,
  reviews,
  image,
  featured = false
}: LuxuryProductCardProps) {
  
  const typeColors = {
    Indica: 'from-purple-400/20 to-purple-600/20 text-purple-300',
    Sativa: 'from-blue-400/20 to-blue-600/20 text-blue-300',
    Hybrid: 'from-emerald-400/20 to-emerald-600/20 text-emerald-300'
  }
  
  const colorClass = typeColors[type as keyof typeof typeColors] || 'from-emerald-400/20 to-emerald-600/20 text-emerald-300'
  const cleanedName = cleanProductName(name)
  
  return (
    <div className="group relative">
      
      {/* Glass card with hover effect */}
      <div className="relative bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] hover:border-white/10 rounded-2xl overflow-hidden transition-all duration-500 hover:scale-[1.02]">
        
        {/* Glow effect on hover */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/0 to-emerald-500/0 group-hover:from-emerald-500/5 group-hover:to-transparent transition-all duration-500" />
        
        {/* Featured badge - minimal */}
        {featured && (
          <div className="absolute top-4 right-4 z-10 px-3 py-1 bg-white/5 backdrop-blur-xl border border-white/10 rounded-full">
            <span className="text-emerald-400 text-[10px] font-light tracking-widest uppercase">Featured</span>
          </div>
        )}
        
        {/* Image container with ProductImage */}
        <div className="relative aspect-[4/3] overflow-hidden">
          <ProductImage
            src={image}
            alt={cleanedName}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
          />
          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
          
          {/* Type badge - floating */}
          <div className={`absolute bottom-4 left-4 px-3 py-1.5 bg-gradient-to-r ${colorClass} backdrop-blur-xl rounded-full border border-white/10 z-10`}>
            <span className="text-xs font-light tracking-wider">{type}</span>
          </div>
        </div>
        
        {/* Content */}
        <div className="p-6 relative">
          
          {/* Name */}
          <h3 className="text-white text-xl font-light tracking-tight mb-2">
            {cleanedName}
          </h3>
          
          {/* Description */}
          <p className="text-white/40 text-sm font-light leading-relaxed mb-6">
            {description}
          </p>
          
          {/* Rating - minimal */}
          <div className="flex items-center gap-3 mb-6 pb-6 border-b border-white/5">
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span className="text-white text-sm font-light">{rating}</span>
            </div>
            <span className="text-white/30 text-xs font-light">({reviews} reviews)</span>
          </div>
          
          {/* Price & CTA */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-white/30 text-[10px] font-light tracking-wider uppercase mb-1">From</div>
              <div className="text-white text-2xl font-light">${price}</div>
            </div>
            <button className="px-6 py-2.5 bg-background/5 hover:bg-background text-foreground hover:text-background border border-border hover:border-foreground rounded-full text-sm font-light tracking-wide transition-all duration-300">
              Select
            </button>
          </div>
          
        </div>
      </div>
      
    </div>
  )
}

