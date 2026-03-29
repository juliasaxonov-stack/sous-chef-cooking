import { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useRecipe, useCreateRecipe, useUpdateRecipe, Ingredient, Step } from "@/hooks/useRecipes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const CreateRecipe = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isEdit = !!id && id !== "new";

  const { data: existingRecipe } = useRecipe(isEdit ? id : undefined);
  const createRecipe = useCreateRecipe();
  const updateRecipe = useUpdateRecipe();

  const [title, setTitle] = useState("");
  const [servings, setServings] = useState(4);
  const [ingredients, setIngredients] = useState<Ingredient[]>([
    { name: "", quantity: "", unit: "", sort_order: 0 },
  ]);
  const [steps, setSteps] = useState<Step[]>([
    { step_number: 1, instruction: "" },
  ]);

  // Pre-fill from import or existing recipe
  useEffect(() => {
    const state = location.state as any;
    if (state?.imported) {
      setTitle(state.imported.title || "");
      setServings(state.imported.servings || 4);
      if (state.imported.ingredients?.length) {
        setIngredients(state.imported.ingredients.map((ing: any, i: number) => ({
          name: ing.name || "",
          quantity: ing.quantity || "",
          unit: ing.unit || "",
          sort_order: i,
        })));
      }
      if (state.imported.steps?.length) {
        setSteps(state.imported.steps.map((s: any, i: number) => ({
          step_number: i + 1,
          instruction: s.instruction || s,
        })));
      }
    }
  }, [location.state]);

  useEffect(() => {
    if (existingRecipe) {
      setTitle(existingRecipe.title);
      setServings(existingRecipe.servings);
      if (existingRecipe.ingredients.length) setIngredients(existingRecipe.ingredients);
      if (existingRecipe.steps.length) setSteps(existingRecipe.steps);
    }
  }, [existingRecipe]);

  const addIngredient = () => {
    setIngredients([...ingredients, { name: "", quantity: "", unit: "", sort_order: ingredients.length }]);
  };

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const updateIngredient = (index: number, field: keyof Ingredient, value: string) => {
    const updated = [...ingredients];
    (updated[index] as any)[field] = value;
    setIngredients(updated);
  };

  const addStep = () => {
    setSteps([...steps, { step_number: steps.length + 1, instruction: "" }]);
  };

  const removeStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, step_number: i + 1 })));
  };

  const updateStep = (index: number, value: string) => {
    const updated = [...steps];
    updated[index].instruction = value;
    setSteps(updated);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Please add a recipe title");
      return;
    }

    const validIngredients = ingredients.filter((i) => i.name.trim());
    const validSteps = steps.filter((s) => s.instruction.trim());

    try {
      if (isEdit) {
        await updateRecipe.mutateAsync({ id, title, servings, ingredients: validIngredients, steps: validSteps });
        toast.success("Recipe updated!");
        navigate(`/recipe/${id}`);
      } else {
        const recipe = await createRecipe.mutateAsync({ title, servings, ingredients: validIngredients, steps: validSteps });
        toast.success("Recipe saved!");
        navigate(`/recipe/${recipe.id}`);
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold">{isEdit ? "Edit Recipe" : "New Recipe"}</h1>
          <Button
            onClick={handleSave}
            disabled={createRecipe.isPending || updateRecipe.isPending}
            size="sm"
          >
            Save
          </Button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Title & Servings */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="Recipe title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-12 text-base"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="servings">Servings</Label>
            <Input
              id="servings"
              type="number"
              min={1}
              value={servings}
              onChange={(e) => setServings(parseInt(e.target.value) || 1)}
              className="h-12 text-base w-24"
            />
          </div>
        </div>

        {/* Ingredients */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <Label className="text-base">Ingredients</Label>
            <Button variant="ghost" size="sm" onClick={addIngredient}>
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </div>
          <div className="space-y-2">
            {ingredients.map((ing, i) => (
              <Card key={i} className="border-none">
                <CardContent className="p-3 flex gap-2 items-start">
                  <Input
                    placeholder="Qty"
                    value={ing.quantity}
                    onChange={(e) => updateIngredient(i, "quantity", e.target.value)}
                    className="w-16 h-10"
                  />
                  <Input
                    placeholder="Unit"
                    value={ing.unit}
                    onChange={(e) => updateIngredient(i, "unit", e.target.value)}
                    className="w-16 h-10"
                  />
                  <Input
                    placeholder="Ingredient name"
                    value={ing.name}
                    onChange={(e) => updateIngredient(i, "name", e.target.value)}
                    className="flex-1 h-10"
                  />
                  <Button variant="ghost" size="icon" onClick={() => removeIngredient(i)} className="shrink-0">
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Steps */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <Label className="text-base">Steps</Label>
            <Button variant="ghost" size="sm" onClick={addStep}>
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </div>
          <div className="space-y-2">
            {steps.map((step, i) => (
              <Card key={i} className="border-none">
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-2 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center shrink-0 font-semibold">
                      {i + 1}
                    </span>
                    <Textarea
                      placeholder={`Step ${i + 1} instructions...`}
                      value={step.instruction}
                      onChange={(e) => updateStep(i, e.target.value)}
                      className="flex-1 min-h-[60px]"
                    />
                    <Button variant="ghost" size="icon" onClick={() => removeStep(i)} className="shrink-0">
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default CreateRecipe;
