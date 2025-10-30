// Analytics tracking utility for signup popup and checkout events

interface AnalyticsEvent {
  event: string;
  properties?: Record<string, any>;
}

class Analytics {
  private enabled: boolean = true;

  track(event: string, properties?: Record<string, any>) {
    if (!this.enabled) return;

    const eventData: AnalyticsEvent = {
      event,
      properties: {
        ...properties,
        timestamp: new Date().toISOString(),
        url: window.location.href,
      }
    };

    // Log to console in development
    if (import.meta.env.DEV) {
      console.log('📊 Analytics:', eventData);
    }

    // Store in localStorage for demo purposes
    this.storeEvent(eventData);
  }

  private storeEvent(eventData: AnalyticsEvent) {
    try {
      const existingEvents = JSON.parse(localStorage.getItem('analytics_events') || '[]');
      existingEvents.push(eventData);
      
      // Keep only last 100 events
      if (existingEvents.length > 100) {
        existingEvents.shift();
      }
      
      localStorage.setItem('analytics_events', JSON.stringify(existingEvents));
    } catch (error) {
      console.error('Failed to store analytics event:', error);
    }
  }

  getEvents(): AnalyticsEvent[] {
    try {
      return JSON.parse(localStorage.getItem('analytics_events') || '[]');
    } catch {
      return [];
    }
  }

  clearEvents() {
    localStorage.removeItem('analytics_events');
  }

  // Popup-specific tracking
  trackPopupViewed(cartTotal: number, itemsInCart: number, discountAmount: number) {
    this.track('Signup Popup Viewed', {
      cart_total: cartTotal,
      items_in_cart: itemsInCart,
      discount_amount: discountAmount,
      potential_savings: discountAmount + 5.99 // Include shipping
    });
  }

  trackPopupSignup(email: string, cartTotal: number, savingsAmount: number) {
    this.track('Signup From Popup', {
      email_entered: !!email,
      cart_total: cartTotal,
      savings_amount: savingsAmount,
      conversion: true
    });
  }

  trackPopupGuestCheckout(cartTotal: number, savingsDeclined: number) {
    this.track('Guest Checkout Selected', {
      cart_total: cartTotal,
      savings_declined: savingsDeclined,
      conversion: false
    });
  }

  trackPopupDismissed(cartTotal: number, method: 'close_button' | 'backdrop_click' | 'esc_key') {
    this.track('Signup Popup Dismissed', {
      cart_total: cartTotal,
      dismiss_method: method,
      conversion: false
    });
  }

  trackCheckoutStarted(cartTotal: number, itemCount: number, isGuest: boolean) {
    this.track('Checkout Started', {
      cart_total: cartTotal,
      item_count: itemCount,
      is_guest: isGuest
    });
  }

  trackOrderCompleted(orderTotal: number, discountApplied: number, isGuest: boolean) {
    this.track('Order Completed', {
      order_total: orderTotal,
      discount_applied: discountApplied,
      is_guest: isGuest
    });
  }

  // User actions
  trackSignup(method: string) {
    this.track('signup', { method });
  }

  trackLogin(method: string) {
    this.track('login', { method });
  }

  // Product interactions
  trackProductView(productId: string, productName: string) {
    this.track('product_view', { product_id: productId, product_name: productName });
  }

  trackAddToCart(productId: string, productName: string, quantity: number) {
    this.track('add_to_cart', { 
      product_id: productId, 
      product_name: productName, 
      quantity 
    });
  }

  // Checkout flow
  trackBeginCheckout(cartValue: number, itemCount: number) {
    this.track('begin_checkout', { cart_value: cartValue, item_count: itemCount });
  }

  trackPurchase(orderId: string, totalAmount: number, itemCount: number) {
    this.track('purchase', { 
      order_id: orderId, 
      total_amount: totalAmount, 
      item_count: itemCount 
    });
  }

  // Giveaway
  trackGiveawayEntry(giveawayId: string, entryCount: number) {
    this.track('giveaway_entry', { 
      giveaway_id: giveawayId, 
      entry_count: entryCount 
    });
  }

  trackGiveawayShare(platform: string) {
    this.track('giveaway_share', { platform });
  }

  // Courier actions
  trackCourierOnline() {
    this.track('courier_online');
  }

  trackCourierOffline() {
    this.track('courier_offline');
  }

  trackOrderAccepted(orderId: string, totalAmount: number) {
    this.track('order_accepted', { order_id: orderId, total_amount: totalAmount });
  }

  trackDeliveryCompleted(orderId: string, earnedAmount: number) {
    this.track('delivery_completed', { 
      order_id: orderId, 
      earned_amount: earnedAmount 
    });
  }

  // Search
  trackSearch(query: string, resultCount: number) {
    this.track('search', { query, result_count: resultCount });
  }

  // Errors
  trackError(errorType: string, errorMessage: string) {
    this.track('error', { error_type: errorType, error_message: errorMessage });
  }
}

export const analytics = new Analytics();
