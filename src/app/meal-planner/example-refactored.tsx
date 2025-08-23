'use client';

import { toast } from 'sonner';
import { useUserData } from '@/hooks/useUserData';
import { 
  useMealPlans, 
  useCreateMealPlan, 
  useOptimisticMealPlans 
} from '@/hooks/useMealPlans';
import { 
  useRecipes, 
  useCreateRecipe,
  useOptimisticRecipes 
} from '@/hooks/useRecipes';

export default function MealPlannerPageRefactored() {
  // User data
  const { userData, isLoading: userDataLoading, user } = useUserData();
  
  // React Query hooks for meal plans
  const { 
    data: mealPlansData, 
    isLoading: mealPlansLoading, 
    error: mealPlansError 
  } = useMealPlans();
  
  // React Query hooks for recipes
  const { 
    data: recipesData, 
    isLoading: recipesLoading, 
    error: recipesError 
  } = useRecipes();
  
  // Mutations
  const createMealPlan = useCreateMealPlan();
  const createRecipe = useCreateRecipe();
  
  // Optimistic updates
  const { addOptimisticMealPlan } = useOptimisticMealPlans();
  const { addOptimisticRecipe } = useOptimisticRecipes();
  
  // Extract data from React Query
  const mealPlans = mealPlansData?.mealPlans || [];
  const recipes = recipesData?.recipes || [];
  
  // Loading and error states
  const loading = userDataLoading || mealPlansLoading || recipesLoading;
  const error = mealPlansError || recipesError;
  
  // Handle creating a new meal plan
  const handleCreateMealPlan = async (data: {
    name: string;
    description?: string;
    start_date: string;
    end_date: string;
  }) => {
    if (!userData?.household?.id || !user?.id) return;
    
    try {
      // Add optimistic update
      addOptimisticMealPlan({
        ...data,
        household_id: userData.household.id,
        created_by: user.id,
        is_active: true,
        total_meals: 0,
        planned_meals: 0,
      });
      
      // Create the meal plan
      await createMealPlan.mutateAsync({
        ...data,
        household_id: userData.household.id,
      });
      
      toast.success('Meal plan created successfully!');
    } catch {
      toast.error('Failed to create meal plan. Please try again.');
    }
  };
  
  // Handle creating a new recipe
  const handleCreateRecipe = async (data: {
    name: string;
    description?: string;
    prep_time: number;
    cook_time: number;
    difficulty: 'easy' | 'medium' | 'hard';
    servings: number;
    image_url?: string;
    tags: string[];
    ingredients: Array<{ name: string; amount: number; unit: string; notes?: string }>;
    instructions: Array<{ step_number: number; instruction: string; time_minutes?: number }>;
  }) => {
    if (!userData?.household?.id || !user?.id) return;
    
    try {
      // Add optimistic update with proper ingredient/instruction structure
      addOptimisticRecipe({
        ...data,
        household_id: userData.household.id,
        created_by: user.id,
        is_favorite: false,
        ingredients: data.ingredients.map((ingredient, index) => ({
          id: `temp-ingredient-${index}`,
          recipe_id: 'temp-recipe-id',
          ...ingredient,
        })),
        instructions: data.instructions.map((instruction, index) => ({
          id: `temp-instruction-${index}`,
          recipe_id: 'temp-recipe-id',
          ...instruction,
        })),
      });
      
      // Create the recipe
      await createRecipe.mutateAsync({
        ...data,
        household_id: userData.household.id,
      });
      
      toast.success('Recipe created successfully!');
    } catch {
      toast.error('Failed to create recipe. Please try again.');
    }
  };
  
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
      
      {/* Quick Actions */}
      <div className="flex gap-4 mb-8">
        <button
          onClick={() => handleCreateMealPlan({
            name: 'New Meal Plan',
            start_date: new Date().toISOString().split('T')[0],
            end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          })}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
          disabled={createMealPlan.isPending}
        >
          {createMealPlan.isPending ? 'Creating...' : 'Create Meal Plan'}
        </button>
        
        <button
          onClick={() => handleCreateRecipe({
            name: 'New Recipe',
            prep_time: 15,
            cook_time: 30,
            difficulty: 'medium',
            servings: 4,
            tags: [],
            ingredients: [],
            instructions: []
          })}
          className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg"
          disabled={createRecipe.isPending}
        >
          {createRecipe.isPending ? 'Creating...' : 'Create Recipe'}
        </button>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Total Meal Plans</h3>
          <p className="text-3xl font-bold text-blue-500">{mealPlans.length}</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Total Recipes</h3>
          <p className="text-3xl font-bold text-green-500">{recipes.length}</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Active Plans</h3>
          <p className="text-3xl font-bold text-purple-500">
            {mealPlans.filter(mp => mp.is_active).length}
          </p>
        </div>
      </div>
      
      {/* Meal Plans List */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Meal Plans</h2>
        
        {mealPlans.length > 0 ? (
          <div className="space-y-4">
            {mealPlans.map((mealPlan) => (
              <div key={mealPlan.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">{mealPlan.name}</h3>
                    {mealPlan.description && (
                      <p className="text-gray-600 text-sm">{mealPlan.description}</p>
                    )}
                    <p className="text-sm text-gray-500">
                      {new Date(mealPlan.start_date).toLocaleDateString()} - {new Date(mealPlan.end_date).toLocaleDateString()}
                    </p>
                  </div>
                  
                  <div className="text-right">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      mealPlan.is_active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {mealPlan.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <p className="text-sm text-gray-500 mt-1">
                      {mealPlan.planned_meals} of {mealPlan.total_meals} meals planned
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">No meal plans yet. Create your first one to get started!</p>
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
            <p className="text-gray-500">No recipes yet. Create your first one to get started!</p>
          </div>
        )}
      </div>
      
      {/* Note: Modal implementations would go here */}
      {/* This is just an example of the refactored structure */}
    </div>
  );
}
