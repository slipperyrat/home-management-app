# Architecture & Code Quality Improvements

## Current Architecture Score: B- (Good foundation, needs refactoring)

## 1. Component Architecture Issues

### Current Problems:
- **Monolithic Components**: 900+ line components
- **Mixed Concerns**: Data fetching + UI + business logic together
- **Duplicate Code**: Similar patterns repeated across components
- **No Custom Hooks**: Business logic not reusable

### Solutions:

#### A. Component Decomposition
```typescript
// Current: Monolithic MealPlannerPage (900+ lines)
// Better: Decomposed architecture

// Main container
export default function MealPlannerPage() {
  return (
    <MealPlannerProvider>
      <div className="container mx-auto p-4">
        <MealPlannerHeader />
        <WeekNavigation />
        <MealGrid />
        <RecipeModal />
        <CreateRecipeModal />
      </div>
    </MealPlannerProvider>
  );
}

// Context for state management
const MealPlannerContext = createContext<MealPlannerContextType | null>(null);

export const MealPlannerProvider = ({ children }: { children: ReactNode }) => {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const { data: userData } = useUserData();
  const { data: recipes } = useRecipes(userData?.household?.id);
  const { data: mealPlan } = useMealPlan(userData?.household?.id, currentWeek);
  
  const value = {
    currentWeek,
    setCurrentWeek,
    userData,
    recipes,
    mealPlan,
    // ... other shared state
  };
  
  return (
    <MealPlannerContext.Provider value={value}>
      {children}
    </MealPlannerContext.Provider>
  );
};

// Individual components
const MealGrid = () => {
  const { mealPlan, recipes } = useMealPlannerContext();
  
  return (
    <div className="grid grid-cols-7 gap-4">
      {DAYS.map(day => (
        <DayColumn key={day} day={day} />
      ))}
    </div>
  );
};

const DayColumn = ({ day }: { day: string }) => {
  const { mealPlan } = useMealPlannerContext();
  
  return (
    <div className="space-y-2">
      <h3 className="font-semibold capitalize">{day}</h3>
      {MEAL_TYPES.map(mealType => (
        <MealSlot key={mealType} day={day} mealType={mealType} />
      ))}
    </div>
  );
};
```

#### B. Custom Hooks for Business Logic
```typescript
// Extract business logic into reusable hooks

export const useRecipeAssignment = () => {
  const { userData } = useUserData();
  const queryClient = useQueryClient();
  
  const assignRecipe = useMutation({
    mutationFn: async ({ date, mealType, recipe }: AssignRecipeParams) => {
      const response = await fetch('/api/meal-planner/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          week: getWeekStart(date),
          day: getDayName(date),
          slot: mealType,
          recipe_id: recipe.id,
          alsoAddToList: true,
        }),
      });
      
      if (!response.ok) throw new Error('Failed to assign recipe');
      return response.json();
    },
    onSuccess: (data) => {
      // Invalidate and refetch meal plan
      queryClient.invalidateQueries(['mealPlan']);
      
      // Show success toast
      if (data.ingredients) {
        const { added, updated } = data.ingredients;
        if (added > 0 || updated > 0) {
          const message = added > 0 && updated > 0 
            ? `Added ${added} items • Merged ${updated} items`
            : added > 0 
              ? `Added ${added} items`
              : `Merged ${updated} items`;
          
          toast.success(message, {
            action: {
              label: 'View List',
              onClick: () => router.push('/shopping-lists')
            }
          });
        }
      }
    },
  });
  
  return { assignRecipe: assignRecipe.mutate, isAssigning: assignRecipe.isPending };
};

export const useRecipeCreation = () => {
  const queryClient = useQueryClient();
  
  const createRecipe = useMutation({
    mutationFn: async (recipeData: CreateRecipeData) => {
      const response = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recipeData),
      });
      
      if (!response.ok) throw new Error('Failed to create recipe');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['recipes']);
      toast.success('Recipe created successfully!');
    },
    onError: (error) => {
      toast.error(`Failed to create recipe: ${error.message}`);
    },
  });
  
  return { createRecipe: createRecipe.mutate, isCreating: createRecipe.isPending };
};
```

## 2. Data Layer Architecture

### Current Issues:
- Direct API calls in components
- No data layer abstraction
- Inconsistent error handling
- No offline support

