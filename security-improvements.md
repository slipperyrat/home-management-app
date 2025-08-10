# Security Enhancement Plan

## Current Security Posture: B+ (Good but needs improvements)

## 1. Authentication & Authorization

### ✅ Current Strengths:
- Clerk integration with server-side validation
- Proper JWT handling
- Multi-tenant data isolation

### ⚠️ Areas for Improvement:

#### A. Implement Rate Limiting
```typescript
// Add rate limiting middleware
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "10 s"), // 10 requests per 10 seconds
});

export const rateLimitMiddleware = async (req: Request) => {
  const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
  const { success, limit, reset, remaining } = await ratelimit.limit(ip);
  
  if (!success) {
    return new Response("Rate limit exceeded", { status: 429 });
  }
  
  return null; // Continue processing
};
```

#### B. Input Validation & Sanitization
```typescript
// Create validation schemas with Zod
import { z } from 'zod';

const RecipeSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500),
  ingredients: z.array(z.object({
    name: z.string().min(1).max(50),
    amount: z.number().positive(),
    unit: z.string().max(20),
  })).min(1),
  instructions: z.array(z.string().min(1)).min(1),
  prep_time: z.number().int().min(0).max(1440), // max 24 hours
  cook_time: z.number().int().min(0).max(1440),
  servings: z.number().int().min(1).max(50),
});

// Use in API routes
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validatedData = RecipeSchema.parse(body);
    // Process validated data
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 });
    }
  }
}
```

#### C. Secure Error Handling
```typescript
// Create secure error responses
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public isOperational: boolean = true,
    public userMessage?: string
  ) {
    super(message);
  }
}

export const handleApiError = (error: unknown) => {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: error.userMessage || "An error occurred" },
      { status: error.statusCode }
    );
  }
  
  // Log full error details server-side only
  console.error("Unexpected error:", error);
  
  // Return generic message to client
  return NextResponse.json(
    { error: "Internal server error" },
    { status: 500 }
  );
};
```

## 2. Data Protection

### A. Environment Variable Security
```typescript
// Create environment validation
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'CLERK_SECRET_KEY'
] as const;

const validateEnvironment = () => {
  const missing = requiredEnvVars.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};

// Call on app startup
validateEnvironment();
```

### B. Database Security
```sql
-- Enable Row Level Security (RLS) on all tables
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE planner_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY recipes_household_isolation ON recipes
  FOR ALL USING (household_id IN (
    SELECT household_id FROM household_members 
    WHERE user_id = auth.uid()
  ));

CREATE POLICY meal_plans_household_isolation ON meal_plans
  FOR ALL USING (household_id IN (
    SELECT household_id FROM household_members 
    WHERE user_id = auth.uid()
  ));

-- Add audit trail
CREATE TABLE audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  user_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 3. API Security

### A. CORS Configuration
```typescript
// Proper CORS setup
const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.NODE_ENV === 'production' 
    ? 'https://yourdomain.com' 
    : 'http://localhost:3000',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400', // 24 hours
};
```

### B. Content Security Policy
```typescript
// Add CSP headers
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline' https://clerk.dev;
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data: https:;
  font-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
`;

// In layout.tsx or middleware
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta httpEquiv="Content-Security-Policy" content={cspHeader} />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

## 4. Logging & Monitoring

### A. Security Event Logging
```typescript
// Security event logger
export const logSecurityEvent = async (event: {
  type: 'auth_failure' | 'rate_limit' | 'unauthorized_access' | 'data_breach';
  userId?: string;
  ip: string;
  userAgent: string;
  details: Record<string, any>;
}) => {
  // Log to security monitoring service
  console.warn('Security Event:', event);
  
  // Could integrate with services like:
  // - Sentry for error tracking
  // - DataDog for monitoring
  // - AWS CloudWatch for logging
};
```

### B. Audit Trail Implementation
```typescript
// Audit trail middleware
export const auditMiddleware = (tableName: string) => {
  return async (operation: 'create' | 'update' | 'delete', oldData: any, newData: any, userId: string) => {
    await supabase.from('audit_log').insert({
      table_name: tableName,
      operation,
      old_data: oldData,
      new_data: newData,
      user_id: userId,
    });
  };
};
```

## 5. Frontend Security

### A. XSS Protection
```typescript
// Sanitize user input
import DOMPurify from 'dompurify';

const sanitizeInput = (input: string): string => {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [], // No HTML tags allowed
    ALLOWED_ATTR: [],
  });
};

// Use in forms
const handleSubmit = (data: any) => {
  const sanitizedData = {
    ...data,
    title: sanitizeInput(data.title),
    description: sanitizeInput(data.description),
  };
  // Process sanitized data
};
```

### B. Secure Local Storage
```typescript
// Encrypt sensitive data in localStorage
import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY = process.env.NEXT_PUBLIC_ENCRYPTION_KEY!;

export const secureStorage = {
  setItem: (key: string, value: any) => {
    const encrypted = CryptoJS.AES.encrypt(JSON.stringify(value), ENCRYPTION_KEY).toString();
    localStorage.setItem(key, encrypted);
  },
  
  getItem: (key: string) => {
    const encrypted = localStorage.getItem(key);
    if (!encrypted) return null;
    
    try {
      const decrypted = CryptoJS.AES.decrypt(encrypted, ENCRYPTION_KEY);
      return JSON.parse(decrypted.toString(CryptoJS.enc.Utf8));
    } catch {
      return null;
    }
  },
};
```

## 6. Deployment Security

### A. Environment-based Configuration
```typescript
// config/security.ts
export const securityConfig = {
  development: {
    cors: ['http://localhost:3000'],
    logging: 'verbose',
    rateLimit: false,
  },
  production: {
    cors: ['https://yourdomain.com'],
    logging: 'error',
    rateLimit: true,
  },
};

export const getSecurityConfig = () => {
  return securityConfig[process.env.NODE_ENV as keyof typeof securityConfig];
};
```

### B. Security Headers Middleware
```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  // Security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  return response;
}
```

## Priority Implementation Order:
1. **Input validation** (High Priority)
2. **Rate limiting** (High Priority)
3. **Error handling** (Medium Priority)
4. **RLS policies** (Medium Priority)
5. **Audit logging** (Low Priority)
6. **Advanced monitoring** (Low Priority)
