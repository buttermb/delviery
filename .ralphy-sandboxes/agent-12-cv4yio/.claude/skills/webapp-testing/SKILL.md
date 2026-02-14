---
name: webapp-testing
description: Toolkit for testing web applications using browser automation. Supports verifying frontend functionality, debugging UI behavior, capturing screenshots.
---

# Web Application Testing

Test web applications using browser automation with Playwright patterns.

## Decision Tree: Choosing Your Approach

```
User task → Is it static HTML?
    ├─ Yes → Read HTML file directly to identify selectors
    │         └── Write browser test using selectors
    │
    └─ No (dynamic webapp) → Is the server already running?
        ├─ No → Start dev server first: npm run dev
        │
        └─ Yes → Reconnaissance-then-action:
            1. Navigate and wait for networkidle
            2. Take screenshot or inspect DOM
            3. Identify selectors from rendered state
            4. Execute actions with discovered selectors
```

## Browser Testing Pattern

```typescript
// Using browser subagent for testing
await page.goto('http://localhost:5173');
await page.waitForLoadState('networkidle'); // CRITICAL: Wait for JS

// Inspect to find selectors
await page.screenshot({ path: 'inspect.png', fullPage: true });

// Then interact
await page.click('button:has-text("Add to Cart")');
await page.fill('input[name="quantity"]', '2');
```

## Reconnaissance-Then-Action Pattern

1. **Inspect rendered DOM**:
   ```typescript
   page.screenshot({ path: '/tmp/inspect.png', fullPage: true });
   const content = await page.content();
   const buttons = await page.locator('button').all();
   ```

2. **Identify selectors** from inspection results

3. **Execute actions** using discovered selectors

## Common Pitfall

❌ **Don't** inspect the DOM before waiting for `networkidle` on dynamic apps
✅ **Do** wait for `page.waitForLoadState('networkidle')` before inspection

## Best Practices

- Always wait for `networkidle` before inspecting dynamic content
- Use descriptive selectors: `text=`, `role=`, CSS selectors, or IDs
- Add appropriate waits: `waitForSelector()` or `waitForTimeout()`
- Take screenshots to debug issues
- Check console logs for errors

## FloraIQ Specific Testing

### Storefront Testing
```typescript
// Navigate to tenant storefront
await page.goto(`http://localhost:5173/${tenantSlug}/shop`);
await page.waitForLoadState('networkidle');

// Verify products loaded
await expect(page.locator('[data-testid="product-card"]')).toBeVisible();

// Test add to cart
await page.click('button:has-text("Add to Cart")');
await expect(page.locator('[data-testid="cart-count"]')).toHaveText('1');
```

### Admin Panel Testing
```typescript
// Login first
await page.goto(`http://localhost:5173/${tenantSlug}/admin`);
await page.fill('input[name="email"]', testEmail);
await page.fill('input[name="password"]', testPassword);
await page.click('button:has-text("Sign In")');

// Wait for dashboard
await page.waitForURL(`**/${tenantSlug}/admin/dashboard`);
await expect(page.locator('h1')).toContainText('Dashboard');
```
