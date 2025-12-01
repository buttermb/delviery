# 📱 Mobile Testing Guide - Complete Checklist

## ✅ Pre-Testing Verification

Before testing, verify these are in place:

- [x] All touch targets are 48px minimum
- [x] All inputs use 16px text (text-base)
- [x] More menu loads sidebar properly
- [x] Tables have mobile card views
- [x] Images have lazy loading
- [x] Loading skeletons are in place
- [x] Offline indicator is working
- [x] PWA install prompt is working

## 🧪 Phase 7: Complete Testing Checklist

### Device Testing

#### iPhone Testing
- [ ] **iPhone SE** (320px width)
  - [ ] Dashboard loads correctly
  - [ ] Bottom nav is visible and usable
  - [ ] "More" menu opens and shows navigation
  - [ ] Can scroll on all pages
  - [ ] Buttons are easy to tap
  - [ ] Forms don't zoom on input focus
  - [ ] Tables show as cards

- [ ] **iPhone 13/14** (390px width)
  - [ ] All features work as expected
  - [ ] Safe areas handled (notch)
  - [ ] Bottom nav doesn't cover content
  - [ ] Headers stay visible on scroll

- [ ] **iPhone 14 Pro Max** (428px width)
  - [ ] Layout scales properly
  - [ ] No horizontal scrolling
  - [ ] All content readable

#### Android Testing
- [ ] **Small Android** (360px width)
  - [ ] All features work
  - [ ] Navigation accessible
  - [ ] Forms usable

- [ ] **Standard Android** (412px width)
  - [ ] Full feature set works
  - [ ] Performance is smooth

### Feature Testing

#### Navigation
- [ ] **Bottom Nav**
  - [ ] All 5 items visible and equal width
  - [ ] Active item highlighted
  - [ ] Tap navigates correctly
  - [ ] Haptic feedback works (if available)

- [ ] **More Menu**
  - [ ] Opens when tapped
  - [ ] Shows "Navigation" header
  - [ ] Displays all menu items
  - [ ] Can scroll through items
  - [ ] Tap item navigates and closes sheet
  - [ ] Close button works

#### Scrolling
- [ ] **Dashboard**
  - [ ] Can scroll smoothly
  - [ ] Header stays sticky
  - [ ] Bottom nav always visible
  - [ ] No content hidden

- [ ] **Data Pages**
  - [ ] WholesaleClients - scrolls smoothly
  - [ ] Couriers - scrolls smoothly
  - [ ] Orders - scrolls smoothly
  - [ ] Products - scrolls smoothly
  - [ ] Customers - scrolls smoothly

#### Touch Targets
- [ ] **All Buttons**
  - [ ] Easy to tap (48px minimum)
  - [ ] No missed taps
  - [ ] Active states visible
  - [ ] Proper spacing between buttons

- [ ] **Action Buttons**
  - [ ] View buttons work
  - [ ] Edit buttons work
  - [ ] Delete buttons work
  - [ ] Submit buttons work

#### Forms
- [ ] **Input Fields**
  - [ ] Don't zoom on focus (iOS)
  - [ ] Proper keyboard shows (email, tel, numeric)
  - [ ] Easy to tap and focus
  - [ ] Can type comfortably
  - [ ] Validation messages visible

- [ ] **Select Dropdowns**
  - [ ] Easy to open
  - [ ] Options readable
  - [ ] Can select options
  - [ ] No zoom on focus

#### Data Views
- [ ] **Mobile Cards**
  - [ ] WholesaleClients shows cards
  - [ ] Couriers shows cards
  - [ ] Orders shows cards
  - [ ] Cards are tappable
  - [ ] All info visible
  - [ ] Action buttons work

- [ ] **Loading States**
  - [ ] Skeletons show while loading
  - [ ] Smooth transitions
  - [ ] No blank screens

#### Performance
- [ ] **Page Load**
  - [ ] Dashboard loads < 3 seconds
  - [ ] Data pages load < 3 seconds
  - [ ] Images load progressively
  - [ ] No layout shifts

- [ ] **Scrolling**
  - [ ] Smooth 60fps scrolling
  - [ ] No jank or stuttering
  - [ ] Pull-to-refresh works (if implemented)

- [ ] **Network**
  - [ ] Offline indicator shows when offline
  - [ ] "Back online" message shows
  - [ ] Data syncs when back online

### Page-by-Page Testing

#### Dashboard
- [ ] Loads correctly
- [ ] Stats cards visible
- [ ] Charts render (if any)
- [ ] Quick actions work
- [ ] Can scroll
- [ ] Bottom nav visible

#### WholesaleClients
- [ ] Desktop: Table view works
- [ ] Mobile: Card view shows
- [ ] Search works
- [ ] Filters work
- [ ] Can tap card to view details
- [ ] Action buttons work (Message, Call, Collect, Order)
- [ ] Loading skeletons show

#### Couriers
- [ ] Desktop: Table view works
- [ ] Mobile: Card view shows
- [ ] Search works
- [ ] Can view courier details
- [ ] Status badges visible
- [ ] Action buttons work

