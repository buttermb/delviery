
export interface OptimizedImage {
    urls: {
        thumbnail: string;
        card: string;
        full: string;
    };
    blurhash?: string;
}

export class ImageOptimizer {
    private static instance: ImageOptimizer;

    private constructor() { }

    static getInstance(): ImageOptimizer {
        if (!ImageOptimizer.instance) {
            ImageOptimizer.instance = new ImageOptimizer();
        }
        return ImageOptimizer.instance;
    }

    async processProductImage(file: File): Promise<OptimizedImage> {
        // 1. Generate multiple sizes
        const sizes = [
            { name: 'thumbnail', width: 150, height: 150 },
            { name: 'card', width: 300, height: 300 },
            { name: 'full', width: 800, height: 800 }
        ];

        const optimizedBlobs = await Promise.all(
            sizes.map(size => this.resizeAndConvert(file, size.width, size.height))
        );

        // 2. Upload to CDN (Mock implementation)
        const urls = await this.uploadToCDN(optimizedBlobs, sizes.map(s => s.name));

        // 3. Generate Blurhash (Mock)
        const blurhash = "LEHV6nWB2yk8pyo0adR*.7kCMdnj";

        return {
            urls: {
                thumbnail: urls[0],
                card: urls[1],
                full: urls[2]
            },
            blurhash
        };
    }

    private async resizeAndConvert(file: File, width: number, height: number): Promise<Blob> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                // Calculate aspect ratio to fit
                const scale = Math.min(width / img.width, height / img.height);
                const w = img.width * scale;
                const h = img.height * scale;

                canvas.width = w;
                canvas.height = h;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Canvas context not available'));
                    return;
                }

                ctx.drawImage(img, 0, 0, w, h);

                // Convert to WebP
                canvas.toBlob(blob => {
                    if (blob) resolve(blob);
                    else reject(new Error('Blob creation failed'));
                }, 'image/webp', 0.85);
            };
            img.onerror = reject;
            img.src = URL.createObjectURL(file);
        });
    }

    private async uploadToCDN(blobs: Blob[], names: string[]): Promise<string[]> {
        // Mock upload - in real app, use Supabase Storage or AWS S3
        // For now, return object URLs or placeholder CDN URLs
        return names.map(name => `https://cdn.example.com/images/${name}_${Date.now()}.webp`);
    }
}
