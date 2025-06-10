import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@deco/ui/components/form.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { Textarea } from "@deco/ui/components/textarea.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import { Label } from "@deco/ui/components/label.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useAgent, useAgentStub } from "@deco/sdk";
import { useAgentSettingsForm } from "../agent/edit.tsx";

// Framework definitions with their fields and reference URLs
const FRAMEWORKS = {
  Freestyle: {
    name: "Freestyle",
    description: "No structured framework, just a freeform prompt.",
    fields: {},
    referenceUrl: null,
  },
  RTF: {
    name: "RTF Framework",
    description: "Role / Task / Format framework.",
    fields: {
      role: {
        label: "Role",
        description: "Who should the AI act as? (e.g., 'a helpful tutor')",
      },
      task: {
        label: "Task", 
        description: "What should the AI do? (the objective or task, e.g., 'explain quantum physics')",
      },
      format: {
        label: "Format",
        description: "How should the AI respond? (e.g., 'in bullet points' or 'as a story')",
      },
    },
    referenceUrl: "https://thepromptwarrior.com/rtf-framework/",
  },
  CLEAR: {
    name: "CLEAR Framework",
    description: "Context / Length / Explicitness / Audience / Role.",
    fields: {
      context: {
        label: "Context",
        description: "What's the background or scenario? (Provide any necessary context or situation)",
      },
      length: {
        label: "Length",
        description: "How long should the response be? (e.g., 'one paragraph' or '500 words')",
      },
      explicitness: {
        label: "Explicitness", 
        description: "What specific details must be covered? (Any specific content or requirements)",
      },
      audience: {
        label: "Audience",
        description: "Who is the output for? (Describe the target reader or audience)",
      },
      role: {
        label: "Role",
        description: "What persona should the AI assume? (Specify a perspective or character)",
      },
    },
    referenceUrl: "https://guides.library.georgetown.edu/c.php?g=1306346&p=9616780",
  },
  CREATE: {
    name: "CREATE Framework", 
    description: "Context / Role / Expectation / Audience / Tone / Examples.",
    fields: {
      context: {
        label: "Context",
        description: "Provide any necessary background. (The situation or content context)",
      },
      role: {
        label: "Role",
        description: "Who is the AI? (Define the assistant's persona or role)",
      },
      expectation: {
        label: "Expectation",
        description: "What should the AI accomplish? (Clarify the goal or expected output)",
      },
      audience: {
        label: "Audience", 
        description: "Who is this written for? (Define the target audience)",
      },
      tone: {
        label: "Tone",
        description: "What voice or mood should the response have? (e.g., formal, casual, humorous)",
      },
      examples: {
        label: "Examples",
        description: "Include a sample or template if needed. (Example input-output or template)",
      },
    },
    referenceUrl: "https://medium.com/@promptengineering/chatgpt-power-prompts-c-r-e-a-t-e-framework-95f8cf6e8a8c",
  },
  SMART: {
    name: "SMART Framework",
    description: "Specific / Measurable / Achievable / Relevant / Time-bound.",
    fields: {
      specific: {
        label: "Specific",
        description: "What is the exact task? (Clearly define what you want, leaving no ambiguity)",
      },
      measurable: {
        label: "Measurable", 
        description: "What defines success? (How will you know it did a good job?)",
      },
      achievable: {
        label: "Achievable",
        description: "Is the task realistic for the AI? (Specify constraints or clarify scope)",
      },
      relevant: {
        label: "Relevant",
        description: "Why is it important? (Tie the request to the context or goal)",
      },
      timeBound: {
        label: "Time-bound",
        description: "Is there a deadline or timeframe? (If relevant, mention time constraints)",
      },
    },
    referenceUrl: "https://www.smartsheet.com/content/smart-goals",
  },
  CoT: {
    name: "Chain of Thought",
    description: "Prompt Instruction / Reasoning Steps.",
    fields: {
      promptInstruction: {
        label: "Prompt Instruction", 
        description: "The task or question – essentially the main user query or instruction",
      },
      reasoningSteps: {
        label: "Reasoning Steps",
        description: "Ask the model to reason step-by-step. (e.g., 'Let's solve this step by step')",
      },
    },
    referenceUrl: "https://www.promptingguide.ai/techniques/cot",
  },
  Google: {
    name: "Google Gemini Prompt Guide",
    description: "Role / Instruction / Context / Output Constraints.",
    fields: {
      role: {
        label: "Role",
        description: "Define the AI's role. (e.g., 'You are a travel agent AI...')",
      },
      instruction: {
        label: "Instruction",
        description: "Give specific task instructions. (The actual command or question)",
      },
      context: {
        label: "Context", 
        description: "Include relevant background. (Any extra info the AI should know)",
      },
      outputConstraints: {
        label: "Output Constraints",
        description: "Specify format/length/tone if any. (e.g., 'Answer in JSON' or 'Use a professional tone')",
      },
    },
    referenceUrl: "https://cloud.google.com/vertex-ai/generative-ai/docs/learn/prompts/prompt-design-strategies",
  },
} as const;

type FrameworkKey = keyof typeof FRAMEWORKS;

