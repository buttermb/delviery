/**
 * FullScreenEditorPortal Component
 * Renders the storefront editor at document.body level, escaping all parent constraints
 */

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface FullScreenEditorPortalProps {
    children: React.ReactNode;
    isOpen: boolean;
}

export function FullScreenEditorPortal({
    children,
    isOpen,
}: FullScreenEditorPortalProps) {
    // Prevent background scroll on mobile
    useEffect(() => {
        if (!isOpen) return;

        const preventDefault = (e: TouchEvent) => {
            // Allow scrolling within the portal
            const target = e.target as HTMLElement;
            if (target.closest('.fullscreen-editor-content')) {
                return;
            }
            e.preventDefault();
        };

        document.addEventListener('touchmove', preventDefault, { passive: false });
        return () => document.removeEventListener('touchmove', preventDefault);
    }, [isOpen]);

    if (!isOpen) return null;

    return createPortal(
        <AnimatePresence mode="wait">
            <motion.div
                key="fullscreen-editor"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-modal bg-background"
            >
                <motion.div
                    initial={{ scale: 0.98, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.98, opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className="h-full w-full fullscreen-editor-content"
                >
                    {children}
                </motion.div>
            </motion.div>
        </AnimatePresence>,
        document.body
    );
}
