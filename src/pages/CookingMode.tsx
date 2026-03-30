import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useRecipe } from "@/hooks/useRecipes";
import { Button } from "@/components/ui/button";
import { X, ChevronLeft, ChevronRight, RotateCcw, Check, Timer } from "lucide-react";

const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const CookingMode = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: recipe } = useRecipe(id);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  // Timer state (P5)
  const [timerActive, setTimerActive] = useState(false);
  const [timerRemaining, setTimerRemaining] = useState<number | null>(null);

  const initTimer = useCallback((step: { duration_minutes?: number | null }) => {
    setTimerActive(false);
    setTimerRemaining(step.duration_minutes ? step.duration_minutes * 60 : null);
  }, []);

  // Reset timer when step changes
  useEffect(() => {
    if (recipe?.steps[currentStep]) {
      initTimer(recipe.steps[currentStep]);
    }
  }, [currentStep, recipe, initTimer]);

  // Countdown interval
  useEffect(() => {
    if (!timerActive || timerRemaining === null) return;
    if (timerRemaining <= 0) {
      setTimerActive(false);
      return;
    }
    const interval = setInterval(() => {
      setTimerRemaining((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [timerActive, timerRemaining]);

  if (!recipe || recipe.steps.length === 0) {
    return (
      <div className="min-h-screen bg-foreground text-background flex items-center justify-center">
        <p>No steps to display</p>
      </div>
    );
  }

  const steps = recipe.steps;
  const step = steps[currentStep];
  const isCompleted = completedSteps.has(currentStep);
  const timerDone = timerRemaining === 0;

  const toggleComplete = () => {
    const next = new Set(completedSteps);
    if (next.has(currentStep)) {
      next.delete(currentStep);
    } else {
      next.add(currentStep);
    }
    setCompletedSteps(next);
  };

  const goNext = () => {
    if (currentStep < steps.length - 1) setCurrentStep(currentStep + 1);
  };

  const goPrev = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const resetTimer = () => {
    setTimerActive(false);
    setTimerRemaining(step.duration_minutes ? step.duration_minutes * 60 : null);
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "hsl(20, 15%, 8%)", color: "hsl(30, 20%, 92%)" }}>
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-3">
        <Button
          variant="ghost"
          size="icon"
          className="text-inherit hover:bg-white/10"
          onClick={() => navigate(`/recipe/${id}`)}
        >
          <X className="w-6 h-6" />
        </Button>
        <span className="text-sm opacity-70">
          Step {currentStep + 1} of {steps.length}
        </span>
        <div className="w-10" />
      </header>

      {/* Progress dots */}
      <div className="flex gap-1.5 justify-center px-4 mb-4">
        {steps.map((_, i) => (
          <div
            key={i}
            className="h-1.5 rounded-full transition-all cursor-pointer"
            style={{
              flex: i === currentStep ? 2 : 1,
              backgroundColor: completedSteps.has(i)
                ? "hsl(145, 40%, 45%)"
                : i === currentStep
                ? "hsl(217, 91%, 60%)"
                : "hsla(30, 20%, 92%, 0.2)",
            }}
            onClick={() => setCurrentStep(i)}
          />
        ))}
      </div>

      {/* Timer (P5) — only shown when step has duration_minutes */}
      {timerRemaining !== null && (
        <div className="flex items-center justify-center gap-3 px-4 mb-2">
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-mono font-semibold transition-colors ${
              timerDone
                ? "bg-green-600/30 text-green-300"
                : timerActive
                ? "bg-blue-600/30 text-blue-200"
                : "bg-white/10 opacity-80"
            }`}
          >
            <Timer className="w-4 h-4 shrink-0" />
            <span>{timerDone ? "Done!" : formatTime(timerRemaining)}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-inherit hover:bg-white/10 text-xs"
            onClick={timerDone ? resetTimer : () => setTimerActive((a) => !a)}
          >
            {timerDone ? "Reset" : timerActive ? "Pause" : "Start"}
          </Button>
        </div>
      )}

      {/* Step content */}
      <div className="flex-1 flex items-center justify-center px-6 py-8">
        <p
          className={`text-2xl sm:text-3xl leading-relaxed text-center font-medium transition-opacity ${
            isCompleted ? "opacity-40 line-through" : ""
          }`}
        >
          {step.instruction}
        </p>
      </div>

      {/* Controls */}
      <div className="px-4 pb-8 pt-4 space-y-4">
        {/* Mark complete */}
        <Button
          variant={isCompleted ? "default" : "outline"}
          className={`w-full h-14 text-lg font-semibold ${
            isCompleted
              ? "bg-accent text-accent-foreground"
              : "border-white/20 text-inherit hover:bg-white/10"
          }`}
          onClick={toggleComplete}
        >
          <Check className="w-5 h-5 mr-2" />
          {isCompleted ? "Completed" : "Mark Complete"}
        </Button>

        {/* Nav buttons */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 h-14 text-lg border-white/20 text-inherit hover:bg-white/10"
            onClick={goPrev}
            disabled={currentStep === 0}
          >
            <ChevronLeft className="w-5 h-5 mr-1" />
            Prev
          </Button>
          <Button
            variant="outline"
            className="h-14 px-5 border-white/20 text-inherit hover:bg-white/10"
            onClick={resetTimer}
            disabled={timerRemaining === null}
          >
            <RotateCcw className="w-5 h-5" />
          </Button>
          <Button
            variant="outline"
            className="flex-1 h-14 text-lg border-white/20 text-inherit hover:bg-white/10"
            onClick={goNext}
            disabled={currentStep === steps.length - 1}
          >
            Next
            <ChevronRight className="w-5 h-5 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CookingMode;
