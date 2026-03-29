import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Link as LinkIcon, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const ImportRecipeDialog = () => {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleImport = async () => {
    if (!url.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("import-recipe", {
        body: { url: url.trim() },
      });
      if (error) throw error;
      if (!data?.title) throw new Error("Could not extract recipe from this URL");

      setOpen(false);
      setUrl("");
      navigate("/recipe/new", { state: { imported: data } });
      toast.success("Recipe imported! Review and save.");
    } catch (error: any) {
      toast.error(error.message || "Failed to import recipe");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <LinkIcon className="w-4 h-4 mr-1" />
          Import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Import from URL</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <Input
            placeholder="https://example.com/recipe..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="h-12 text-base"
          />
          <Button
            onClick={handleImport}
            disabled={loading || !url.trim()}
            className="w-full h-12"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Extracting recipe...
              </>
            ) : (
              "Import Recipe"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImportRecipeDialog;
