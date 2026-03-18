# Deployment Guide - Disposable Menus MVP 2.0

## Prerequisites

- [ ] Supabase project configured
- [ ] Redis instance available (Upstash, Railway, or self-hosted)
- [ ] Environment variables set
- [ ] Database migrations applied

## Environment Variables

Create `.env.production` with the following:

```bash
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Redis Cache
REDIS_HOST=redis.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
REDIS_TLS=true

# Communication APIs
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
SENDGRID_API_KEY=SG...

# AI/Security
OPENAI_API_KEY=sk-...

# Application
VITE_APP_URL=https://yourdomain.com
NODE_ENV=production
```

## Step 1: Database Setup

```bash
# Apply all migrations
npx supabase db push

# Verify migrations
npx supabase db diff

# Seed initial data (optional)
npx supabase db seed
```

## Step 2: Edge Functions Deployment

```bash
# Deploy all edge functions
npx supabase functions deploy create-encrypted-menu
npx supabase functions deploy access-encrypted-menu-v2
npx supabase functions deploy menu-burn
npx supabase functions deploy menu-whitelist-manage
npx supabase functions deploy tenant-admin-auth

# Verify deployments
npx supabase functions list
```

## Step 3: Build Application

```bash
# Install dependencies
npm install

# Run tests
npm run test
npm run test:e2e

# Build for production
npm run build

# Preview build
npm run preview
```

## Step 4: Deploy Frontend

### Option A: Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Option B: Netlify
```bash
# Install Netlify CLI
npm i -g netlify-cli

# Deploy
netlify deploy --prod --dir=dist
```

### Option C: Static Hosting (S3, Cloudflare Pages)
```bash
# Upload dist/ folder to your CDN
# Ensure _redirects or equivalent for SPA routing
```

## Step 5: Post-Deployment Verification

### Smoke Tests
- [ ] Admin login works
- [ ] Can create encrypted menu
- [ ] Customer can access menu via token
- [ ] Security alerts trigger correctly
- [ ] Live Activity feed updates

### Performance Checks
- [ ] Redis cache hit rate > 80%
- [ ] Edge function latency < 200ms (p95)
- [ ] Menu access time < 500ms

### Security Validation
- [ ] Velocity detection blocks rapid access
- [ ] Auto-burn triggers on max views
- [ ] Screenshot protection active
- [ ] Panic mode locks all menus

## Step 6: Monitoring Setup

### Supabase Dashboard
1. Go to **Project Settings > Database > Performance**
2. Enable **Performance Insights**
3. Set alerts for:
   - Database CPU > 80%
   - Active connections > 50
   - Cache hit ratio < 70%

### Sentry (Error Tracking)
```bash
npm install @sentry/react @sentry/vite-plugin

# Add to vite.config.ts
import { sentryVitePlugin } from "@sentry/vite-plugin";

export default defineConfig({
  plugins: [
    sentryVitePlugin({
      org: "your-org",
      project: "disposable-menus",
      authToken: process.env.SENTRY_AUTH_TOKEN,
    }),
  ],
});
```

### Uptime Monitoring (BetterStack, UptimeRobot)
- Monitor: `https://yourdomain.com/health`
- Alert on: Down > 1 minute
- Check interval: 60 seconds

## Rollback Plan

If issues occur post-deployment:

```bash
# Revert edge functions
npx supabase functions deploy <function-name> --version <previous-version>

# Rollback frontend (Vercel)
vercel rollback <deployment-url>

# Disable feature flags
# Update feature-flags.ts to disable new features
```

## Monitoring Dashboards

Access your monitoring at:
- **Supabase**: https://app.supabase.com/project/_/database/performance
- **Sentry**: https://sentry.io/your-org/disposable-menus
- **Uptime**: https://betterstack.com/dashboard

## Support Contacts

- **DevOps**: devops@yourdomain.com
- **Security**: security@yourdomain.com
- **On-Call**: [PagerDuty/AlertManager link]
