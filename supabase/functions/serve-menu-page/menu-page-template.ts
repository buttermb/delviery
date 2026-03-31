/**
 * Full menu page HTML template with product cards, theming, and responsive layout.
 */

import { escapeHtml, formatPrice, isColorDark } from './utils.ts';
import type { ColorConfig, ProductData } from './utils.ts';

interface BuildProductCardOptions {
  product: ProductData;
  showImage: boolean;
  showPrice: boolean;
  showDescription: boolean;
  colors: ColorConfig;
}

function buildProductCard({ product, showImage, showPrice, showDescription, colors }: BuildProductCardOptions): string {
  const imageHtml = showImage && product.image_url
    ? `<img src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.name)}" class="product-img" loading="lazy" />`
    : '';

  const categoryBadge = product.category
    ? `<span class="category-badge">${escapeHtml(product.category)}</span>`
    : '';

  const descHtml = showDescription && product.description
    ? `<p class="product-desc">${escapeHtml(product.description)}</p>`
    : '';

  const priceHtml = showPrice && product.price > 0
    ? `<span class="product-price">${formatPrice(product.price)}</span>`
    : '';

  return `
    <div class="product-card" style="background:${colors.cardBg};border-color:${colors.border}">
      ${imageHtml}
      <div class="product-info">
        <div class="product-header">
          <h3 class="product-name">${escapeHtml(product.name)}</h3>
          ${priceHtml}
        </div>
        ${categoryBadge}
        ${descHtml}
      </div>
    </div>`;
}

export interface BuildMenuPageOptions {
  title: string;
  description: string;
  customMessage: string;
  products: ProductData[];
  showImages: boolean;
  showPrices: boolean;
  showDescriptions: boolean;
  contactInfo: string;
  colors: ColorConfig;
}

export function buildMenuPage(opts: BuildMenuPageOptions): string {
  const { title, description, customMessage, products, showImages, showPrices, showDescriptions, contactInfo, colors } = opts;

  const productCards = products.map((p) => buildProductCard({
    product: p,
    showImage: showImages,
    showPrice: showPrices,
    showDescription: showDescriptions,
    colors,
  })).join('\n');

  const descHtml = description
    ? `<p class="menu-desc">${escapeHtml(description)}</p>`
    : '';

  const messageHtml = customMessage
    ? `<div class="custom-message">${escapeHtml(customMessage)}</div>`
    : '';

  const contactHtml = contactInfo
    ? `<div class="contact-info">${escapeHtml(contactInfo)}</div>`
    : '';

  const countText = products.length === 1 ? '1 item' : `${products.length} items`;

  // Determine if dark theme for lighter muted colors
  const isDark = isColorDark(colors.bg);
  const mutedText = isDark ? '#94a3b8' : '#6b7280';
  const headerBorder = isDark ? '#334155' : '#e5e7eb';
  const badgeBg = isDark ? '#334155' : '#f3f4f6';
  const badgeText = isDark ? '#94a3b8' : '#6b7280';
  const messageBg = isDark ? '#1e3a5f' : '#eff6ff';
  const messageText = isDark ? '#93c5fd' : '#1e40af';
  const messageBorder = isDark ? '#3b82f6' : '#3b82f6';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: ${colors.bg}; color: ${colors.text}; line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }
    .container { max-width: 800px; margin: 0 auto; padding: 24px 16px 48px; }
    .header { text-align: center; padding: 32px 0 24px; border-bottom: 1px solid ${headerBorder}; margin-bottom: 24px; }
    .header h1 { font-size: 28px; font-weight: 700; letter-spacing: -0.02em; color: ${colors.text}; }
    .menu-desc { margin-top: 8px; color: ${mutedText}; font-size: 15px; }
    .item-count { margin-top: 12px; font-size: 13px; color: ${mutedText}; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 500; }
    .custom-message { background: ${messageBg}; border-left: 3px solid ${messageBorder}; padding: 12px 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0; font-size: 14px; color: ${messageText}; }
    .products-grid { display: flex; flex-direction: column; gap: 12px; }
    .product-card { background: ${colors.cardBg}; border: 1px solid ${colors.border}; border-radius: 12px; overflow: hidden; display: flex; flex-direction: row; transition: box-shadow 0.15s; }
    .product-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .product-img { width: 100px; height: 100px; object-fit: cover; flex-shrink: 0; background: ${badgeBg}; }
    .product-info { padding: 14px 16px; flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
    .product-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
    .product-name { font-size: 16px; font-weight: 600; color: ${colors.text}; line-height: 1.3; }
    .product-price { font-size: 16px; font-weight: 700; color: ${colors.accent}; white-space: nowrap; flex-shrink: 0; }
    .category-badge { display: inline-block; background: ${badgeBg}; color: ${badgeText}; font-size: 11px; font-weight: 500; padding: 2px 8px; border-radius: 99px; text-transform: uppercase; letter-spacing: 0.04em; width: fit-content; }
    .product-desc { font-size: 13px; color: ${mutedText}; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .contact-info { text-align: center; padding: 16px; margin-top: 24px; font-size: 14px; font-weight: 500; color: ${colors.text}; border: 1px solid ${colors.border}; border-radius: 12px; background: ${colors.cardBg}; }
    .footer { text-align: center; padding: 32px 0 16px; border-top: 1px solid ${headerBorder}; margin-top: 32px; color: ${mutedText}; font-size: 12px; }
    @media (max-width: 480px) {
      .container { padding: 16px 12px 32px; }
      .header { padding: 24px 0 16px; }
      .header h1 { font-size: 22px; }
      .product-img { width: 80px; height: 80px; }
      .product-name { font-size: 14px; }
      .product-price { font-size: 14px; }
      .product-info { padding: 10px 12px; }
    }
    @media print {
      body { background: #fff; }
      .product-card { break-inside: avoid; border: 1px solid #ddd; }
      .product-card:hover { box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${escapeHtml(title)}</h1>
      ${descHtml}
      <div class="item-count">${countText}</div>
    </div>
    ${messageHtml}
    <div class="products-grid">
      ${productCards}
    </div>
    ${contactHtml}
    <div class="footer">
      Generated by FloraIQ &middot; ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
    </div>
  </div>
</body>
</html>`;
}
