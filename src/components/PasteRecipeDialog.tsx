import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ClipboardPaste, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PasteRecipeDialog = () => {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleExtract = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("extract-recipe", {
        body: { text: text.trim() },
      });
      if (error) throw error;
      if (!data?.title) throw new Error("Could not extract recipe from this text");

      setOpen(false);
      setText("");
      navigate("/recipe/new", {
        state: {
          imported: {
            ...data,
            raw_recipe_text: text.trim(),
          },
        },
      });
      toast.success("Recipe extracted! Review and save.");
    } catch (error: any) {
      toast.error(error.message || "Failed to extract recipe");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ClipboardPaste className="w-4 h-4 mr-1" />
          Paste
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Paste a Recipe</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <Textarea
            placeholder="Paste your recipe text here — ingredients, steps, everything..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-h-[200px] text-base"
          />
          <Button
            onClick={handleExtract}
            disabled={loading || text.trim().length < 10}
            className="w-full h-12"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Extracting recipe...
              </>
            ) : (
              "Extract & Review"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PasteRecipeDialog;
