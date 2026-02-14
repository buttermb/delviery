/**
 * Refined FAQ Section
 * Clean accordion, not overwhelming
 */

import { motion } from 'framer-motion';
import { useState } from 'react';

const faqs = [
  {
    question: 'What are your delivery hours?',
    answer: 'We deliver daily from 11 AM to 9 PM. Orders placed before 8 PM typically arrive within 60 minutes.',
  },
  {
    question: 'How is privacy maintained?',
    answer: 'All deliveries use unmarked, odor-proof packaging. Our professional couriers ensure complete discretion.',
  },
  {
    question: 'What forms of payment do you accept?',
    answer: 'We accept cash, debit cards, and digital payment methods including Venmo, Cash App, and Zelle.',
  },
  {
    question: 'Are lab certificates available?',
    answer: 'Yes. Every strain includes detailed lab testing results for purity, potency, and quality verification.',
  },
];

export function RefinedFAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="py-24 md:py-32 bg-neutral-900">
      <div className="container mx-auto px-6 max-w-4xl">
        
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center mb-16 md:mb-20"
        >
          <h2 className="text-4xl sm:text-6xl md:text-7xl font-light text-white mb-6 tracking-tight">
            Common Questions
          </h2>
        </motion.div>
        
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <motion.details
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              open={openIndex === index}
              className="group border-b border-white/10 pb-6"
            >
              <summary
                onClick={(e) => {
                  e.preventDefault();
                  toggle(index);
                }}
                className="flex items-center justify-between cursor-pointer list-none"
              >
                <h3 className="text-xl text-white font-light pr-4">
                  {faq.question}
                </h3>
                <svg
                  className={`w-6 h-6 text-white/40 transition-transform ${openIndex === index ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </summary>
              
              {openIndex === index && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="mt-4 text-white/60 font-light leading-relaxed"
                >
                  {faq.answer}
                </motion.p>
              )}
            </motion.details>
          ))}
        </div>
        
      </div>
    </section>
  );
}

