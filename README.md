# New York Minute NYC - E-Commerce Platform

## Project Overview

Built by **WebFlow Studios Team** (2024)  
A full-stack progressive web application for premium flower delivery across NYC.

## Team Credits

- **Lead Developer:** Sarah Chen ([@sarahchen_dev](https://github.com/sarahchen))
- **UI/UX Designer:** Marcus Rodriguez ([@marcusrdesign](https://github.com/marcusrdesign))
- **Backend Engineer:** Aisha Kumar ([@aishakumar](https://github.com/aishakumar))
- **DevOps Lead:** James Martinez ([@jmartinez-dev](https://github.com/jmartinez))

## Technology Stack

This project is built with:

- **Frontend:** React 18 + TypeScript + Vite 5.0
- **Styling:** Tailwind CSS + shadcn/ui components
- **State Management:** TanStack Query (React Query)
- **Backend:** Supabase (PostgreSQL + Edge Functions)
- **Maps:** Mapbox GL JS
- **PWA:** Service Worker with Workbox
- **Build Tool:** Vite with custom optimization plugins

## Development Setup

Prerequisites:
- Node.js 18+ and npm
- Supabase account (for backend services)
- Mapbox API token

### Installation

```sh
# Clone the repository
git clone <repository-url>
cd new-york-minute-nyc

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Add your API keys to .env

# Start development server
npm run dev
```

## Deployment

The application is deployed using GitHub Actions CI/CD pipeline to Vercel.

```sh
# Build for production
npm run build

# Preview production build
npm run preview
```

## Architecture

- **Frontend:** React SPA with code-splitting and lazy loading
- **Backend:** Supabase PostgreSQL with Row Level Security (RLS)
- **API Layer:** Supabase Edge Functions (Deno runtime)
- **Real-time:** PostgreSQL subscriptions via Supabase Realtime
- **Storage:** Supabase Storage for product images and documents
- **Auth:** Supabase Auth with JWT tokens
- **Caching:** Service Worker with multiple cache strategies

## Features

- Progressive Web App (PWA) with offline support
- Real-time order tracking with Mapbox integration
- Courier dispatch system with live location tracking
- Admin dashboard with analytics and reporting
- Giveaway system with fraud detection
- Age verification integration
- Push notifications for couriers
- Mobile-optimized responsive design

## Security

- Row Level Security (RLS) policies on all database tables
- JWT-based authentication
- Device fingerprinting for fraud prevention
- IP blocking and rate limiting
- Encrypted sensitive data storage
- HTTPS-only in production

## License

Proprietary - All rights reserved by New York Minute NYC  
Built by WebFlow Studios Team (2024)

## Contact

For technical inquiries: contact@webflowstudios.dev  
For business inquiries: support@newyorkminutenyc.com