interface FrameworkData {
  [key: string]: {
    [field: string]: string;
  };
}

function PromptTab() {
  const { form, handleSubmit } = useAgentSettingsForm();
  
  // Get agent data for model info
  const agentId = form.getValues("id");
  const { data: agent } = useAgent(agentId);
  const threadId = useMemo(() => crypto.randomUUID(), []);
  const agentStub = useAgentStub(agentId, threadId);
  
  // State for framework selection and field data
  const [selectedFramework, setSelectedFramework] = useState<FrameworkKey>("Freestyle");
  const [promptData, setPromptData] = useState<FrameworkData>({
    Freestyle: { content: "" },
    RTF: { role: "", task: "", format: "" },
    CLEAR: { context: "", length: "", explicitness: "", audience: "", role: "" },
    CREATE: { context: "", role: "", expectation: "", audience: "", tone: "", examples: "" },
    SMART: { specific: "", measurable: "", achievable: "", relevant: "", timeBound: "" },
    CoT: { promptInstruction: "", reasoningSteps: "" },
    Google: { role: "", instruction: "", context: "", outputConstraints: "" },
  });
  
  // State for AI transformation
  const [isTransforming, setIsTransforming] = useState(false);
  const [transformError, setTransformError] = useState<string | null>(null);
  
  // Track if we've initialized from form to avoid infinite loops
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize freestyle content from form value only once
  useEffect(() => {
    if (!isInitialized) {
      const currentInstructions = form.getValues("instructions") || "";
      setPromptData(prev => ({
        ...prev,
        Freestyle: { content: currentInstructions }
      }));
      setIsInitialized(true);
    }
  }, [isInitialized, form]);

  // Update form when framework data changes - but debounced and optimized
  const updateFormValue = useCallback((finalPrompt: string) => {
    const currentValue = form.getValues("instructions");
    if (currentValue !== finalPrompt) {
      form.setValue("instructions", finalPrompt, { shouldDirty: true });
    }
  }, [form]);

  // Memoize the final prompt calculation
  const finalPrompt = useMemo(() => {
    if (selectedFramework === "Freestyle") {
      return promptData.Freestyle?.content || "";
    } else {
      const frameworkFields = FRAMEWORKS[selectedFramework].fields;
      const fieldValues = Object.keys(frameworkFields)
        .map(key => promptData[selectedFramework]?.[key] || "")
        .filter(value => value.trim() !== "")
        .join("\n");
      return fieldValues;
    }
  }, [promptData, selectedFramework]);

  // Update form when final prompt changes
  useEffect(() => {
    updateFormValue(finalPrompt);
  }, [finalPrompt, updateFormValue]);

  // Transform freestyle prompt using AI
  const transformPrompt = useCallback(async (targetFramework: FrameworkKey, freestyleContent: string) => {
    if (!freestyleContent.trim() || targetFramework === "Freestyle") return;
    
    setIsTransforming(true);
    setTransformError(null);
    
    try {
      // Check if agentStub is properly initialized
      if (!agentStub) {
        throw new Error("Agent stub is not initialized");
      }

      // Validate that agentId is a UUID, not a model ID
      if (!agentId || agentId.includes(":") || agentId.includes("-") === false) {
        throw new Error(`Invalid agentId format: ${agentId}. Expected UUID format.`);
      }

      console.log('Agent stub:', agentStub);
      console.log('Agent ID:', agentId);
      console.log('Thread ID:', threadId);
      console.log('Agent data:', agent);

      const framework = FRAMEWORKS[targetFramework];
      const fieldDescriptions = Object.entries(framework.fields)
        .map(([key, field]) => `${field.label}: ${field.description}`)
        .join('\n');
      
      const transformationPrompt = `You are a prompt engineering expert. I need you to transform a freestyle system prompt into the structured ${framework.name} framework.

The ${framework.name} framework has these fields:
${fieldDescriptions}

Please analyze the following freestyle prompt and extract the relevant information for each field. If a field is not clearly present in the original prompt, leave it empty or provide a reasonable inference based on the context.

Freestyle prompt to transform:
"${freestyleContent}"

Please respond with a JSON object where each key corresponds to a framework field and the value is the extracted or inferred content for that field. Only include non-empty values.`;

      // Create proper JSON Schema
      const jsonSchema = {
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "object",
        properties: Object.entries(framework.fields).reduce((acc, [fieldKey, fieldConfig]) => {
          acc[fieldKey] = { 
            type: "string", 
            description: fieldConfig.description 
          };
          return acc;
        }, {} as Record<string, { type: string; description: string }>),
        additionalProperties: false,
      };

      console.log('Calling generateObject with:', {
        agentId,
        threadId,
        prompt: transformationPrompt.substring(0, 200) + '...',
        schema: jsonSchema
      });
      
      const result = await agentStub.generateObject(
        [{ 
          id: crypto.randomUUID(), 
          role: "user", 
          content: transformationPrompt 
        }],
        jsonSchema
      );

      console.log('generateObject result:', result);

      // Update the framework data with the transformed results
      setPromptData(prev => ({
        ...prev,
        [targetFramework]: {
          ...prev[targetFramework],
          ...result.object,
        },
      }));
      
    } catch (error) {
      console.error('Full error object:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        cause: error instanceof Error ? error.cause : undefined
      });
      
      let errorMessage = 'Failed to transform prompt';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object') {
        errorMessage = JSON.stringify(error, null, 2);
      }
      
      setTransformError(errorMessage);
    } finally {
      setIsTransforming(false);
    }
  }, [agentStub, agentId, agent, threadId]);

  const handleFrameworkChange = useCallback(async (newFramework: FrameworkKey) => {
    // Just switch frameworks without automatic transformation
    setSelectedFramework(newFramework);
  }, []);

  const handleFieldChange = useCallback((field: string, value: string) => {
    setPromptData(prev => ({
      ...prev,
      [selectedFramework]: {
        ...prev[selectedFramework],
        [field]: value,
      },
    }));
  }, [selectedFramework]);

  const handleFreestyleChange = useCallback((value: string) => {
    setPromptData(prev => ({
      ...prev,
      Freestyle: { content: value },
    }));
  }, []);

  const handleManualTransform = useCallback(() => {
    const freestyleContent = promptData.Freestyle?.content?.trim();
    if (freestyleContent && selectedFramework !== "Freestyle") {
      transformPrompt(selectedFramework, freestyleContent);
    }
  }, [promptData.Freestyle?.content, selectedFramework, transformPrompt]);

  const renderFrameworkHeader = (framework: FrameworkKey) => {
    const config = FRAMEWORKS[framework];
    if (framework === "Freestyle" || !config.referenceUrl) return null;
    
    return (
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <h3 className="text-lg font-semibold text-gray-900">{config.name}</h3>
          <a 
            href={config.referenceUrl} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="ml-2 text-blue-600 hover:text-blue-800 transition-colors"
            aria-label="Open framework reference"
          >
            <Icon name="open_in_new" size={16} />
          </a>
        </div>
        
        {/* Transform button for frameworks */}
        {promptData.Freestyle?.content?.trim() && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleManualTransform}
            disabled={isTransforming}
            className="text-xs"
          >
            {isTransforming ? (
              <>
                <Spinner size="xs" />
                <span className="ml-2">Transforming...</span>
              </>
            ) : (
              <>
                <Icon name="auto_fix_high" size={14} className="mr-1" />
                Transform from Freestyle
              </>
            )}
          </Button>
        )}
      </div>
    );
  };

  const renderFrameworkFields = (framework: FrameworkKey) => {
    if (framework === "Freestyle") {
      return (
        <FormField
          name="instructions"
          render={() => (
            <FormItem>
              <FormControl>
                <Textarea
                  placeholder="Add context or behavior to shape responses (e.g., 'Be concise and reply in English.')"
                  className="min-h-[170px] h-full border-border"
                  value={promptData.Freestyle?.content || ""}
                  onChange={(e) => handleFreestyleChange(e.target.value)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      );
    }

    const config = FRAMEWORKS[framework];
    const fields = Object.entries(config.fields);
    
    return (
      <div className="space-y-4">
        {renderFrameworkHeader(framework)}
        
        {/* Show transformation status */}
        {isTransforming && (
          <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <Spinner size="sm" />
            <span className="text-sm text-blue-700">Transforming your freestyle prompt...</span>
          </div>
        )}
        
        {/* Show transformation error */}
        {transformError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-700">
              <Icon name="error" size={16} className="inline mr-1" />
              Error transforming prompt: {transformError}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setTransformError(null)}
              className="mt-2 text-xs"
            >
              Dismiss
            </Button>
          </div>
        )}
        
        <div className="grid grid-cols-1 gap-4">
          {fields.map(([fieldKey, fieldConfig]) => (
            <div key={fieldKey} className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">
                {fieldConfig.label}
              </Label>
              <p className="text-sm text-gray-500">
                {fieldConfig.description}
              </p>
              <Textarea
                value={promptData[framework]?.[fieldKey] || ""}
                onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
                className="min-h-[80px] w-full border border-gray-300 rounded-md p-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
                rows={3}
                placeholder={`Enter ${fieldConfig.label.toLowerCase()}...`}
                disabled={isTransforming}
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <ScrollArea className="h-full w-full">
      <Form {...form}>
        <div className="h-full w-full p-4 pt-2 mx-auto max-w-4xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Framework Selector */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">
                Prompt Framework
              </Label>
              <Select value={selectedFramework} onValueChange={handleFrameworkChange}>
                <SelectTrigger className="w-full max-w-xs px-6 py-4 h-auto min-h-[60px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FRAMEWORKS).map(([key, framework]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex flex-col items-start py-2">
                        <span className="font-medium">{framework.name}</span>
                        <span className="text-xs text-gray-500">{framework.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Framework Content */}
            <div className="border rounded-lg p-4 bg-gray-50/50">
              {renderFrameworkFields(selectedFramework)}
            </div>
          </form>
        </div>
      </Form>
    </ScrollArea>
  );
}

export default PromptTab;
