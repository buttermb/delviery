/**
 * Premium Product Showcase
 * Elegant, minimalist product display
 */

import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const products = [
  {
    id: 'og-kush',
    name: 'OG Kush',
    type: 'INDICA',
    description: 'Classic West Coast strain. Earthy pine notes with hints of lemon. Renowned for relaxation.',
    price: 45,
    rating: 247,
  },
  {
    id: 'blue-dream',
    name: 'Blue Dream',
    type: 'SATIVA',
    description: 'Award-winning sativa. Sweet berry aroma with a balanced, uplifting cerebral high.',
    price: 48,
    rating: 189,
  },
  {
    id: 'wedding-cake',
    name: 'Wedding Cake',
    type: 'HYBRID',
    description: 'Rich vanilla and earthy tones. Dense trichomes and powerful, long-lasting effects.',
    price: 52,
    rating: 312,
  },
];

export function PremiumProductShowcase() {
  const navigate = useNavigate();

  return (
    <section className="py-24 md:py-32 bg-neutral-900" data-dark-panel>
      <div className="container mx-auto px-6 max-w-7xl">
        
        {/* Elegant Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="mb-16 md:mb-20"
        >
          <div className="text-sm text-emerald-600 font-light tracking-widest uppercase mb-4">
            Our Collection
          </div>
          <h2 className="text-4xl sm:text-6xl md:text-7xl font-light text-white mb-6 tracking-tight">
            Curated Flower
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-neutral-400 font-light max-w-2xl leading-relaxed">
            Hand-selected premium strains. Each batch lab-verified 
            for quality, purity, and consistency.
          </p>
        </motion.div>
        
        {/* Premium Product Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {products.map((product, index) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="group relative bg-neutral-800 overflow-hidden cursor-pointer transition-all duration-500 hover:shadow-2xl"
              onClick={() => {
                const productsSection = document.getElementById('products');
                if (productsSection) {
                  productsSection.scrollIntoView({ behavior: 'smooth' });
                }
              }}
            >
              
              {/* Subtle Badge */}
              {index === 0 && (
                <div className="absolute top-6 left-6 z-10 px-3 py-1 bg-neutral-900/80 backdrop-blur-sm text-white text-xs font-light tracking-wider">
                  POPULAR
                </div>
              )}
              
              {/* Product Image Placeholder */}
              <div className="relative h-80 overflow-hidden bg-neutral-100">
                <div className="w-full h-full bg-gradient-to-br from-emerald-100 to-emerald-50 flex items-center justify-center">
                  <div className="text-6xl">🌿</div>
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              </div>
              
              {/* Product Info */}
              <div className="p-8">
                
                {/* Strain Type Badge */}
                <div className="inline-block px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-light tracking-wider mb-4">
                  {product.type}
                </div>
                
                <h3 className="text-2xl font-light text-white mb-3 tracking-tight">
                  {product.name}
                </h3>
                
                <p className="text-neutral-400 text-sm font-light leading-relaxed mb-6">
                  {product.description}
                </p>
                
                {/* Subtle Rating */}
                <div className="flex items-center gap-2 mb-6 text-sm text-neutral-400">
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map(i => (
                      <Star key={i} className="w-4 h-4 text-emerald-400 fill-emerald-400" />
                    ))}
                  </div>
                  <span className="font-light">({product.rating})</span>
                </div>
                
                {/* Pricing */}
                <div className="flex items-center justify-between pt-6 border-t border-neutral-700">
                  <div>
                    <div className="text-xs text-neutral-400 font-light mb-1">From</div>
                    <div className="text-2xl text-white font-light">${product.price}</div>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/menu');
                    }}
                    className="px-6 py-3 bg-emerald-600 text-white text-sm font-light tracking-wide hover:bg-emerald-500 transition-all duration-300"
                  >
                    Select
                  </button>
                </div>
              </div>
              
            </motion.div>
          ))}
        </div>
        
        {/* Subtle View All Link */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center"
        >
          <button
            onClick={() => navigate('/menu')}
            className="inline-flex items-center gap-2 text-white font-light tracking-wide hover:text-emerald-400 transition-colors group"
          >
            <span>View Full Collection</span>
            <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
        </motion.div>
        
      </div>
    </section>
  );
}

