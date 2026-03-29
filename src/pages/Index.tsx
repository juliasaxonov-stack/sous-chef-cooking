import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useRecipes } from "@/hooks/useRecipes";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, ChefHat, LogOut, Link as LinkIcon, Users } from "lucide-react";
import ImportRecipeDialog from "@/components/ImportRecipeDialog";

const Index = () => {
  const { user, signOut } = useAuth();
  const { data: recipes, isLoading } = useRecipes();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <ChefHat className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-xl">Sous Chef</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 pb-24">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl">My Recipes</h2>
          <ImportRecipeDialog />
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : recipes && recipes.length > 0 ? (
          <div className="space-y-3">
            {recipes.map((recipe) => (
              <Card
                key={recipe.id}
                className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98] border-none"
                onClick={() => navigate(`/recipe/${recipe.id}`)}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-lg leading-tight">{recipe.title}</h3>
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <Users className="w-3.5 h-3.5" />
                      {recipe.servings} servings
                    </p>
                  </div>
                  <ChefHat className="w-5 h-5 text-muted-foreground" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <ChefHat className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground mb-1">No recipes yet</p>
            <p className="text-sm text-muted-foreground">Tap + to create your first recipe</p>
          </div>
        )}
      </main>

      {/* FAB */}
      <Button
        size="lg"
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg z-20"
        onClick={() => navigate("/recipe/new")}
      >
        <Plus className="w-6 h-6" />
      </Button>
    </div>
  );
};

export default Index;