#### Orders
- [ ] Desktop: Table view works
- [ ] Mobile: Card view shows
- [ ] Search works
- [ ] Status filter works
- [ ] Can view order details
- [ ] Stats cards visible
- [ ] Loading skeletons show

#### Products
- [ ] Grid view works on mobile
- [ ] Can view product details
- [ ] Search works
- [ ] Filters work
- [ ] Images load lazily
- [ ] Can add/edit products

#### Customers
- [ ] Desktop: Table view works
- [ ] Mobile: Card view shows (if implemented)
- [ ] Search works
- [ ] Can view customer details
- [ ] Can add new customer

#### Forms (All)
- [ ] New Order form
- [ ] New Customer form
- [ ] New Product form
- [ ] Settings forms
- [ ] All inputs 48px height
- [ ] No zoom on focus
- [ ] Submit buttons work
- [ ] Validation works

### Browser Testing

#### Safari (iOS)
- [ ] All features work
- [ ] No console errors
- [ ] Performance is good
- [ ] Safe areas handled

#### Chrome (Android)
- [ ] All features work
- [ ] No console errors
- [ ] Performance is good
- [ ] Navigation bar handled

#### Chrome Desktop (Mobile View)
- [ ] Responsive design works
- [ ] All breakpoints work
- [ ] Touch simulation works

### Performance Testing

#### Lighthouse Audit
Run Lighthouse on mobile for each major page:

- [ ] **Dashboard**
  - [ ] Performance: 90+
  - [ ] Accessibility: 95+
  - [ ] Best Practices: 90+
  - [ ] SEO: 90+

- [ ] **WholesaleClients**
  - [ ] Performance: 90+
  - [ ] Accessibility: 95+

- [ ] **Orders**
  - [ ] Performance: 90+
  - [ ] Accessibility: 95+

#### Network Testing
- [ ] **Slow 3G**
  - [ ] Pages still load
  - [ ] Loading states show
  - [ ] No broken UI

- [ ] **Offline**
  - [ ] Offline indicator shows
  - [ ] Cached content works
  - [ ] Error messages clear

### Accessibility Testing

- [ ] **Screen Reader**
  - [ ] All buttons have labels
  - [ ] Navigation is clear
  - [ ] Forms are accessible
  - [ ] Status messages announced

- [ ] **Keyboard Navigation**
  - [ ] Can navigate with keyboard
  - [ ] Focus indicators visible
  - [ ] Tab order logical

- [ ] **Color Contrast**
  - [ ] Text readable
  - [ ] Buttons visible
  - [ ] Status indicators clear

### Edge Cases

- [ ] **Very Long Content**
  - [ ] Text truncates properly
  - [ ] Cards don't break layout
  - [ ] Scroll works

- [ ] **Empty States**
  - [ ] Clear messages
  - [ ] Action buttons visible
  - [ ] Helpful guidance

- [ ] **Error States**
  - [ ] Error messages clear
  - [ ] Retry buttons work
  - [ ] No broken UI

- [ ] **Orientation Change**
  - [ ] Landscape works
  - [ ] Portrait works
  - [ ] Layout adapts

## 📊 Success Criteria

Your mobile optimization is successful when:

✅ **All touch targets are 48px minimum**  
✅ **No zoom on input focus (iOS)**  
✅ **More menu loads navigation**  
✅ **Tables show as cards on mobile**  
✅ **Smooth scrolling everywhere**  
✅ **Lighthouse score 90+**  
✅ **Works on iPhone SE (smallest)**  
✅ **Works on Android devices**  
✅ **No console errors**  
✅ **Professional, polished feel**  

## 🐛 Common Issues & Fixes

### Issue: More menu still blank
**Check:**
- Console for errors
- TenantSlug is present
- AdaptiveSidebar is rendering

### Issue: Can't scroll
**Check:**
- No `overflow-hidden` on parents
- Main has `overflow-y-auto`
- No `position: fixed` on body

### Issue: Buttons too small
**Check:**
- All buttons have `min-h-[48px]`
- No `h-8` or `w-8` classes
- Padding allows proper size

### Issue: Input zooms on focus
**Check:**
- Inputs use `text-base` (16px)
- No `text-sm` or `text-xs` on inputs
- Font size is 16px minimum

### Issue: Tables not showing as cards
**Check:**
- Mobile card view exists
- Uses `md:hidden` class
- Desktop table uses `hidden md:block`

## 📝 Testing Notes Template

```
Date: ___________
Device: ___________
Browser: ___________
OS Version: ___________

Issues Found:
1. 
2. 
3. 

Performance:
- Page Load: _____ seconds
- Lighthouse Score: _____
- Console Errors: _____

Overall Rating: _____ / 10
```

## ✅ Final Sign-Off

After completing all tests:

- [ ] All critical features work
- [ ] Performance meets targets
- [ ] No blocking bugs
- [ ] User experience is smooth
- [ ] Ready for production

**Tester:** _________________  
**Date:** _________________  
**Approved:** _________________

---

**Remember:** Test on real devices for the most accurate results. Browser DevTools mobile view is good for quick checks, but real device testing is essential.

