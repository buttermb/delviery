/**
 * Luxury Footer - Dark themed footer matching BudDash design
 */

import { Link, useParams } from 'react-router-dom';
import { useShop } from '@/pages/shop/ShopLayout';
import { Leaf, Mail, Phone, Clock, Instagram, Twitter, Facebook } from 'lucide-react';

interface LuxuryFooterProps {
    accentColor?: string;
}

export function LuxuryFooter({ accentColor = '#10b981' }: LuxuryFooterProps) {
    const { storeSlug } = useParams();
    const { store } = useShop();

    const currentYear = new Date().getFullYear();

    return (
        <footer className="bg-black border-t border-white/[0.05]">
            {/* Main Footer Content */}
            <div className="container mx-auto px-6 py-16">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">

                    {/* Brand Column */}
                    <div className="lg:col-span-1">
                        <div className="flex items-center gap-2 mb-6">
                            {store?.logo_url ? (
                                <img
                                    src={store.logo_url}
                                    alt={store.store_name}
                                    className="h-8 object-contain"
                                />
                            ) : (
                                <>
                                    <Leaf className="w-6 h-6" style={{ color: accentColor }} />
                                    <span className="text-white font-light text-xl">
                                        {store?.store_name || 'Premium Store'}
                                    </span>
                                </>
                            )}
                        </div>
                        <p className="text-white/40 text-sm font-light leading-relaxed mb-6">
                            {store?.tagline || 'Premium products from licensed providers. Lab-tested. Fast delivery.'}
                        </p>

                        {/* Social Links */}
                        <div className="flex items-center gap-4">
                            <a
                                href="#"
                                className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all"
                                aria-label="Instagram"
                            >
                                <Instagram className="w-4 h-4" />
                            </a>
                            <a
                                href="#"
                                className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all"
                                aria-label="Twitter"
                            >
                                <Twitter className="w-4 h-4" />
                            </a>
                            <a
                                href="#"
                                className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all"
                                aria-label="Facebook"
                            >
                                <Facebook className="w-4 h-4" />
                            </a>
                        </div>
                    </div>

                    {/* Shop Links */}
                    <div>
                        <h4 className="text-white font-light mb-6 tracking-wide">Shop</h4>
                        <ul className="space-y-3">
                            <li>
                                <Link
                                    to={`/shop/${storeSlug}/products`}
                                    className="text-white/40 text-sm font-light hover:text-white transition-colors"
                                >
                                    All Products
                                </Link>
                            </li>
                            <li>
                                <Link
                                    to={`/shop/${storeSlug}/products?category=flower`}
                                    className="text-white/40 text-sm font-light hover:text-white transition-colors"
                                >
                                    Flower
                                </Link>
                            </li>
                            <li>
                                <Link
                                    to={`/shop/${storeSlug}/products?category=edibles`}
                                    className="text-white/40 text-sm font-light hover:text-white transition-colors"
                                >
                                    Edibles
                                </Link>
                            </li>
                            <li>
                                <Link
                                    to={`/shop/${storeSlug}/products?category=pre-rolls`}
                                    className="text-white/40 text-sm font-light hover:text-white transition-colors"
                                >
                                    Pre-Rolls
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Support Links */}
                    <div>
                        <h4 className="text-white font-light mb-6 tracking-wide">Support</h4>
                        <ul className="space-y-3">
                            <li>
                                <Link
                                    to={`/shop/${storeSlug}/orders`}
                                    className="text-white/40 text-sm font-light hover:text-white transition-colors"
                                >
                                    Track Order
                                </Link>
                            </li>
                            <li>
                                <Link
                                    to={`/shop/${storeSlug}/account`}
                                    className="text-white/40 text-sm font-light hover:text-white transition-colors"
                                >
                                    My Account
                                </Link>
                            </li>
                            <li>
                                <a
                                    href="#"
                                    className="text-white/40 text-sm font-light hover:text-white transition-colors"
                                >
                                    FAQ
                                </a>
                            </li>
                            <li>
                                <a
                                    href="#"
                                    className="text-white/40 text-sm font-light hover:text-white transition-colors"
                                >
                                    Contact Us
                                </a>
                            </li>
                        </ul>
                    </div>

                    {/* Contact Info */}
                    <div>
                        <h4 className="text-white font-light mb-6 tracking-wide">Contact</h4>
                        <ul className="space-y-4">
                            <li className="flex items-center gap-3 text-white/40 text-sm font-light">
                                <Clock className="w-4 h-4" style={{ color: accentColor }} />
                                8 AM - 10 PM Daily
                            </li>
                            <li className="flex items-center gap-3">
                                <Mail className="w-4 h-4" style={{ color: accentColor }} />
                                <a href="mailto:support@example.com" className="text-white/40 text-sm font-light hover:text-white transition-colors">
                                    support@example.com
                                </a>
                            </li>
                            <li className="flex items-center gap-3">
                                <Phone className="w-4 h-4" style={{ color: accentColor }} />
                                <a href="tel:+1234567890" className="text-white/40 text-sm font-light hover:text-white transition-colors">
                                    (123) 456-7890
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Bottom Bar */}
            <div className="border-t border-white/[0.05]">
                <div className="container mx-auto px-6 py-6">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-white/30 text-xs font-light">
                        <p>© {currentYear} {store?.store_name || 'Premium Store'}. All rights reserved.</p>
                        <div className="flex items-center gap-6">
                            <a href="#" className="hover:text-white transition-colors">Terms</a>
                            <a href="#" className="hover:text-white transition-colors">Privacy</a>
                            <a href="#" className="hover:text-white transition-colors">Cookies</a>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
}
