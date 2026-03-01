/**
 * ShareButtons Component
 * Social sharing buttons for storefront pages
 * Supports Twitter, Facebook, and copy-to-clipboard
 */

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { Share2, Link2, Check } from 'lucide-react';

interface ShareButtonsProps {
    /** URL to share (defaults to current page) */
    url?: string;
    /** Title for the share */
    title: string;
    /** Description for the share */
    description?: string;
    /** Compact mode: icons only */
    compact?: boolean;
    /** Custom class name */
    className?: string;
}

export function ShareButtons({
    url,
    title,
    description,
    compact = false,
    className = '',
}: ShareButtonsProps) {
    const [copied, setCopied] = useState(false);

    const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : '');
    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedTitle = encodeURIComponent(title);

    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`;
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;

    const handleCopyLink = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            toast.success('Link copied!', { description: 'The store link has been copied to your clipboard.' });
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            logger.warn('Failed to copy to clipboard', err);
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = shareUrl;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            setCopied(true);
            toast.success('Link copied!');
            setTimeout(() => setCopied(false), 2000);
        }
    }, [shareUrl]);

    const handleNativeShare = useCallback(async () => {
        if (typeof navigator !== 'undefined' && navigator.share) {
            try {
                await navigator.share({
                    title,
                    text: description || title,
                    url: shareUrl,
                });
            } catch (err) {
                // User cancelled or share failed - not an error
                logger.debug('Native share cancelled or failed', err);
            }
        }
    }, [title, description, shareUrl]);

    const openInNewWindow = useCallback((targetUrl: string) => {
        window.open(targetUrl, '_blank', 'noopener,noreferrer,width=600,height=400');
    }, []);

    const hasNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

    if (compact) {
        return (
            <div className={`flex items-center gap-1 ${className}`}>
                {hasNativeShare && (
                    <Button variant="ghost" size="icon" className="h-11 w-11" onClick={handleNativeShare} title="Share" aria-label="Share">
                        <Share2 className="h-4 w-4" />
                    </Button>
                )}
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11"
                    onClick={() => openInNewWindow(twitterUrl)}
                    title="Share on Twitter"
                    aria-label="Share on Twitter"
                >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11"
                    onClick={() => openInNewWindow(facebookUrl)}
                    title="Share on Facebook"
                    aria-label="Share on Facebook"
                >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 7.834 7.834 0 0 0-.733-.009c-.707 0-1.259.096-1.675.345a1.783 1.783 0 0 0-.832.928c-.142.38-.213.862-.213 1.462v1.245h3.992l-.519 3.667H13.63v7.98z" />
                    </svg>
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11"
                    onClick={handleCopyLink}
                    title="Copy link"
                    aria-label="Copy link"
                >
                    {copied ? <Check className="h-4 w-4 text-success" /> : <Link2 className="h-4 w-4" />}
                </Button>
            </div>
        );
    }

    return (
        <div className={`flex flex-wrap items-center gap-2 ${className}`}>
            {hasNativeShare && (
                <Button variant="outline" size="sm" onClick={handleNativeShare} className="gap-2">
                    <Share2 className="h-4 w-4" />
                    Share
                </Button>
            )}
            <Button
                variant="outline"
                size="sm"
                onClick={() => openInNewWindow(twitterUrl)}
                className="gap-2"
            >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                Twitter
            </Button>
            <Button
                variant="outline"
                size="sm"
                onClick={() => openInNewWindow(facebookUrl)}
                className="gap-2"
            >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 7.834 7.834 0 0 0-.733-.009c-.707 0-1.259.096-1.675.345a1.783 1.783 0 0 0-.832.928c-.142.38-.213.862-.213 1.462v1.245h3.992l-.519 3.667H13.63v7.98z" />
                </svg>
                Facebook
            </Button>
            <Button
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                className="gap-2"
            >
                {copied ? <Check className="h-4 w-4 text-success" /> : <Link2 className="h-4 w-4" />}
                {copied ? 'Copied!' : 'Copy Link'}
            </Button>
        </div>
    );
}
