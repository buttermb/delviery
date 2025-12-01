
# Disposable Menus API Reference

## Overview
This API allows you to manage disposable menus, track analytics, and handle security events.

## Authentication
All API requests require the following headers:
- `apikey`: Your Supabase anon or service_role key.
- `Authorization`: Bearer token (if using RLS).

## Endpoints

### 1. Access Encrypted Menu
Retrieves the decrypted menu data if all security checks pass.

- **URL**: `/functions/v1/access-encrypted-menu-v2`
- **Method**: `POST`
- **Body**:
  ```json
  {
    "url_token": "string",
    "access_code": "string (optional)",
    "bypass_cache": "boolean (optional)"
  }
  ```
- **Response**:
  ```json
  {
    "menu": { ... },
    "products": [ ... ]
  }
  ```
- **Error Responses**:
  - `404`: Menu not found
  - `429`: Too many requests (Velocity limit)
  - `410`: Menu expired or burned
  - `401`: Access code required

### 2. Realtime Analytics
Subscribe to WebSocket events for live updates.

- **Channel**: `dashboard-updates`
- **Events**:
  - `postgres_changes` on `menu_access_logs`: Active user updates
  - `postgres_changes` on `menu_orders`: New orders
  - `postgres_changes` on `menu_security_events`: Security alerts

## Security Features

### Rate Limiting
- Default: 100 requests per minute per IP.
- Exceeding limits triggers a temporary block.

### Screenshot Protection
- Menus include invisible watermarks.
- Client-side scripts detect and report screenshot attempts.

## Error Handling
Standard HTTP status codes are used.
- `2xx`: Success
- `4xx`: Client Error (check your input)
- `5xx`: Server Error (retry later)
