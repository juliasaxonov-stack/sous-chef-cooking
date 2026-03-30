import { useParams, useNavigate } from "react-router-dom";
import { useRecipe, useDeleteRecipe } from "@/hooks/useRecipes";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Play, Edit, Trash2, Users, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import AIChatDrawer from "@/components/AIChatDrawer";

const RecipeDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: recipe, isLoading } = useRecipe(id);
  const deleteRecipe = useDeleteRecipe();
  const [showAI, setShowAI] = useState(false);

  const handleDelete = async () => {
    if (!id) return;
    if (!confirm("Delete this recipe?")) return;
    try {
      await deleteRecipe.mutateAsync(id);
      toast.success("Recipe deleted");
      navigate("/");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 max-w-lg mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Recipe not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/recipe/${id}/edit`)}>
              <Edit className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleDelete}>
              <Trash2 className="w-5 h-5 text-destructive" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6 pb-32">
        <div>
          <h1 className="text-3xl mb-1">{recipe.title}</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
            <p className="text-muted-foreground flex items-center gap-1">
              <Users className="w-4 h-4" />
              {recipe.servings} servings
            </p>
            {recipe.cuisine && (
              <span className="text-muted-foreground text-sm">{recipe.cuisine}</span>
            )}
          </div>
          {recipe.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {recipe.tags.map((tag) => (
                <Badge key={tag} variant="secondary">{tag}</Badge>
              ))}
            </div>
          )}
        </div>

        {/* Ingredients */}
        {recipe.ingredients.length > 0 && (
          <div>
            <h2 className="text-xl mb-3">Ingredients</h2>
            <Card className="border-none">
              <CardContent className="p-4">
                <ul className="space-y-2">
                  {recipe.ingredients.map((ing, i) => (
                    <li key={i} className="flex gap-2 text-base">
                      <span className="text-muted-foreground min-w-[4rem] text-right">
                        {ing.quantity} {ing.unit}
                      </span>
                      <span>{ing.name}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Steps */}
        {recipe.steps.length > 0 && (
          <div>
            <h2 className="text-xl mb-3">Steps</h2>
            <div className="space-y-3">
              {recipe.steps.map((step, i) => (
                <Card key={i} className="border-none">
                  <CardContent className="p-4 flex gap-3">
                    <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center shrink-0 font-semibold mt-0.5">
                      {step.position}
                    </span>
                    <p className="text-base leading-relaxed">{step.instruction}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Start Cooking Button */}
        {recipe.steps.length > 0 && (
          <Button
            size="lg"
            className="w-full h-14 text-lg font-semibold"
            onClick={() => navigate(`/recipe/${id}/cook`)}
          >
            <Play className="w-5 h-5 mr-2" />
            Start Cooking
          </Button>
        )}
      </main>

      {/* AI FAB */}
      <Button
        size="lg"
        variant="secondary"
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg z-20"
        onClick={() => setShowAI(true)}
      >
        <MessageCircle className="w-6 h-6" />
      </Button>

      {showAI && recipe && (
        <AIChatDrawer recipe={recipe} onClose={() => setShowAI(false)} />
      )}
    </div>
  );
};

export default RecipeDetail;
