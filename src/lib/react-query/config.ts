import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Time to consider data stale (5 minutes)
      staleTime: 5 * 60 * 1000,
      
      // Time to keep data in cache (10 minutes)
      gcTime: 10 * 60 * 1000,
      
      // Retry failed requests 3 times
      retry: 3,
      
      // Retry delay with exponential backoff
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      
      // Refetch on window focus (good for keeping data fresh)
      refetchOnWindowFocus: true,
      
      // Refetch on reconnect
      refetchOnReconnect: true,
      
      // Refetch on mount
      refetchOnMount: true,
    },
    mutations: {
      // Retry failed mutations once
      retry: 1,
      
      // Retry delay for mutations
      retryDelay: 1000,
    },
  },
});

// Query keys for consistent caching
export const queryKeys = {
  // Shopping lists
  shoppingLists: {
    all: ['shopping-lists'] as const,
    byHousehold: (householdId: string) => ['shopping-lists', 'household', householdId] as const,
    byId: (id: string) => ['shopping-lists', id] as const,
    items: (listId: string) => ['shopping-lists', listId, 'items'] as const,
  },
  
  // Recipes
  recipes: {
    all: ['recipes'] as const,
    byHousehold: (householdId: string) => ['recipes', 'household', householdId] as const,
    byId: (id: string) => ['recipes', id] as const,
    search: (query: string) => ['recipes', 'search', query] as const,
    byTag: (tag: string) => ['recipes', 'tag', tag] as const,
    favorites: ['recipes', 'favorites'] as const,
  },
  
  // Meal plans
  mealPlans: {
    all: ['meal-plans'] as const,
    byHousehold: (householdId: string) => ['meal-plans', 'household', householdId] as const,
    byId: (id: string) => ['meal-plans', id] as const,
    byWeek: (weekStart: string) => ['meal-plans', 'week', weekStart] as const,
    recipes: (mealPlanId: string) => ['meal-plans', mealPlanId, 'recipes'] as const,
  },
  
  // User data
  user: {
    profile: ['user', 'profile'] as const,
    household: ['user', 'household'] as const,
    preferences: ['user', 'preferences'] as const,
    stats: ['user', 'stats'] as const,
  },
  
  // Chores
  chores: {
    all: ['chores'] as const,
    byHousehold: (householdId: string) => ['chores', 'household', householdId] as const,
    byUser: (userId: string) => ['chores', 'user', userId] as const,
    completions: (choreId: string) => ['chores', choreId, 'completions'] as const,
  },
  
  // Bills
  bills: {
    all: ['bills'] as const,
    byHousehold: (householdId: string) => ['bills', 'household', householdId] as const,
    byUser: (userId: string) => ['bills', 'user', userId] as const,
    overdue: ['bills', 'overdue'] as const,
  },

  // Finance envelopes
  budgets: {
    all: ['budget-envelopes'] as const,
    byHousehold: (householdId: string) => ['budget-envelopes', 'household', householdId] as const,
  },

  // Finance spending
  spending: {
    all: ['spend-entries'] as const,
    byHousehold: (householdId: string) => ['spend-entries', 'household', householdId] as const,
  },

  // AI insights
  aiInsights: {
    shopping: (householdId: string) => ['ai-insights', 'shopping', householdId] as const,
    mealPlanning: (householdId: string) => ['ai-insights', 'meal-planning', householdId] as const,
    choreOptimization: (householdId: string) => ['ai-insights', 'chore-optimization', householdId] as const,
  },
};
