import { notFound } from "next/navigation";

import { getRecipe } from "../../_lib/api";
import { RecipeEditor } from "../../_components/RecipeEditor";
import { analyzeRecipe } from "../../_lib/nutrition";

export const dynamic = "force-dynamic";

type EditRecipePageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditRecipePage({ params }: EditRecipePageProps) {
  const resolvedParams = await params;

  const recipe = await getRecipe({ id: resolvedParams.id }).catch((error) => {
    if ((error as { status?: number }).status === 404) {
      notFound();
    }
    throw error;
  });

  return <RecipeEditor recipe={recipe} mode="edit" insights={analyzeRecipe(recipe)} />;
}
