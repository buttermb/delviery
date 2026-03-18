import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { OptimizedImage } from '@/components/OptimizedImage';

const SUPABASE_URL =
  'https://test.supabase.co/storage/v1/object/public/product-images/photo.jpg';
const EXTERNAL_URL = 'https://cdn.example.com/photo.jpg';

describe('OptimizedImage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a <picture> element with AVIF and WebP sources for Supabase URLs', () => {
    const { container } = render(
      <OptimizedImage src={SUPABASE_URL} alt="Product" priority />,
    );

    const sources = container.querySelectorAll('source');
    expect(sources).toHaveLength(2);

    const avifSource = sources[0];
    expect(avifSource.getAttribute('type')).toBe('image/avif');
    expect(avifSource.getAttribute('srcSet')).toContain('format=avif');
    expect(avifSource.getAttribute('srcSet')).toContain('1x');
    expect(avifSource.getAttribute('srcSet')).toContain('2x');
    expect(avifSource.getAttribute('srcSet')).toContain('3x');

    const webpSource = sources[1];
    expect(webpSource.getAttribute('type')).toBe('image/webp');
    expect(webpSource.getAttribute('srcSet')).toContain('format=webp');
  });

  it('generates correct width and quality params in srcset', () => {
    const { container } = render(
      <OptimizedImage
        src={SUPABASE_URL}
        alt="Product"
        priority
        width={300}
        quality={75}
      />,
    );

    const avifSource = container.querySelector('source[type="image/avif"]');
    const srcSet = avifSource?.getAttribute('srcSet') ?? '';

    // 1x: width=300, quality=75
    expect(srcSet).toContain('width=300');
    expect(srcSet).toContain('quality=75');
    // 2x: width=600
    expect(srcSet).toContain('width=600');
    // 3x: width=900, quality=65 (75 - 10)
    expect(srcSet).toContain('width=900');
    expect(srcSet).toContain('quality=65');
  });

  it('renders a plain <img> for non-Supabase URLs', () => {
    const { container } = render(
      <OptimizedImage src={EXTERNAL_URL} alt="External" priority />,
    );

    const picture = container.querySelector('picture');
    expect(picture).toBeNull();

    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img?.getAttribute('src')).toBe(EXTERNAL_URL);
  });

  it('shows error fallback when image fails to load', () => {
    const { container } = render(
      <OptimizedImage src={EXTERNAL_URL} alt="Broken" priority />,
    );

    const img = container.querySelector('img')!;
    fireEvent.error(img);

    expect(screen.getByText('Broken')).toBeInTheDocument();
  });

  it('shows error fallback when src is null', () => {
    render(<OptimizedImage src={null} alt="No image" priority />);
    expect(screen.getByText('No image')).toBeInTheDocument();
  });

  it('shows skeleton placeholder while image is loading', () => {
    const { container } = render(
      <OptimizedImage src={EXTERNAL_URL} alt="Loading" priority />,
    );

    // Skeleton is present before load (uses role="status")
    const skeleton = container.querySelector('[role="status"]');
    expect(skeleton).toBeInTheDocument();

    // After load, skeleton should be gone
    const img = container.querySelector('img')!;
    fireEvent.load(img);

    const skeletonAfter = container.querySelector('[role="status"]');
    expect(skeletonAfter).toBeNull();
  });

  it('applies priority attributes correctly', () => {
    const { container } = render(
      <OptimizedImage src={EXTERNAL_URL} alt="Priority" priority />,
    );

    const img = container.querySelector('img')!;
    expect(img.getAttribute('loading')).toBe('eager');
    expect(img.getAttribute('fetchpriority')).toBe('high');
  });

  it('applies lazy loading attributes by default (when in view)', () => {
    // Use priority to force render, then check a non-priority render
    const { container } = render(
      <OptimizedImage src={EXTERNAL_URL} alt="Lazy" priority={false} />,
    );

    // With default IntersectionObserver mock (never triggers),
    // the img should not be rendered
    const img = container.querySelector('img');
    expect(img).toBeNull();
  });

  it('uses default sizes attribute based on width', () => {
    const { container } = render(
      <OptimizedImage
        src={SUPABASE_URL}
        alt="Sized"
        priority
        width={600}
      />,
    );

    const source = container.querySelector('source');
    expect(source?.getAttribute('sizes')).toBe(
      '(max-width: 600px) 100vw, 600px',
    );
  });

  it('uses custom sizes attribute when provided', () => {
    const customSizes = '(max-width: 768px) 100vw, 50vw';
    const { container } = render(
      <OptimizedImage
        src={SUPABASE_URL}
        alt="Custom"
        priority
        sizes={customSizes}
      />,
    );

    const source = container.querySelector('source');
    expect(source?.getAttribute('sizes')).toBe(customSizes);
  });

  it('applies object-fit class correctly', () => {
    const { container } = render(
      <OptimizedImage
        src={EXTERNAL_URL}
        alt="Contain"
        priority
        objectFit="contain"
      />,
    );

    const img = container.querySelector('img')!;
    expect(img.className).toContain('object-contain');
  });

  it('applies aspect ratio class to container', () => {
    const { container } = render(
      <OptimizedImage
        src={EXTERNAL_URL}
        alt="Square"
        priority
        aspectRatio="aspect-square"
      />,
    );

    const wrapper = container.firstElementChild;
    expect(wrapper?.className).toContain('aspect-square');
  });

  it('clamps quality to minimum 10 for 3x density', () => {
    const { container } = render(
      <OptimizedImage
        src={SUPABASE_URL}
        alt="Low quality"
        priority
        quality={15}
      />,
    );

    const avifSource = container.querySelector('source[type="image/avif"]');
    const srcSet = avifSource?.getAttribute('srcSet') ?? '';
    // 3x quality = 15 - 10 = 5, clamped to 10
    expect(srcSet).toContain('quality=10');
  });

  it('does not include format param for origin fallback img src', () => {
    const { container } = render(
      <OptimizedImage src={SUPABASE_URL} alt="Fallback" priority />,
    );

    const img = container.querySelector('img');
    const src = img?.getAttribute('src') ?? '';
    expect(src).not.toContain('format=');
  });
});
