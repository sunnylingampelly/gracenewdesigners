# Mobile-First Native App Features

This document describes the mobile-first native app feel implementations in the Grace New Designers storefront.

## Overview

The storefront now includes comprehensive mobile optimizations that provide a native app experience on mobile devices while maintaining desktop functionality.

## Key Features

### 1. Bottom Navigation Bar

**Location:** `src/components/store/mobile-bottom-nav.tsx`

A fixed bottom navigation bar following iOS/Android design patterns with:
- 5 primary actions: Home, Shop, Search, Wishlist, Bag
- Active state indicators with visual feedback
- Badge counts for wishlist and bag items
- Touch-optimized tap targets (44x44px minimum)
- Backdrop blur effect for translucency
- Safe area inset support for notched devices (iPhone X+)
- Haptic feedback on interactions

**Integration:** Automatically visible on screens < 1024px (lg breakpoint)

### 2. Haptic Feedback

**Location:** `src/lib/haptics.ts`

Provides tactile feedback on user interactions:
- **Light**: Quick tap feedback for buttons
- **Medium**: Moderate feedback for toggles
- **Heavy**: Strong feedback for important actions
- **Selection**: Subtle feedback for navigation
- **Success/Warning/Error**: Pattern-based feedback for notifications

**Usage:**
```tsx
import { useHaptics } from '@/lib/haptics';

const { selection, success } = useHaptics();

// In event handler
onClick={() => {
  selection(); // Trigger haptic
  navigate('/page');
}}
```

### 3. Mobile UI Enhancements

**Location:** `src/app/globals.css`

CSS utilities and patterns for native app feel:
- Tap highlight removal (`-webkit-tap-highlight-color: transparent`)
- Momentum scrolling (`-webkit-overflow-scrolling: touch`)
- Safe area insets for notched devices
- Touch-friendly tap targets (44x44px minimum)
- Smooth scroll snap for carousels
- iOS-style rubber band containment
- Native-like active states and transitions
- Bottom sheet animations
- Ripple effects for touch feedback

### 4. Scroll Containers

**Location:** `src/components/store/mobile-scroll-container.tsx`

Optimized horizontal scrolling with:
- Smooth momentum scrolling
- Optional scroll snap behavior
- Scroll position indicators (fade gradients)
- Touch-friendly drag interactions
- Overscroll containment

**Usage:**
```tsx
<MobileScrollContainer enableSnap showScrollIndicator>
  <div className="flex gap-4">
    <MobileScrollCard>Item 1</MobileScrollCard>
    <MobileScrollCard>Item 2</MobileScrollCard>
  </div>
</MobileScrollContainer>
```

### 5. Pull-to-Refresh

**Location:** `src/components/store/pull-to-refresh.tsx`

Native pull-to-refresh pattern:
- Activated when pulling down from top of page
- Visual indicator with rotation animation
- Resistance curve for natural feel
- Customizable threshold (default: 80px)
- Only on touch devices

**Usage:**
```tsx
<PullToRefresh onRefresh={async () => {
  await refetchData();
}}>
  {children}
</PullToRefresh>
```

### 6. Mobile Toast Notifications

**Location:** `src/components/store/mobile-toast.tsx`

Bottom-positioned toast notifications:
- Positioned above bottom nav (not blocking)
- Success, error, warning, info variants
- Auto-dismiss with customizable duration
- Swipe-to-dismiss support
- Icon-based visual feedback

**Usage:**
```tsx
const { toast, ToastContainer } = useMobileToast();

// Show notification
toast.success('Item added to bag');
toast.error('Something went wrong');

// Render container
<ToastContainer />
```

### 7. Page Transitions

**Location:** `src/components/store/page-transition.tsx`

Smooth transitions between routes:
- **PageTransition**: Fade between routes
- **SlideUpTransition**: Bottom sheet style
- **FadeTransition**: Overlay animations
- **ScaleInTransition**: Item entrance animations

### 8. Swipe Gestures

**Location:** `src/lib/use-swipe.ts`

Detect swipe gestures for native interactions:
- Left, right, up, down detection
- Velocity-based thresholds
- Configurable sensitivity
- Element-specific or document-wide

