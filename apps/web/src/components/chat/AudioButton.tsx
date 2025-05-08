import { useCallback, useEffect, useState } from "react";
import { Button } from "@deco/ui/components/button.tsx";
import type {
  SpeechRecognition,
  SpeechRecognitionError,
  SpeechRecognitionEvent,
} from "../../types/speech.d.ts";
import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.js";

interface AudioButtonProps {
  onMessage: (message: string) => void;
}

export const AudioButton: React.FC<AudioButtonProps> = ({ onMessage }) => {
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(
    null,
  );

  useEffect(() => {
    if (
      typeof window !== "undefined" && "SpeechRecognition" in window ||
      "webkitSpeechRecognition" in window
    ) {
      const SpeechRecognition = window.SpeechRecognition ||
        window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "pt-BR";

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = Array.from(event.results)
          .map((result) => result[0])
          .map((result) => result.transcript)
          .join("");

        if (event.results[0].isFinal) {
          onMessage(transcript);
        }
      };

      recognition.onerror = (event: SpeechRecognitionError) => {
        if (event.error === "aborted") {
          // Ignore aborted errors as they're expected when stopping recognition
          return;
        }
        setIsListening(false);
      };

      setRecognition(recognition);

      return () => {
        if (recognition) {
          try {
            recognition.stop();
          } catch (_e) {
            // Ignore errors when stopping recognition during cleanup
          }
        }
      };
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (!recognition) return;

    try {
      if (isListening) {
        recognition.stop();
        setIsListening(false);
      } else {
        recognition.start();
        setIsListening(true);
      }
    } catch (error) {
      console.error("Error toggling speech recognition:", error);
      setIsListening(false);
    }
  }, [recognition, isListening]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex gap-4">
        <Button
          type="button"
          variant={isListening ? "default" : "outline"}
          size="icon"
          onClick={toggleListening}
          className="h-8 w-8 rounded-full cursor-pointer"
        >
          <Icon
            className={cn(
              "text-sm",
            )}
            filled={true}
            name={isListening ? "stop" : "mic"}
          />
        </Button>
      </div>
    </div>
  );
};