### Solutions:

#### A. API Client Abstraction
```typescript
// Create centralized API client
class ApiClient {
  private baseUrl = '/api';
  
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    };
    
    const response = await fetch(url, config);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new ApiError(error.error || 'Request failed', response.status);
    }
    
    return response.json();
  }
  
  // Recipe methods
  recipes = {
    list: (householdId: string) => 
      this.request<Recipe[]>(`/recipes?household_id=${householdId}`),
    create: (data: CreateRecipeData) => 
      this.request<Recipe>('/recipes', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Recipe>) => 
      this.request<Recipe>(`/recipes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => 
      this.request<void>(`/recipes/${id}`, { method: 'DELETE' }),
  };
  
  // Meal planner methods
  mealPlanner = {
    get: (householdId: string, weekStart: string) => 
      this.request<MealPlan>(`/meal-planner?household_id=${householdId}&week_start=${weekStart}`),
    assign: (data: AssignMealData) => 
      this.request<AssignMealResponse>('/meal-planner/assign', { method: 'POST', body: JSON.stringify(data) }),
  };
  
  // Shopping list methods
  shoppingLists = {
    list: (householdId: string) => 
      this.request<ShoppingList[]>(`/shopping-lists?household_id=${householdId}`),
    addRecipeIngredients: (recipeId: string) => 
      this.request<AddIngredientsResponse>('/shopping-lists/add-recipe-ingredients', { 
        method: 'POST', 
        body: JSON.stringify({ recipe_id: recipeId }) 
      }),
  };
}

export const apiClient = new ApiClient();

class ApiError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
    this.name = 'ApiError';
  }
}
```

#### B. Query Hooks with React Query
```typescript
// Centralized query hooks
export const useUserData = () => {
  return useQuery({
    queryKey: ['userData'],
    queryFn: () => apiClient.user.getData(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.statusCode === 401) {
        return false; // Don't retry auth errors
      }
      return failureCount < 3;
    },
  });
};

export const useRecipes = (householdId?: string) => {
  return useQuery({
    queryKey: ['recipes', householdId],
    queryFn: () => apiClient.recipes.list(householdId!),
    enabled: !!householdId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useMealPlan = (householdId?: string, weekStart?: Date) => {
  const weekStartString = weekStart?.toISOString().split('T')[0];
  
  return useQuery({
    queryKey: ['mealPlan', householdId, weekStartString],
    queryFn: () => apiClient.mealPlanner.get(householdId!, weekStartString!),
    enabled: !!householdId && !!weekStartString,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
```

## 3. Error Handling Architecture

### Current Issues:
- Inconsistent error handling patterns
- Generic error messages
- No error boundaries
- Poor user experience on errors

### Solutions:

#### A. Global Error Boundary
```typescript
// Error boundary component
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class AppErrorBoundary extends Component<
  { children: ReactNode; fallback?: ComponentType<{ error: Error }> },
  ErrorBoundaryState
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('App Error Boundary caught an error:', error, errorInfo);
    
    // Send to error reporting service
    if (typeof window !== 'undefined') {
      // Sentry, LogRocket, etc.
    }
  }
  
  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      return <FallbackComponent error={this.state.error!} />;
    }
    
    return this.props.children;
  }
}

const DefaultErrorFallback = ({ error }: { error: Error }) => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <h1 className="text-2xl font-bold text-red-600 mb-4">Something went wrong</h1>
      <p className="text-gray-600 mb-4">We're sorry, but something unexpected happened.</p>
      <button
        onClick={() => window.location.reload()}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Reload Page
      </button>
    </div>
  </div>
);
```

#### B. Typed Error Handling
```typescript
// Define error types
export enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  NOT_FOUND_ERROR = 'NOT_FOUND_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
}

export interface AppError {
  type: ErrorType;
  message: string;
  details?: Record<string, any>;
  userMessage?: string;
}

