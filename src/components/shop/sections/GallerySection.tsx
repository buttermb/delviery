import { motion } from 'framer-motion';
import { useState } from 'react';
import { X } from 'lucide-react';

export interface GallerySectionProps {
    content: {
        heading: string;
        subheading: string;
        images?: Array<{
            url: string;
            alt: string;
        }>;
    };
    styles: {
        background_color: string;
        text_color: string;
        accent_color: string;
    };
}

const defaultImages = [
    { url: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=600', alt: 'Product 1' },
    { url: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600', alt: 'Product 2' },
    { url: 'https://images.unsplash.com/photo-1567016376408-0226e4d0c1ea?w=600', alt: 'Product 3' },
    { url: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=600', alt: 'Product 4' },
    { url: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600', alt: 'Product 5' },
    { url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600', alt: 'Product 6' },
];

export function GallerySection({ content, styles }: GallerySectionProps) {
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    const {
        heading = "Gallery",
        subheading = "A curated visual experience",
        images = defaultImages
    } = content || {};

    const {
        background_color = "#000000",
        text_color = "#ffffff",
        accent_color = "#10b981"
    } = styles || {};

    return (
        <section className="py-24 px-6" style={{ backgroundColor: background_color }}>
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-16"
                >
                    <p className="text-sm uppercase tracking-widest mb-4" style={{ color: accent_color }}>
                        {subheading}
                    </p>
                    <h2 className="text-4xl md:text-5xl font-light" style={{ color: text_color }}>
                        {heading}
                    </h2>
                </motion.div>

                {/* Masonry-style Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {images.map((image, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, scale: 0.9 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.05 }}
                            className={`relative overflow-hidden rounded-xl cursor-pointer group ${
                                index % 5 === 0 ? 'md:row-span-2' : ''
                            }`}
                            onClick={() => setSelectedImage(image.url)}
                        >
                            <img
                                src={image.url}
                                alt={image.alt}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                style={{ minHeight: index % 5 === 0 ? '400px' : '200px' }}
                            />
                            <div 
                                className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                            />
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Lightbox */}
            {selectedImage && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
                    onClick={() => setSelectedImage(null)}
                >
                    <button
                        className="absolute top-6 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                        onClick={() => setSelectedImage(null)}
                    >
                        <X className="w-6 h-6 text-white" />
                    </button>
                    <motion.img
                        initial={{ scale: 0.9 }}
                        animate={{ scale: 1 }}
                        src={selectedImage}
                        alt="Gallery image"
                        className="max-w-full max-h-[90vh] object-contain rounded-lg"
                        onClick={(e) => e.stopPropagation()}
                    />
                </motion.div>
            )}
        </section>
    );
}
