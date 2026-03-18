# Mobile Navigation Guide

## Overview
This document outlines the mobile navigation system implemented across all panels (Admin, Customer, Super Admin).

## Architecture

### Components
- **`MobileBottomNav`** - Admin panel mobile navigation
- **`CustomerMobileBottomNav`** - Customer portal navigation
- **`SuperAdminMobileBottomNav`** - Super admin navigation

### Shared Utilities
- **`src/lib/utils/mobile.ts`** - Mobile utility functions
- **`src/hooks/useMobileNavigation.ts`** - Navigation state management
- **`src/hooks/useKeyboardNav.ts`** - Keyboard navigation support
- **`src/hooks/useOnlineStatus.ts`** - Network status detection

## Design Specifications

### Touch Targets
- **Minimum size**: 48x48px (iOS/Android guidelines)
- **Active state**: `active:scale-95` for visual feedback
- **Touch class**: `touch-manipulation` for optimal performance

### Layout
- **Grid system**: CSS Grid with equal columns (5-6 columns)
- **Height**: `min-h-[64px]` base + safe area padding
- **No horizontal scroll**: Fixed grid prevents squishing

### Safe Areas
```css
.safe-area-bottom {
  padding-bottom: max(0.5rem, env(safe-area-inset-bottom));
}

.safe-area-top {
  padding-top: max(0.5rem, env(safe-area-inset-top));
}
```

### Colors & Theming
All colors use semantic tokens from `index.css`:
- Admin: `--primary`, `--muted-foreground`, `--background`
- Customer: `--customer-primary`, `--customer-text`
- Super Admin: `--super-admin-primary`, `--super-admin-surface`

## Features

### 1. Haptic Feedback
```typescript
import { triggerHaptic } from '@/lib/utils/mobile';

// Light tap for navigation
triggerHaptic('light');

// Medium tap for actions
triggerHaptic('medium');

// Heavy tap for important events
triggerHaptic('heavy');
```

### 2. Loading States
Navigation shows a shimmer animation at the top during route changes:
```tsx
{isNavigating && (
  <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary/30">
    <div className="h-full bg-primary animate-[shimmer_1s_ease-in-out_infinite]" />
  </div>
)}
```

### 3. Accessibility
Every navigation item includes:
- `aria-label` - Descriptive label
- `aria-current="page"` - Active state indicator
- `aria-expanded` - Sheet/modal state (More button)
- `aria-hidden="true"` - Icons hidden from screen readers
- `role="navigation"` - Semantic navigation landmark

### 4. Keyboard Navigation
Arrow keys work for navigation when no input is focused:
- **Arrow Left/Right**: Navigate between items
- **Enter/Space**: Activate current item

## Usage Examples

### Basic Navigation Item
```tsx
<Link
  to={path}
  onClick={() => triggerHaptic('light')}
  className="flex flex-col items-center min-h-[48px] w-full touch-manipulation active:scale-95"
  aria-label={`Navigate to ${title}`}
  aria-current={isActive ? 'page' : undefined}
>
  <Icon className="h-5 w-5" aria-hidden="true" />
  <span className="text-xs">{title}</span>
</Link>
```

### With Badge (Cart Count)
```tsx
<div className="relative">
  <Icon className="h-5 w-5" />
  {count > 0 && (
    <Badge 
      className="absolute -top-2 -right-2"
      aria-label={`${count} items`}
    >
      {count}
    </Badge>
  )}
</div>
```

### More Menu (Sheet)
```tsx
<Sheet open={open} onOpenChange={setOpen}>
  <SheetTrigger asChild>
    <button
      onClick={() => triggerHaptic('medium')}
      aria-label="Open navigation menu"
      aria-expanded={open}
    >
      <Menu className="h-5 w-5" />
      <span>More</span>
    </button>
  </SheetTrigger>
  <SheetContent side="left">
    <AdaptiveSidebar />
  </SheetContent>
</Sheet>
```

## Performance Optimizations

### 1. CSS Grid vs Flexbox
Grid layout prevents reflows and ensures equal column widths without JavaScript.

### 2. Touch Manipulation
The `touch-manipulation` CSS property disables double-tap zoom for better responsiveness.

### 3. GPU Acceleration
Transform animations use `active:scale-95` for hardware-accelerated transforms.

### 4. Lazy Loading
Navigation loading state prevents jarring transitions during route changes.

## Testing Checklist

### iOS Safari
- [ ] Safe area insets work (notch, home indicator)
- [ ] Touch targets are 48x48px minimum
- [ ] Haptic feedback triggers (if supported)
- [ ] No horizontal scrolling
- [ ] Bottom nav doesn't overlap content

### Android Chrome
- [ ] Safe area behavior
- [ ] Touch feedback
- [ ] Navigation bar handling
- [ ] Gesture navigation compatibility

### Small Screens (≤375px)
- [ ] All nav items visible
- [ ] No text truncation issues
- [ ] No overlap
- [ ] Proper spacing maintained

### Tablets (768px-1024px)
- [ ] Nav hides on lg breakpoint
- [ ] Desktop nav shows properly

### Accessibility
- [ ] Keyboard navigation works
- [ ] Screen reader announces correctly
- [ ] Focus indicators visible
- [ ] Color contrast meets WCAG AA

### Performance
- [ ] Navigation completes in <100ms
- [ ] No janky animations
- [ ] 60 FPS scrolling
- [ ] No layout shifts

## Common Issues & Solutions

### Issue: Bottom nav squished/overlapping
**Solution**: Ensure grid layout with equal columns, not flex with min-width.

### Issue: Safe area not working
**Solution**: Use `safe-area-bottom` class, ensure `@supports (padding: max(0px))` in CSS.

### Issue: Touch targets too small
**Solution**: Use `min-h-[48px] min-w-[48px]` or import `TOUCH_TARGET_SIZE` constant.

### Issue: Icons not accessible
**Solution**: Add `aria-hidden="true"` to icons, `aria-label` to buttons/links.

### Issue: No haptic feedback
**Solution**: Check `triggerHaptic()` is called, note it only works on supported devices.

## Browser Support

| Feature | iOS Safari | Android Chrome | Notes |
|---------|-----------|----------------|-------|
| Safe Areas | ✅ | ✅ | via `env(safe-area-inset-*)` |
| Haptics | ✅ | ⚠️ | Vibration API limited on Android |
| Grid Layout | ✅ | ✅ | Full support |
| Touch Manipulation | ✅ | ✅ | Full support |
| Backdrop Blur | ✅ | ✅ | Full support |

## Resources

- [iOS Human Interface Guidelines - Touch Targets](https://developer.apple.com/design/human-interface-guidelines/inputs/touch)
- [Material Design - Touch Targets](https://m3.material.io/foundations/accessible-design/accessibility-basics#28032e45-c598-450c-b355-f9fe737b1cd8)
- [WCAG 2.1 - Target Size](https://www.w3.org/WAI/WCAG21/Understanding/target-size.html)
- [MDN - env()](https://developer.mozilla.org/en-US/docs/Web/CSS/env)
- [MDN - Vibration API](https://developer.mozilla.org/en-US/docs/Web/API/Vibration_API)