// Error handling hook
export const useErrorHandler = () => {
  const handleError = useCallback((error: unknown) => {
    let appError: AppError;
    
    if (error instanceof ApiError) {
      switch (error.statusCode) {
        case 401:
          appError = {
            type: ErrorType.AUTHENTICATION_ERROR,
            message: error.message,
            userMessage: 'Please sign in to continue',
          };
          break;
        case 403:
          appError = {
            type: ErrorType.AUTHORIZATION_ERROR,
            message: error.message,
            userMessage: 'You don\'t have permission to perform this action',
          };
          break;
        case 404:
          appError = {
            type: ErrorType.NOT_FOUND_ERROR,
            message: error.message,
            userMessage: 'The requested resource was not found',
          };
          break;
        default:
          appError = {
            type: ErrorType.SERVER_ERROR,
            message: error.message,
            userMessage: 'An unexpected error occurred',
          };
      }
    } else {
      appError = {
        type: ErrorType.NETWORK_ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
        userMessage: 'Network error. Please check your connection.',
      };
    }
    
    // Show user-friendly error message
    toast.error(appError.userMessage || appError.message);
    
    // Log detailed error for debugging
    console.error('Application error:', appError);
    
    return appError;
  }, []);
  
  return { handleError };
};
```

## 4. Testing Architecture

### Current Issues:
- No test coverage
- No testing strategy
- No CI/CD pipeline

### Solutions:

#### A. Testing Setup
```bash
# Install testing dependencies
npm install --save-dev @testing-library/react @testing-library/jest-dom jest jest-environment-jsdom
npm install --save-dev @types/jest vitest
```

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

#### B. Test Utilities
```typescript
// src/test/test-utils.tsx
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClerkProvider } from '@clerk/nextjs';

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  const queryClient = createTestQueryClient();
  
  return (
    <ClerkProvider>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </ClerkProvider>
  );
};

const customRender = (ui: React.ReactElement, options?: RenderOptions) =>
  render(ui, { wrapper: AllTheProviders, ...options });

export * from '@testing-library/react';
export { customRender as render };
```

#### C. Example Tests
```typescript
// src/components/__tests__/MealSlot.test.tsx
import { render, screen, fireEvent } from '../test/test-utils';
import { MealSlot } from '../MealSlot';

describe('MealSlot', () => {
  const mockProps = {
    day: 'monday',
    mealType: 'breakfast' as const,
    recipe: null,
    recipes: [
      { id: '1', title: 'Pancakes', description: 'Fluffy pancakes' },
      { id: '2', title: 'Oatmeal', description: 'Healthy oatmeal' },
    ],
    onAssign: jest.fn(),
  };
  
  it('renders empty slot correctly', () => {
    render(<MealSlot {...mockProps} />);
    expect(screen.getByText('Add Recipe')).toBeInTheDocument();
  });
  
  it('shows recipe dropdown when clicked', () => {
    render(<MealSlot {...mockProps} />);
    fireEvent.click(screen.getByText('Add Recipe'));
    expect(screen.getByText('Pancakes')).toBeInTheDocument();
    expect(screen.getByText('Oatmeal')).toBeInTheDocument();
  });
  
  it('calls onAssign when recipe is selected', () => {
    render(<MealSlot {...mockProps} />);
    fireEvent.click(screen.getByText('Add Recipe'));
    fireEvent.click(screen.getByText('Pancakes'));
    
    expect(mockProps.onAssign).toHaveBeenCalledWith(mockProps.recipes[0]);
  });
});
```

## 5. Build & Deployment Optimization

### A. Bundle Analysis
```bash
# Add bundle analyzer
npm install --save-dev @next/bundle-analyzer

# next.config.js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

module.exports = withBundleAnalyzer({
  // ... other config
});
```

### B. Code Splitting Strategy
```typescript
// Lazy load heavy components
const MealPlannerPage = lazy(() => import('./meal-planner/page'));
const ShoppingListsPage = lazy(() => import('./shopping-lists/page'));

// Route-based code splitting
const AppRouter = () => (
  <Suspense fallback={<LoadingSpinner />}>
    <Routes>
      <Route path="/meal-planner" element={<MealPlannerPage />} />
      <Route path="/shopping-lists" element={<ShoppingListsPage />} />
    </Routes>
  </Suspense>
);
```

## Priority Implementation Order:
1. **Component decomposition** (High Priority)
2. **Custom hooks extraction** (High Priority)
3. **API client abstraction** (Medium Priority)
4. **Error boundaries** (Medium Priority)
5. **Testing setup** (Low Priority)
6. **Bundle optimization** (Low Priority)
