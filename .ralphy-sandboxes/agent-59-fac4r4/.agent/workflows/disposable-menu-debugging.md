---
description: Debugging methodology for Disposable Menu system - tokens, access control, burn triggers, geofencing, WebSockets, RLS, performance
---

# Disposable Menu Debugging Guide

## 1. Token Generation & URL Encryption

### Common Bugs
- Non-unique tokens causing data leaks
- Token leakage in logs/browser history/Referer headers
- URL tampering to access other menus

### Debugging Steps

**Verify Token Uniqueness:**
```sql
SELECT token, COUNT(*) FROM disposable_menus GROUP BY token HAVING COUNT(*) > 1;
```

**Check Token Entropy:**
```javascript
const token = crypto.randomUUID();
console.log('Token entropy bits:', token.length * 4); // Should be 128+ bits
```

**Audit Token Exposure:**
```javascript
console.log('History state:', window.history.state);
console.log('Document.referrer:', document.referrer); // Should not contain token
```

**Test URL Tampering:**
```bash
curl https://yourapp.com/m/valid-token   # Should work
curl https://yourapp.com/m/valid-tokenX  # Should return 403
```

---

## 2. Access Control & Whitelisting

### Common Bugs
- Whitelist not enforced
- Case sensitivity issues (`user@example.com` vs `User@example.com`)
- Device fingerprinting bypass

### Debugging Steps

**Test Whitelist Enforcement:**
```javascript
const { data, error } = await supabase
  .from('disposable_menu_access')
  .select('*')
  .eq('menu_token', token)
  .eq('user_email', 'non-whitelisted@example.com');
console.log('Access attempt:', { data, error }); // data should be empty
```

**Correct RLS Policy:**
```sql
CREATE POLICY "Users can only access whitelisted menus" ON disposable_menu_access
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM whitelist WHERE menu_token = disposable_menu_access.menu_token
    )
  );
```

---

## 3. Screenshot Detection & Burn Triggers

### Common Bugs
- False positives on legitimate screenshots
- Burn not firing after detection
- Safari iOS incompatibility

### Debugging Steps

**Test Screenshot Detection:**
```javascript
window.dispatchEvent(new Event('usercapture'));
console.log('Burn triggered:', localStorage.getItem('menu_burned')); // Should be 'true'
```

**iOS Safari Fallback:**
```javascript
if (navigator.userAgent.includes('Safari')) {
  window.visualViewport.addEventListener('resize', () => {
    if (window.visualViewport.height < screen.height * 0.8) {
      console.log('Likely screenshot on Safari, burning...');
    }
  });
}
```

---

## 4. Geofencing & Location-Based Access

### Common Bugs
- Inaccurate GPS causing false denials
- VPN bypass of location checks
- Permission denial breaking menu access

### Debugging Steps

**Test Geofence Accuracy:**
```javascript
// Mock location
navigator.geolocation.getCurrentPosition = (success) => {
  success({ coords: { latitude: 40.7128, longitude: -74.0060, accuracy: 10 } });
};
```

**VPN Detection:**
```javascript
const isVPN = await fetch(`https://vpnapi.io/api/${ip}?key=YOUR_KEY`);
console.log('VPN check:', await isVPN.json());
```

---

## 5. Real-Time State & WebSocket Sync

### Common Bugs
- WebSocket disconnects
- Stale data after burn
- Race conditions

### Debugging Steps

**Test WebSocket:**
```javascript
const ws = new WebSocket('wss://yourapp.com/ws/menu/:token');
ws.onopen = () => console.log('WS connected');
ws.onmessage = (msg) => console.log('WS message:', msg.data);
ws.onclose = () => console.log('WS disconnected');
```

**Race Condition Fix:**
```sql
-- Use SELECT ... FOR UPDATE to lock row during access check
```

---

## 6. Database & RLS Policies

### Debugging Steps

**Audit RLS Policies:**
```sql
SELECT * FROM pg_policies WHERE tablename = 'disposable_menus';
```

**Query Performance:**
```sql
EXPLAIN ANALYZE SELECT * FROM disposable_menus WHERE token = 'abc' AND burned_at IS NULL;
```

**Add Index:**
```sql
CREATE INDEX idx_disposable_menus_token_burned ON disposable_menus(token, burned_at);
```

---

## 7. Performance & Edge Cases

### Debugging Steps

**Profile Cold Start:**
```bash
curl -w "TTFB: %{time_starttransfer}" -o /dev/null -s https://yourapp.com/m/:token
```

**Check Memory:**
```javascript
console.log('Memory:', performance.memory.usedJSHeapSize / 1024 / 1024, 'MB');
```

**Large Menu Fix:** Use virtual scrolling (react-window)

---

## 8. Security & Audit Logging

### Debugging Steps

**Verify Audit Log Insertion:**
```javascript
await supabase.from('audit_logs').insert({
  action: 'menu_access', token, user_id, ip
});
```

**Check Log Gaps:**
```sql
SELECT dm.token FROM disposable_menus dm
LEFT JOIN audit_logs al ON dm.token = al.token AND al.action = 'menu_access'
WHERE al.id IS NULL;
```

---

## 9. Pre-Deploy Testing Checklist

- [ ] Generate 1000 tokens, assert all unique
- [ ] Token generation < 10ms
- [ ] Whitelisted user can access
- [ ] Non-whitelisted user gets 403
- [ ] Banned device gets 403
- [ ] Screenshot triggers burn
- [ ] Burn broadcasts to all connected clients
- [ ] Geofence inside = 200, outside = 403
- [ ] RLS blocks cross-tenant access
- [ ] Audit logs created for all actions
