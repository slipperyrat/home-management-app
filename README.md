# Home Management App

A comprehensive home management application built with Next.js, featuring meal planning, task management, and household collaboration.

## 🚀 Features

- **📱 Progressive Web App**: Installable, offline-capable, native app experience
- **🔐 User Management**: Clerk authentication with role-based access
- **🍽️ Meal Planning**: Recipe management and weekly meal planning
- **✅ Task Management**: Chores, planner items, and calendar events
- **🎮 Gamification**: XP, coins, and rewards system
- **👥 Collaboration**: Multi-user household management
- **📱 Mobile-First**: Responsive design with PWA capabilities

## 🛠️ Tech Stack

- **Framework**: Next.js 15.4.3 with App Router
- **PWA**: next-pwa with Workbox for offline functionality
- **Authentication**: Clerk
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS
- **State Management**: TanStack Query
- **Validation**: Zod
- **Security**: Custom middleware with rate limiting, CSRF protection
- **Monitoring**: Sentry error tracking, Vercel Analytics
- **Testing**: Vitest with React Testing Library, Playwright E2E

## 📊 Security Features

- ✅ Rate limiting (100 requests/15min sliding window)
- ✅ CSRF protection via origin header validation
- ✅ Input sanitization with `sanitize-html`
- ✅ Zod schema validation on all inputs
- ✅ Security headers (CSP, XSS protection, etc.)
- ✅ Row Level Security (RLS) with Supabase

## 📱 PWA Features

- **🚀 Installable**: Add to home screen on any device
- **📴 Offline Support**: Core features work without internet
- **🔔 Push Notifications**: Real-time notifications for household activities
- **🔄 Auto Updates**: Background updates with notifications
- **⚡ Fast Loading**: Instant loading from cache
- **🎯 App Shortcuts**: Quick access to key features
- **📱 Native Feel**: Standalone app experience

### Installing the App
1. Visit the website on any device
2. Look for the "Install" prompt (appears after 10 seconds)
3. Click "Install" or "Add to Home Screen"
4. App appears on your home screen like a native app!

## 🧪 Testing

```bash
# Run unit tests in watch mode
npm test

# Run unit tests once
npm run test:run

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui
```

## 📈 Monitoring

- **Error Tracking**: Sentry integration with source maps
- **Performance**: Vercel Analytics
- **Logs**: Structured logging throughout the application

## 🚀 Getting Started

1. **Clone the repository**
```bash
git clone <your-repo>
cd home-management-app
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
Create a `.env.local` file with:
```env
# Clerk Keys
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key

# Supabase Keys
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

4. **Run database migrations**
Execute the SQL files in the `supabase/` directory in your Supabase dashboard.

5. **Start the development server**
```bash
npm run dev
```

6. **Visit the application**
Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure

```
src/
├── app/                 # Next.js App Router pages
│   ├── api/            # API routes
│   ├── onboarding/     # Onboarding wizard
│   └── ...
├── components/         # Reusable React components
├── lib/                # Utility functions and configurations
│   ├── security/       # Security utilities (sanitization, validation)
│   └── server/         # Server-side utilities
├── test/               # Test files
└── middleware.ts       # Next.js middleware (auth, security, rate limiting)
```

## 🔐 Security Implementation

The app implements multiple layers of security:

1. **Middleware Security**: Rate limiting, CSRF protection, security headers
2. **Input Validation**: Zod schemas for all API endpoints
3. **Input Sanitization**: HTML sanitization to prevent XSS
4. **Authentication**: Clerk integration with proper session management
5. **Database Security**: Row Level Security (RLS) with Supabase

## 🧪 Test Coverage

- **Security Functions**: Input sanitization and validation
- **API Routes**: Onboarding flow and critical endpoints
- **Components**: Error boundaries and core UI components
- **Utilities**: Helper functions and middleware logic

## 📊 Performance

- **Caching**: React Query with optimized cache settings
- **Database**: Indexed queries and connection pooling
- **Frontend**: Code splitting and optimized bundles
- **Monitoring**: Real-time performance tracking

## 🚀 Deployment

The app is optimized for deployment on Vercel:

1. Connect your repository to Vercel
2. Add environment variables in Vercel dashboard
3. Enable Sentry integration for source maps
4. Deploy!

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📝 License

This project is licensed under the MIT License.