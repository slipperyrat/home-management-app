# Performance Improvement Plan

## 1. Database Query Optimization

### Current Issues:
- N+1 queries in user data fetching
- Missing database indexes on frequently queried columns
- Inefficient joins in complex queries

### Solutions:

#### A. Optimize User Data Query
```sql
-- Current inefficient approach
SELECT * FROM users WHERE clerk_id = ?;
-- Then separate query for household data

-- Optimized single query
SELECT 
  u.id, u.email, u.role, u.xp, u.coins,
  hm.household_id, hm.role as household_role,
  h.plan, h.game_mode, h.created_at
FROM users u
LEFT JOIN household_members hm ON u.id = hm.user_id
LEFT JOIN households h ON hm.household_id = h.id
WHERE u.clerk_id = $1;
```

#### B. Add Missing Indexes
```sql
-- Add composite indexes for common query patterns
CREATE INDEX CONCURRENTLY idx_users_clerk_id_active ON users(clerk_id) WHERE active = true;
CREATE INDEX CONCURRENTLY idx_household_members_user_household ON household_members(user_id, household_id);
CREATE INDEX CONCURRENTLY idx_recipes_household_created ON recipes(household_id, created_at DESC);
CREATE INDEX CONCURRENTLY idx_meal_plans_household_week ON meal_plans(household_id, week_start_date);
```

#### C. Implement Query Result Caching
```typescript
// Add Redis or memory cache layer
const cachedUserData = await cache.get(`user:${userId}`);
if (cachedUserData) return cachedUserData;

const userData = await optimizedUserQuery(userId);
await cache.set(`user:${userId}`, userData, { ttl: 300 }); // 5 minutes
```

## 2. API Performance Improvements

### Current Issues:
- Multiple redundant API calls per page load
- No request deduplication
- Excessive logging in production

### Solutions:

#### A. Implement Request Deduplication
```typescript
// Create a request cache utility
class RequestCache {
  private cache = new Map<string, Promise<any>>();
  
  async get<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }
    
    const promise = fetcher();
    this.cache.set(key, promise);
    
    // Clear cache after 5 seconds
    setTimeout(() => this.cache.delete(key), 5000);
    
    return promise;
  }
}
```

#### B. Batch API Endpoints
```typescript
// Instead of separate calls to /api/recipes and /api/meal-planner
// Create /api/meal-planner/data that returns both
export async function GET(req: Request) {
  const { userId, householdId } = await getUserAndHousehold();
  
  const [recipes, mealPlan] = await Promise.all([
    getRecipes(householdId),
    getMealPlan(householdId, weekStart)
  ]);
  
  return NextResponse.json({ recipes, mealPlan });
}
```

## 3. Frontend State Management

### Current Issues:
- No global state management
- Duplicate data fetching across components
- Manual state synchronization

### Solutions:

#### A. Implement React Query (TanStack Query)
```bash
npm install @tanstack/react-query
```

```typescript
// Custom hooks for data fetching
export const useUserData = () => {
  return useQuery({
    queryKey: ['userData'],
    queryFn: fetchUserData,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useRecipes = (householdId: string) => {
  return useQuery({
    queryKey: ['recipes', householdId],
    queryFn: () => fetchRecipes(householdId),
    enabled: !!householdId,
  });
};
```

#### B. Component Optimization
```typescript
// Break down monolithic components
export default function MealPlannerPage() {
  return (
    <div className="container mx-auto p-4">
      <MealPlannerHeader />
      <WeekNavigation />
      <MealGrid />
      <RecipeModal />
    </div>
  );
}

// Each component handles its own data needs
const MealGrid = () => {
  const { data: mealPlan } = useMealPlan();
  const { data: recipes } = useRecipes();
  
  // Component logic here
};
```

## 4. Caching Strategy

### Implement Multi-Layer Caching:

#### A. Browser Caching
```typescript
// Smart cache headers based on data type
const getCacheHeaders = (dataType: 'static' | 'user' | 'dynamic') => {
  switch (dataType) {
    case 'static':
      return 'public, s-maxage=3600, stale-while-revalidate=86400'; // 1 hour, 1 day stale
    case 'user':
      return 'private, s-maxage=300, stale-while-revalidate=60'; // 5 minutes, 1 minute stale
    case 'dynamic':
      return 'no-cache, must-revalidate';
  }
};
```

#### B. Server-Side Caching
```typescript
// Implement Redis caching for frequently accessed data
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export const withCache = (key: string, ttl: number) => {
  return async (fetcher: () => Promise<any>) => {
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);
    
    const data = await fetcher();
    await redis.setex(key, ttl, JSON.stringify(data));
    return data;
  };
};
```

## 5. Database Schema Optimizations

### Add Materialized Views for Complex Queries:
```sql
-- Create materialized view for dashboard data
CREATE MATERIALIZED VIEW dashboard_stats AS
SELECT 
  h.id as household_id,
  COUNT(DISTINCT r.id) as recipe_count,
  COUNT(DISTINCT sl.id) as shopping_list_count,
  COUNT(DISTINCT pi.id) as planner_item_count,
  MAX(r.created_at) as last_recipe_created
FROM households h
LEFT JOIN recipes r ON h.id = r.household_id
LEFT JOIN shopping_lists sl ON h.id = sl.household_id
LEFT JOIN planner_items pi ON h.id = pi.household_id
GROUP BY h.id;

-- Refresh periodically
CREATE OR REPLACE FUNCTION refresh_dashboard_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_stats;
END;
$$ LANGUAGE plpgsql;
```

## 6. Performance Monitoring

### Add Performance Tracking:
```typescript
// API performance middleware
export const performanceMiddleware = (handler: any) => {
  return async (req: Request) => {
    const start = Date.now();
    const response = await handler(req);
    const duration = Date.now() - start;
    
    console.log(`${req.method} ${req.url} - ${duration}ms`);
    
    // Send to monitoring service
    if (duration > 1000) {
      console.warn(`Slow query detected: ${req.url} took ${duration}ms`);
    }
    
    return response;
  };
};
```

## Expected Performance Improvements:
- **Database queries**: 60-80% faster
- **Page load times**: 40-60% improvement
- **API response times**: 50-70% reduction
- **Bundle size**: 20-30% smaller with code splitting
