'use client';

import { toast } from 'sonner';
import { useUserData } from '@/hooks/useUserData';
import { 
  useMealPlan, 
  useOptimisticMealPlans 
} from '@/hooks/useMealPlans';
import { 
  useRecipes
} from '@/hooks/useRecipes';

export default function MealPlannerPageRefactored() {
  // User data
  const { userData, isLoading: userDataLoading, user } = useUserData();
  
  // React Query hooks for meal plans
  const { 
    data: mealPlansData, 
    isLoading: mealPlansLoading, 
    error: mealPlansError 
  } = useMealPlan();
  
  // React Query hooks for recipes
  const { 
    data: recipesData, 
    isLoading: recipesLoading, 
    error: recipesError 
  } = useRecipes();
  
  // Optimistic updates
  const { addOptimisticMeal } = useOptimisticMealPlans();
  
  // Extract data from React Query
  const mealPlans = mealPlansData ? [mealPlansData] : [];
  const recipes = recipesData?.recipes || [];
  
  // Loading and error states
  const loading = userDataLoading || mealPlansLoading || recipesLoading;
  const error = mealPlansError || recipesError;
  
  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Loading Meal Planner...</p>
        </div>
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Error Loading Meal Planner</h2>
          <p className="text-gray-600 mb-6">
            {error.message || 'Failed to load meal planner data'}
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Meal Planner</h1>
        <p className="text-gray-600">
          Plan your meals for the week and organize your recipes
        </p>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Current Week</h3>
          <p className="text-3xl font-bold text-blue-500">
            {mealPlans.length > 0 ? 'Active' : 'No Plan'}
          </p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Total Recipes</h3>
          <p className="text-3xl font-bold text-green-500">{recipes.length}</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Meals Planned</h3>
          <p className="text-3xl font-bold text-purple-500">
            {mealPlans.length > 0 ? 'This Week' : 'None'}
          </p>
        </div>
      </div>
      
      {/* Meal Plans List */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Current Week</h2>
        
        {mealPlans.length > 0 ? (
          <div className="space-y-4">
            {mealPlans.map((mealPlan) => (
              <div key={mealPlan.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">Week of {new Date(mealPlan.week_start_date).toLocaleDateString()}</h3>
                    <p className="text-sm text-gray-500">
                      {Object.keys(mealPlan.meals).length} days with meals planned
                    </p>
                  </div>
                  
                  <div className="text-right">
                    <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                      Active
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">No meal plan for this week. Use the main meal planner to create one!</p>
          </div>
        )}
      </div>
      
      {/* Recipes List */}
      <div className="bg-white rounded-lg shadow p-6 mt-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Recipes</h2>
        
        {recipes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recipes.map((recipe) => (
              <div key={recipe.id} className="border rounded-lg p-4">
                <h3 className="text-lg font-medium text-gray-900 mb-2">{recipe.name}</h3>
                {recipe.description && (
                  <p className="text-gray-600 text-sm mb-2">{recipe.description}</p>
                )}
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>Prep: {recipe.prep_time}m</span>
                  <span>Cook: {recipe.cook_time}m</span>
                  <span>Servings: {recipe.servings}</span>
                </div>
                <div className="mt-2">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    recipe.difficulty === 'easy' ? 'bg-green-100 text-green-800' :
                    recipe.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {recipe.difficulty}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">No recipes yet. Use the main meal planner to create your first one!</p>
          </div>
        )}
      </div>
      
      {/* Note: This is just an example of the refactored structure */}
      <div className="mt-8 p-4 bg-blue-50 rounded-lg">
        <p className="text-blue-800 text-sm">
          <strong>Note:</strong> This is an example refactored component showing the basic structure. 
          For full functionality, use the main meal planner page.
        </p>
      </div>
    </div>
  );
}