**Usage:**
```tsx
useSwipe({
  onSwipeLeft: () => nextImage(),
  onSwipeRight: () => prevImage(),
});
```

### 9. Skeleton Loaders

**Location:** `src/components/store/skeleton-loaders.tsx`

Loading states for perceived performance:
- Product cards
- Product grids
- Product details
- Forms
- Navigation
- Collections

**Usage:**
```tsx
{isLoading ? <ProductGridSkeleton count={6} /> : <ProductGrid products={products} />}
```

### 10. Splash Screen

**Location:** `src/components/store/splash-screen.tsx`

Initial app load screen:
- Shows while app hydrates
- Smooth fade transition
- Loading progress indicator
- Brand presentation
- Mobile-only (hidden on desktop)

## Mobile Optimizations

### Header Adjustments
- Reduced height on mobile (56px vs 64px desktop)
- Search, wishlist, and bag icons hidden on mobile (bottom nav handles these)
- Touch-optimized menu button
- Smaller logo size for mobile

### Mobile Navigation
- Wishlist and Bag removed from sidebar (in bottom nav)
- Safe area inset padding
- Touch-active feedback on all interactive elements
- Improved spacing for thumb reach

### Layout Adjustments
- Main content has bottom padding (80px) to prevent overlap with bottom nav
- Removed on desktop (lg breakpoint)
- Safe area inset support throughout

## CSS Utility Classes

### Touch Interactions
- `.touch-target` - Ensures 44x44px minimum tap target
- `.touch-active` - Smooth press animation
- `.no-select` - Prevents text selection
- `.card-press` - Card press feedback

### Transitions
- `.animate-slide-up-mobile` - Bottom sheet entrance
- `.animate-slide-down-mobile` - Bottom sheet exit
- `.animate-fade-in` - Fade entrance
- `.animate-spin-smooth` - Smooth rotation

### Scroll Behavior
- `.scroll-snap-x` - Horizontal scroll snap
- `.scroll-snap-start` - Snap alignment
- `.overscroll-contain` - Prevent overscroll
- `.scrollbar-none` - Hide scrollbar

### Elevation
- `.elevation-1` through `.elevation-4` - Material Design shadows
- `.fab-shadow` - Floating action button shadow
- `.sticky-blur` - Sticky header with blur

### Backgrounds
- `.ios-blur` - iOS-style translucent background
- `.backdrop-blur-mobile` - Enhanced backdrop blur

## Safe Area Insets

Support for notched devices (iPhone X+, Android with notches):

```css
.safe-area-inset-bottom {
  padding-bottom: env(safe-area-inset-bottom, 0);
}

.safe-area-inset-top {
  padding-top: env(safe-area-inset-top, 0);
}
```

Applied to:
- Bottom navigation
- Mobile sidebar
- Full-screen overlays

## Performance Considerations

1. **Reduced Motion**: All animations respect `prefers-reduced-motion`
2. **Passive Event Listeners**: Touch events use passive listeners where possible
3. **Debounced Scroll**: Scroll handlers are optimized
4. **Lazy Loading**: Components load on-demand
5. **Optimistic Updates**: UI updates before API confirmation

## Browser Support

- iOS Safari 12+
- Chrome Mobile 80+
- Samsung Internet 10+
- Firefox Mobile 68+

## Testing Checklist

- [ ] Bottom nav visible on mobile, hidden on desktop
- [ ] Haptic feedback works on Android devices
- [ ] Pull-to-refresh activates at top of page
- [ ] Safe area insets respected on notched devices
- [ ] Touch targets meet 44x44px minimum
- [ ] Swipe gestures work smoothly
- [ ] Toast notifications don't block bottom nav
- [ ] Transitions are smooth (60fps)
- [ ] No content hidden behind bottom nav
- [ ] Search works from both header and bottom nav
- [ ] Wishlist and bag counts update in real-time

## Future Enhancements

- [ ] Add to Home Screen prompt
- [ ] Offline support with service worker
- [ ] Background sync for wishlist/bag
- [ ] Push notifications
- [ ] Biometric authentication
- [ ] App shortcuts
- [ ] Share target API integration
