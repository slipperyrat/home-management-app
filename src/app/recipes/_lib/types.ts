export type RecipeSummary = {
  id: string;
  title: string;
  description: string | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  servings: number | null;
  tags: string[];
  imageUrl: string | null;
  difficulty: string | null;
  isFavorite: boolean;
  updatedAt: string;
};

export type RecipeDetail = RecipeSummary & {
  ingredients: unknown[];
  instructions: unknown[];
  householdId: string | null;
  createdBy: string | null;
  createdAt: string;
  notes: string | null;
};

export type RecipeFormInput = {
  title: string;
  description?: string | null;
  prep_time?: number | null;
  cook_time?: number | null;
  servings?: number | null;
  tags?: string[];
  image_url?: string | null;
  ingredients?: unknown[];
  instructions?: unknown[];
  notes?: string | null;
};

export type RecipeImportResult = {
  recipe: RecipeDetail;
  didCreate: boolean;
};
