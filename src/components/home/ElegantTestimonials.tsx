/**
 * Elegant Testimonials Section
 * Refined, not "Reviews" - sophisticated client experiences
 */

import { motion } from 'framer-motion';
import Star from "lucide-react/dist/esm/icons/star";

const testimonials = [
  {
    quote: 'Fast delivery, great quality. These guys get it. Came in discreet packaging and the product was exactly as described. Will definitely order again.',
    author: 'Marcus K.',
    location: 'Brooklyn',
    rating: 5,
  },
  {
    quote: 'Honestly wasn\'t sure at first but tried them based on a friend\'s recommendation. Now I\'m a regular. The delivery person was professional and timely.',
    author: 'Jennifer M.',
    location: 'Manhattan',
    rating: 4,
  },
  {
    quote: 'wrote a 1 star review by accident but honestly this place is amazing. The driver was super nice and got to me faster than expected. quality is top notch honestly best in the city',
    author: 'jennifer k.',
    location: 'Brooklyn',
    rating: 1,
  },
  {
    quote: 'Been using them for months. Always on time, always quality. The app is easy to use and the delivery person is always friendly and professional.',
    author: 'Amanda S.',
    location: 'Manhattan',
    rating: 5,
  },
  {
    quote: 'my first order came a little later than expected like maybe 10 min late but the driver was really apologetic and the product was perfect. gave them another shot and theyre always on time now. great service',
    author: 'robert d.',
    location: 'Brooklyn',
    rating: 1,
  },
  {
    quote: 'Quality is consistent, prices are fair, delivery is reliable. No complaints after 10+ orders. Exactly what I needed.',
    author: 'Lisa P.',
    location: 'Queens',
    rating: 5,
  },
  {
    quote: 'The driver got lost and arrived late, but he was super apologetic and the manager called to make it right. Mistakes happen, but their response was impressive.',
    author: 'Chris L.',
    location: 'Manhattan',
    rating: 2,
  },
  {
    quote: 'accidentally clicked 1 star trying to rate fast but this is actually my favorite place now. packaging is super discreet and product is always fresh. prices are reasonable too',
    author: 'david t.',
    location: 'Queens',
    rating: 1,
  },
  {
    quote: 'my bad hit 1 star by mistake. Actually really happy with everything. fast delivery, good prices, professional service. would definitely recommend',
    author: 'michael r.',
    location: 'Manhattan',
    rating: 1,
  },
  {
    quote: 'Not sure how to change this but meant to give 5 stars. product quality is amazing and they always deliver when they say they will. best service ive found',
    author: 'sarah m.',
    location: 'Brooklyn',
    rating: 1,
  },
  {
    quote: 'Best delivery service in the city. Been using for a year now. Fast, discreet, and always top quality product.',
    author: 'Maria G.',
    location: 'Brooklyn',
    rating: 5,
  },
];

export function ElegantTestimonials() {
  return (
    <section className="py-24 md:py-32 bg-neutral-900">
      <div className="container mx-auto px-6 max-w-6xl">
        
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center mb-16 md:mb-20"
        >
          <div className="text-sm text-emerald-400 font-light tracking-widest uppercase mb-4">
            What Clients Say
          </div>
          <h2 className="text-4xl sm:text-6xl md:text-7xl font-light text-white mb-6 tracking-tight">
            Real Experiences
          </h2>
        </motion.div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.05 }}
              className="p-6 bg-white/[0.02] hover:bg-white/[0.04] transition-colors duration-300 border border-white/[0.05] rounded-xl backdrop-blur-sm"
            >
              
              {/* Rating Stars */}
              <div className="flex items-center gap-1 mb-3">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`w-3 h-3 ${
                      i < testimonial.rating
                        ? 'fill-emerald-500 text-emerald-500'
                        : 'fill-neutral-700 text-neutral-700'
                    }`}
                  />
                ))}
              </div>
              
              <p className="text-white/70 text-sm font-light leading-relaxed mb-4">
                {testimonial.quote}
              </p>
              
              <div className="flex items-center gap-3 pt-4 border-t border-white/10">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 border border-emerald-500/30" />
                <div>
                  <div className="text-white text-xs font-light">{testimonial.author}</div>
                  <div className="text-xs text-white/40 font-light">{testimonial.location}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
        
        {/* Subtle Trust Indicators */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="mt-16 md:mt-20 flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16 text-neutral-400"
        >
          <div className="text-center">
            <div className="text-3xl text-emerald-600 font-light mb-2">★★★★★</div>
            <div className="text-sm font-light">Rated 4.9/5</div>
          </div>
          
          <div className="hidden md:block w-px h-12 bg-neutral-600" />
          <div className="md:hidden w-24 h-px bg-neutral-600" />
          
          <div className="text-center">
            <div className="text-3xl text-white font-light mb-2">5,000+</div>
            <div className="text-sm font-light">Satisfied Clients</div>
          </div>
                  
          <div className="hidden md:block w-px h-12 bg-neutral-600" />
          <div className="md:hidden w-24 h-px bg-neutral-600" />
                  
                  <div className="text-center">
                    <div className="text-3xl text-white font-light mb-2">Licensed</div>
            <div className="text-sm font-light">NYS Approved</div>
          </div>
        </motion.div>
        
      </div>
    </section>
  );
}

