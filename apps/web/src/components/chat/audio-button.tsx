import type React from "react";
import { useCallback, useEffect, useState } from "react";
import type {
  SpeechRecognition,
  SpeechRecognitionError,
  SpeechRecognitionEvent,
} from "../../types/speech.d.ts";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { cn } from "@deco/ui/lib/utils.ts";

interface AudioButtonProps {
  onMessage: (message: string) => void;
  className?: string;
}

export const AudioButton: React.FC<AudioButtonProps> = ({
  onMessage,
  className,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(
    null,
  );

  useEffect(() => {
    if (
      (typeof globalThis !== "undefined" &&
        "SpeechRecognition" in globalThis) ||
      "webkitSpeechRecognition" in globalThis
    ) {
      const SpeechRecognition =
        globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;

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
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggleListening}
      className={cn(
        "size-8 rounded-full transition-colors text-muted-foreground",
        className,
      )}
      title={isListening ? "Stop recording" : "Start voice input"}
    >
      <Icon name={isListening ? "stop" : "mic"} size={20} />
    </Button>
  );
};
