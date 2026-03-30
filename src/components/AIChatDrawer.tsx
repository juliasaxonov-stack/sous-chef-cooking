import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { RecipeWithDetails } from "@/hooks/useRecipes";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "What can I substitute?",
  "How do I know when it's done?",
  "Scale to 2 servings",
  "What's the hardest step?",
];

interface AIChatDrawerProps {
  recipe: RecipeWithDetails;
  onClose: () => void;
}

const AIChatDrawer = ({ recipe, onClose }: AIChatDrawerProps) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages, historyLoaded]);

  // Load persisted history on mount (P3)
  useEffect(() => {
    if (!user) return;
    supabase
      .from("recipe_chats")
      .select("messages")
      .eq("recipe_id", recipe.id)
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.messages && Array.isArray(data.messages)) {
          setMessages(data.messages as unknown as Message[]);
        }
        setHistoryLoaded(true);
      });
  }, [recipe.id, user]);

  // Persist history after every exchange (P3)
  const saveHistory = useCallback(async (msgs: Message[]) => {
    if (!user) return;
    await supabase.from("recipe_chats").upsert(
      { recipe_id: recipe.id, user_id: user.id, messages: msgs as unknown as import("@/integrations/supabase/types").Json },
      { onConflict: "recipe_id,user_id" }
    );
  }, [recipe.id, user]);

  // Build the structured recipe payload for the AI (P0)
  const buildRecipePayload = () => ({
    title: recipe.title,
    servings: recipe.servings,
    cuisine: recipe.cuisine ?? undefined,
    tags: recipe.tags?.length ? recipe.tags : undefined,
    ingredients: recipe.ingredients.map((i) => ({
      quantity: i.quantity || undefined,
      unit: i.unit || undefined,
      name: i.name,
      canonical_name: i.canonical_name || undefined,
      preparation: i.preparation || undefined,
      optional: i.optional ?? false,
    })),
    steps: recipe.steps.map((s) => ({
      position: s.position,
      instruction: s.instruction,
      duration_minutes: s.duration_minutes ?? undefined,
      action_type: s.action_type ?? undefined,
    })),
  });

  const sendMessage = async (content: string) => {
    if (!content.trim() || loading) return;

    const userMsg: Message = { role: "user", content };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("chat", {
        body: {
          messages: updated,
          recipe: buildRecipePayload(),
        },
      });
      if (error) throw error;
      const finalMessages = [...updated, { role: "assistant" as const, content: data.reply }];
      setMessages(finalMessages);
      saveHistory(finalMessages);
    } catch {
      const errorMessages = [...updated, { role: "assistant" as const, content: "Sorry, I couldn't process that. Try again." }];
      setMessages(errorMessages);
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = async () => {
    setMessages([]);
    if (user) {
      await supabase
        .from("recipe_chats")
        .delete()
        .eq("recipe_id", recipe.id)
        .eq("user_id", user.id);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm">
      <header className="flex items-center justify-between px-4 py-3 border-b">
        <h2 className="text-lg font-semibold">AI Assistant</h2>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={clearHistory}>
              Clear
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {!historyLoaded ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading conversation...
          </div>
        ) : messages.length === 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Ask me anything about this recipe:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <Button key={s} variant="outline" size="sm" onClick={() => sendMessage(s)}>
                  {s}
                </Button>
              ))}
            </div>
          </div>
        ) : null}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
              msg.role === "user"
                ? "ml-auto bg-primary text-primary-foreground"
                : "bg-card"
            }`}
          >
            {msg.content}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Thinking...
          </div>
        )}
      </div>

      <div className="border-t px-4 py-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
          className="flex gap-2"
        >
          <Input
            placeholder="Ask about this recipe..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 h-12"
          />
          <Button type="submit" size="icon" className="h-12 w-12" disabled={loading || !input.trim()}>
            <Send className="w-5 h-5" />
          </Button>
        </form>
      </div>
    </div>
  );
};

export default AIChatDrawer;
