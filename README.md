# 🏠 Home Management App - Complete Home Management Ecosystem

*Last updated: January 2025 - Phase 1 Complete: 100% Feature Delivery*

A comprehensive home management application built with Next.js, featuring advanced meal planning, intelligent task management, calendar synchronization, OCR receipt processing, and household collaboration with AI-powered automation.

## 🚀 Features

### **✅ Phase 1 Complete: Advanced Home Management Ecosystem**

### **🆕 Recent Improvements (September 2025)**
- **🔧 Fixed Shopping List Integration**: Resolved duplicate item creation and confirmation issues
- **🛡️ Enhanced Security**: Implemented proper CSRF token handling for all operations
- **🧹 Duplicate Cleanup**: Added tools to merge existing duplicate shopping items
- **⚡ Performance Optimizations**: Improved API response handling and UI refresh logic
- **🐛 Bug Fixes**: Resolved 401 authentication errors and database schema issues

#### **📅 Calendar & Event Management**
- **Complete Calendar System**: Full event management with RRULE recurrence patterns
- **Multi-View Interface**: Agenda and Week views with responsive design
- **Event Templates**: Pre-configured templates for quick event creation
- **Timezone Support**: Robust timezone conversion with DST handling
- **ICS Export & Sync**: Public calendar feeds with secure token authentication
- **Multi-Platform Support**: Google Calendar, Apple Calendar, Outlook compatibility

#### **📱 Today View & Daily Dashboard**
- **Comprehensive Overview**: Daily activities, progress tracking, and quick actions
- **Data Aggregation**: Chores, events, meal plans, and shopping lists in one view
- **Progress Tracking**: XP system integration and achievement monitoring
- **Smart Navigation**: Date navigation and contextual quick actions

#### **🛒 Smart Shopping Integration**
- **Auto-Ingredient Addition**: Automatic ingredient extraction from meal plans
- **Real-time Sync**: Seamless integration between meal planning and shopping lists
- **Enhanced Auto Workflow**: One-tap confirmation for auto-added items
- **Smart Deduplication**: Intelligent quantity merging and duplicate handling
- **Bulk Operations**: Add all week's ingredients with one click
- **Intelligent Parsing**: Handles various quantity formats and ingredient names
- **Duplicate Cleanup**: Built-in tools to merge existing duplicate items
- **CSRF Security**: Secure item deletion and confirmation with proper authentication

#### **📄 Receipt Processing & OCR**
- **Intelligent OCR**: Smart receipt scanning with pattern recognition
- **Item Extraction**: Automatic categorization and price tracking
- **Shopping Integration**: One-click addition to shopping lists
- **Price History**: Historical price tracking across stores
- **File Management**: Secure storage with proper access controls

#### **🎮 Core Features**
- **📱 Progressive Web App**: Installable, offline-capable, native app experience
- **🔐 User Management**: Clerk authentication with role-based access
- **✅ AI-Powered Chore Management**: Smart assignment algorithms with 5 strategies
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

## 📚 Documentation

- **[Meal Planner → Shopping List Integration](MEAL_PLANNER_SHOPPING_INTEGRATION.md)** - Complete workflow and technical implementation
- **[Shopping List Integration Progress](SHOPPING_LIST_INTEGRATION_PROGRESS.md)** - Recent improvements and bug fixes
- **[Database Schemas](database-schemas/)** - Complete database structure documentation
- **[System Reviews](system-reviews/)** - Comprehensive feature analysis and recommendations

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

## Release Notes

- 2025-09-27 – AI upgrades documented in `docs/AI_UPGRADES_2025-09-27.md` (OpenAI config fixes)

## 📝 License

This project is licensed under the MIT License.