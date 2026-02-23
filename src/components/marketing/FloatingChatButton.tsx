import { AnimatePresence, motion } from 'framer-motion';
import { MessageCircle, X, Send } from 'lucide-react';
import { useState, useRef } from 'react';

export function FloatingChatButton() {
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <motion.button
        className="fixed bottom-28 right-4 md:bottom-6 md:right-6 w-16 h-16 md:w-14 md:h-14 rounded-full bg-gradient-to-br from-[hsl(var(--marketing-primary))] to-[hsl(var(--marketing-accent))] text-white shadow-lg hover:shadow-xl z-50 flex items-center justify-center touch-target safe-area-bottom"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        aria-label={isOpen ? "Close chat" : "Open chat"}
        aria-expanded={isOpen}
      >
        <motion.div
          animate={{ rotate: isOpen ? 90 : 0 }}
          transition={{ duration: 0.2 }}
        >
          {isOpen ? (
            <X className="h-6 w-6" aria-hidden="true" />
          ) : (
            <MessageCircle className="h-6 w-6" aria-hidden="true" />
          )}
        </motion.div>
        {!isOpen && (
          <motion.div
            className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            aria-hidden="true"
          />
        )}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed bottom-32 right-4 md:bottom-24 md:right-6 w-[calc(100vw-2rem)] md:w-80 h-96 glass-card rounded-xl shadow-2xl z-50 border border-border overflow-hidden"
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ duration: 0.2 }}
            role="dialog"
            aria-label="Live chat"
          >
            <div className="p-4 border-b border-border bg-gradient-to-r from-[hsl(var(--marketing-primary))] to-[hsl(var(--marketing-accent))] text-white">
              <h3 className="font-semibold">Chat with us</h3>
              <p className="text-sm text-white/80">We're here to help!</p>
            </div>
            <div className="p-4 h-full flex flex-col">
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                <div className="text-center">
                  <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-50" aria-hidden="true" />
                  <p>Start a conversation</p>
                  <p className="text-xs mt-1">Our team typically responds in minutes</p>
                </div>
              </div>
              <div className="border-t border-border pt-4 flex gap-2">
                <label htmlFor="chat-input" className="sr-only">Type your message</label>
                <input
                  id="chat-input"
                  ref={inputRef}
                  type="text"
                  placeholder="Type your message..."
                  className="flex-1 px-4 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
                  aria-label="Chat message"
                />
                <button
                  type="button"
                  className="px-3 py-2 rounded-lg bg-[hsl(var(--marketing-primary))] text-white hover:bg-[hsl(var(--marketing-primary))]/90 transition-colors"
                  aria-label="Send message"
                >
                  <Send className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
