import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'

export default function LuxuryHero() {
  const heroRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!heroRef.current) return
      const { clientX, clientY } = e
      const { width, height } = heroRef.current.getBoundingClientRect()
      const x = (clientX / width - 0.5) * 20
      const y = (clientY / height - 0.5) * 20
      heroRef.current.style.transform = `translate(${x}px, ${y}px)`
    }
    
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])
  
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden bg-black">
      
      {/* Ambient background - ultra subtle */}
      <div className="absolute inset-0">
        {/* Gradient base */}
        <div className="absolute inset-0 bg-gradient-to-br from-black via-neutral-950 to-black" />
        
        {/* Floating orbs - parallax effect */}
        <div ref={heroRef} className="absolute inset-0 transition-transform duration-1000 ease-out">
          <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-emerald-400/5 rounded-full blur-3xl" />
        </div>
        
        {/* Noise texture for depth */}
        <div 
          className="absolute inset-0 opacity-[0.015]" 
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"%3E%3Cfilter id="noiseFilter"%3E%3CfeTurbulence type="fractalNoise" baseFrequency="3" numOctaves="4" /%3E%3C/filter%3E%3Crect width="100%25" height="100%25" filter="url(%23noiseFilter)" /%3E%3C/svg%3E")' }}
        />
      </div>
      
      {/* Content - ultra minimal */}
      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          
          {/* Small overline - subtle */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="inline-flex items-center gap-2 px-4 py-2 mb-12 bg-white/[0.02] backdrop-blur-2xl rounded-full border border-white/[0.05]"
          >
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-xs text-white/50 font-light tracking-[0.2em] uppercase">
              NYC Licensed Delivery
            </span>
          </motion.div>
          
          {/* Main headline - ultra clean */}
          <motion.h1 
            className="mb-8"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <span className="block text-white font-extralight text-[clamp(3rem,12vw,7rem)] leading-[0.95] tracking-[-0.02em] mb-4">
              Premium
            </span>
            <span className="block bg-gradient-to-r from-emerald-300 via-emerald-400 to-teal-400 bg-clip-text text-transparent font-light text-[clamp(3rem,12vw,7rem)] leading-[0.95] tracking-[-0.02em]">
              Flower
            </span>
          </motion.h1>
          
          {/* Subheadline - generous spacing */}
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-white/50 text-lg md:text-xl font-light leading-relaxed mb-16 max-w-2xl mx-auto"
          >
            Curated strains from licensed cultivators. Lab-verified quality.
            <br className="hidden md:block" />
            Same-day delivery throughout NYC.
          </motion.p>
          
          {/* CTA - minimal but prominent */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <button 
              onClick={() => {
                if (window.location.pathname === '/') {
                  document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' })
                } else {
                  navigate('/#products')
                }
              }}
              className="group relative px-10 py-4 bg-white text-black text-sm font-light tracking-wide rounded-full hover:bg-emerald-50 transition-all duration-300 overflow-hidden"
            >
              <span className="relative z-10">Explore Collection</span>
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-teal-400 opacity-0 group-hover:opacity-10 transition-opacity" />
            </button>
            
            <button 
              onClick={() => navigate('/about')}
              className="px-10 py-4 text-white text-sm font-light tracking-wide rounded-full border border-white/10 hover:border-white/30 hover:bg-white/5 transition-all duration-300"
            >
              Learn More
            </button>
          </motion.div>
          
          {/* Trust indicators - ultra minimal */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="flex items-center justify-center gap-8 mt-20 text-white/30 text-xs font-light tracking-wider"
          >
            <span className="flex items-center gap-2">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Licensed
            </span>
            <span className="flex items-center gap-2">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Lab Verified
            </span>
            <span className="flex items-center gap-2">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Same-Day
            </span>
          </motion.div>
          
        </div>
      </div>
      
      {/* Scroll indicator - minimal */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 animate-bounce">
        <div className="flex flex-col items-center gap-2 text-white/20">
          <span className="text-[10px] font-light tracking-widest uppercase">Scroll</span>
          <div className="w-[1px] h-12 bg-gradient-to-b from-white/20 to-transparent" />
        </div>
      </div>
      
    </section>
  )
}

