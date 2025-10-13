/**
 * STEP PLAYER - Bottom bar player controls
 *
 * Like Spotify player: Prev | Play/Pause | Next
 * Progress bar showing current step
 */

import { ChevronLeft, ChevronRight, Play, Pause } from "lucide-react";

interface StepPlayerProps {
  currentStep: number;
  totalSteps: number;
  isPlaying: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onPlayPause: () => void;
  onSeek: (stepIndex: number) => void;
  stepTitles?: string[];
}

export function StepPlayer({
  currentStep,
  totalSteps,
  isPlaying,
  onPrevious,
  onNext,
  onPlayPause,
  onSeek,
  stepTitles = [],
}: StepPlayerProps) {
  const hasPrevious = currentStep > 0;
  const hasNext = currentStep < totalSteps - 1;
  const progress = totalSteps > 0 ? ((currentStep + 1) / totalSteps) * 100 : 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 h-20 bg-background/95 border-t border-border z-40 backdrop-blur-md">
      <div className="h-full flex items-center gap-8 px-8">
        {/* Left: Current Step Info */}
        <div className="flex-1 min-w-0 max-w-md">
          <div className="text-sm font-semibold text-foreground truncate">
            {totalSteps > 0
              ? stepTitles[currentStep] || `Step ${currentStep + 1}`
              : "No steps yet"}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {totalSteps > 0
              ? `${currentStep + 1} of ${totalSteps}`
              : "Create a step to start"}
          </div>
        </div>

        {/* Center: Player Controls */}
        <div className="flex items-center gap-4 flex-shrink-0">
          <button
            onClick={onPrevious}
            disabled={!hasPrevious}
            className="p-2 rounded-full hover:bg-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-foreground"
            title="Previous step"
          >
            <ChevronLeft size={24} />
          </button>

          <button
            onClick={onPlayPause}
            disabled={totalSteps === 0}
            className="p-3 rounded-full bg-success hover:bg-success/90 text-success-foreground transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-success/20"
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause size={24} fill="currentColor" />
            ) : (
              <Play size={24} fill="currentColor" />
            )}
          </button>

          <button
            onClick={onNext}
            disabled={!hasNext}
            className="p-2 rounded-full hover:bg-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-foreground"
            title="Next step"
          >
            <ChevronRight size={24} />
          </button>
        </div>

        {/* Right: Progress Bar */}
        <div className="flex-1 min-w-0 max-w-md flex items-center gap-3">
          <span className="text-xs text-muted-foreground tabular-nums flex-shrink-0">
            {currentStep + 1}/{totalSteps || 0}
          </span>

          <div
            className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden cursor-pointer min-w-[100px]"
            onClick={(e) => {
              if (totalSteps === 0) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const percent = x / rect.width;
              const targetStep = Math.floor(percent * totalSteps);
              onSeek(Math.max(0, Math.min(totalSteps - 1, targetStep)));
            }}
          >
            <div
              className="h-full bg-success transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
