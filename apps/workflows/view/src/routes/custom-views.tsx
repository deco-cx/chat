import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "../main";
import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { client } from "../lib/rpc";
import { ViewRenderer } from "../components/ViewRenderer";
import type { ViewDefinition } from "../../../shared/types/views";
import { Button } from "@deco/ui/components/button";
import {
  Sparkles,
  Code,
  Eye,
  CheckCircle2,
  Wand2,
  Palette,
  Copy,
  Terminal,
  Zap,
  Heart,
} from "lucide-react";
import { toast } from "sonner";

function CustomViewsPage() {
  const [purpose, setPurpose] = useState("");
  const [viewType, setViewType] = useState<"input" | "output">("output");
  const [dataSchema, setDataSchema] = useState(
    JSON.stringify(
      {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          status: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                value: { type: "string" },
              },
            },
          },
        },
      },
      null,
      2,
    ),
  );

  const [generatedView, setGeneratedView] = useState<ViewDefinition | null>(
    null,
  );
  const [reasoning, setReasoning] = useState("");
  const [exampleData, setExampleData] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [showJson, setShowJson] = useState(false);
  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  const [showExamples, setShowExamples] = useState(false);

  // Easter egg: drawing mode
  const [drawMode, setDrawMode] = useState(false);
  const [clicks, setClicks] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const generateView = useMutation({
    mutationFn: async () => {
      const schema = JSON.parse(dataSchema);
      return await client.GENERATE_VIEW({
        purpose,
        viewType,
        dataSchema: schema,
      });
    },
    onSuccess: (data) => {
      setGeneratedView(data.view);
      setReasoning(data.reasoning);
      setExampleData(data.exampleData || null);
      setShowJson(false);
      toast.success("✨ View generated! Looking good!", {
        description: "Check out the preview on the right →",
      });
    },
    onError: (error) => {
      toast.error("Oops! Something went wrong", {
        description: String(error),
      });
    },
  });

  const getExamples = useMutation({
    mutationFn: async () => {
      return await client.GET_VIEW_EXAMPLES({ viewType: "both" });
    },
    onSuccess: (data) => {
      setShowExamples(true);
      toast.success(
        `🎨 Loaded ${data.examples.length} examples for inspiration`,
      );
    },
  });

  const validateView = useMutation({
    mutationFn: async (view: Record<string, unknown>) => {
      return await client.VALIDATE_VIEW({ view });
    },
  });

  const loadExample = (example: {
    name: string;
    description: string;
    viewType: "input" | "output";
    view: ViewDefinition;
    exampleData?: Record<string, unknown>;
  }) => {
    setGeneratedView(example.view);
    setExampleData(example.exampleData || null);
    setPurpose(example.description);
    setViewType(example.viewType);
    setReasoning(`Example: ${example.name}`);
    setShowJson(false);
    setShowExamples(false);
    toast.success(`📦 Loaded: ${example.name}`);
  };

  const handleGenerate = () => {
    if (!purpose.trim()) {
      toast.error("Hold up! Tell me what you want to build");
      return;
    }

    try {
      JSON.parse(dataSchema);
      generateView.mutate();
    } catch (e) {
      toast.error("Hmm, that schema doesn't look right", {
        description: "Check your JSON syntax",
      });
    }
  };

  const handleValidate = () => {
    if (!generatedView) {
      toast.error("No view to validate yet!");
      return;
    }

    validateView.mutate(generatedView as Record<string, unknown>, {
      onSuccess: (data) => {
        if (data.valid) {
          toast.success("✅ Perfect! This view is valid");
        } else {
          toast.error("❌ View has some issues", {
            description: data.errors?.join(", "),
          });
        }
      },
    });
  };

  const copyToClipboard = () => {
    if (!generatedView) return;
    navigator.clipboard.writeText(JSON.stringify(generatedView, null, 2));
    toast.success("📋 Copied to clipboard!");
  };

  const copyWorkflowExample = () => {
    const example = `// Add this to your WorkflowStep:
const step: WorkflowStep = {
  id: "step-1",
  name: "My Step",
  // ... other fields ...
  
  ${viewType}View: ${JSON.stringify(generatedView, null, 2)}
};`;
    navigator.clipboard.writeText(example);
    toast.success("📋 Workflow example copied!");
  };

  // Easter egg activation
  const handleLogoClick = () => {
    setClicks((prev) => prev + 1);
    if (clicks >= 4) {
      setDrawMode(!drawMode);
      toast(drawMode ? "👋 Bye canvas!" : "🎨 Draw mode activated!", {
        description: drawMode
          ? "Back to serious work"
          : "Click and drag to draw!",
      });
      setClicks(0);
    }
  };

  // Drawing canvas logic
  useEffect(() => {
    if (!drawMode || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;

    const startDrawing = (e: MouseEvent) => {
      isDrawing = true;
      [lastX, lastY] = [e.offsetX, e.offsetY];
    };

    const draw = (e: MouseEvent) => {
      if (!isDrawing) return;

      ctx.strokeStyle = "#ff6b4a";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(e.offsetX, e.offsetY);
      ctx.stroke();

      [lastX, lastY] = [e.offsetX, e.offsetY];
    };

    const stopDrawing = () => {
      isDrawing = false;
    };

    canvas.addEventListener("mousedown", startDrawing);
    canvas.addEventListener("mousemove", draw);
    canvas.addEventListener("mouseup", stopDrawing);
    canvas.addEventListener("mouseout", stopDrawing);

    return () => {
      canvas.removeEventListener("mousedown", startDrawing);
      canvas.removeEventListener("mousemove", draw);
      canvas.removeEventListener("mouseup", stopDrawing);
      canvas.removeEventListener("mouseout", stopDrawing);
    };
  }, [drawMode]);

  return (
    <div
      className="min-h-screen p-6 relative"
      style={{ backgroundColor: "#0a0a0a" }}
    >
      {/* Animated gradient background */}
      <div className="fixed inset-0 opacity-20 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 20% 50%, rgba(255, 107, 74, 0.1) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(212, 175, 55, 0.1) 0%, transparent 50%)",
            animation: "pulse 8s ease-in-out infinite",
          }}
        />
      </div>

      {/* Drawing canvas overlay */}
      {drawMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="relative">
            <canvas
              ref={canvasRef}
              width={800}
              height={600}
              className="border-4 rounded-lg"
              style={{ borderColor: "#ff6b4a", backgroundColor: "#1a1a1a" }}
            />
            <button
              onClick={() => {
                const ctx = canvasRef.current?.getContext("2d");
                if (ctx) {
                  ctx.clearRect(0, 0, 800, 600);
                  toast.success("🧹 Canvas cleared!");
                }
              }}
              className="absolute top-4 right-4 px-4 py-2 bg-[#ff6b4a] rounded-lg text-white text-sm font-medium"
            >
              Clear
            </button>
            <button
              onClick={() => setDrawMode(false)}
              className="absolute top-4 left-4 px-4 py-2 bg-[#2a2a2a] rounded-lg text-white text-sm font-medium"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <button onClick={handleLogoClick} className="group relative">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center transition-all group-hover:scale-110"
                  style={{
                    background:
                      "linear-gradient(135deg, #ff6b4a 0%, #d4af37 100%)",
                  }}
                >
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                {clicks > 0 && clicks < 5 && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-[#ff6b4a] rounded-full flex items-center justify-center text-xs text-white font-bold">
                    {clicks}
                  </div>
                )}
              </button>

              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-[#ff6b4a] to-[#d4af37] bg-clip-text text-transparent">
                  View Playground
                </h1>
                <p className="text-sm text-gray-400 mt-1">
                  Generate & test custom views for your workflows ✨
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowExamples(!showExamples)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105"
                style={{
                  backgroundColor: showExamples ? "#ff6b4a" : "#2a2a2a",
                  color: "#ffffff",
                  border: "1px solid #3a3a3a",
                }}
              >
                <Palette className="w-4 h-4 inline mr-2" />
                {showExamples ? "Hide" : "Get"} Inspiration
              </button>
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-4">
            <div
              className="p-4 rounded-xl"
              style={{
                backgroundColor: "#1a1a1a",
                border: "1px solid #2a2a2a",
              }}
            >
              <div className="text-xs text-gray-400 mb-1">Components</div>
              <div className="text-2xl font-bold text-white">13</div>
              <div className="text-xs text-gray-500 mt-1">Available to use</div>
            </div>
            <div
              className="p-4 rounded-xl"
              style={{
                backgroundColor: "#1a1a1a",
                border: "1px solid #2a2a2a",
              }}
            >
              <div className="text-xs text-gray-400 mb-1">View Types</div>
              <div className="text-2xl font-bold text-white">2</div>
              <div className="text-xs text-gray-500 mt-1">Input & Output</div>
            </div>
            <div
              className="p-4 rounded-xl"
              style={{
                backgroundColor: "#1a1a1a",
                border: "1px solid #2a2a2a",
              }}
            >
              <div className="text-xs text-gray-400 mb-1">Examples</div>
              <div className="text-2xl font-bold text-white">5</div>
              <div className="text-xs text-gray-500 mt-1">Ready templates</div>
            </div>
          </div>
        </div>

        {/* Examples panel */}
        {showExamples && getExamples.data && (
          <div
            className="mb-6 p-6 rounded-xl animate-in slide-in-from-top duration-300"
            style={{ backgroundColor: "#1a1a1a", border: "1px solid #2a2a2a" }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">
                ✨ Example Templates
              </h3>
              <button
                onClick={() => setShowExamples(false)}
                className="text-gray-400 hover:text-white text-sm"
              >
                Close
              </button>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              {getExamples.data.examples.map((example, i) => (
                <button
                  key={i}
                  onClick={() => loadExample(example)}
                  className="text-left p-4 rounded-lg transition-all hover:scale-[1.02]"
                  style={{
                    backgroundColor: "#242424",
                    border: "1px solid #3a3a3a",
                  }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="font-medium text-white">{example.name}</div>
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        example.viewType === "output"
                          ? "bg-green-500/20 text-green-400"
                          : "bg-blue-500/20 text-blue-400"
                      }`}
                    >
                      {example.viewType}
                    </span>
                  </div>
                  <div className="text-sm text-gray-400">
                    {example.description}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left: Generator */}
          <div className="space-y-4">
            {/* View Type Selector */}
            <div
              className="p-6 rounded-xl"
              style={{
                backgroundColor: "#1a1a1a",
                border: "1px solid #2a2a2a",
              }}
            >
              <label className="block text-sm font-medium text-gray-300 mb-3">
                What are you building?
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setViewType("output")}
                  className={`p-4 rounded-lg transition-all hover:scale-[1.02] ${
                    viewType === "output" ? "ring-2 ring-[#ff6b4a]" : ""
                  }`}
                  style={{
                    backgroundColor:
                      viewType === "output" ? "#ff6b4a" : "#242424",
                    border: "1px solid #3a3a3a",
                  }}
                >
                  <Eye
                    className="w-5 h-5 mb-2"
                    style={{
                      color: viewType === "output" ? "#fff" : "#9ca3af",
                    }}
                  />
                  <div
                    className="font-medium"
                    style={{
                      color: viewType === "output" ? "#fff" : "#9ca3af",
                    }}
                  >
                    Output View
                  </div>
                  <div
                    className="text-xs mt-1"
                    style={{
                      color:
                        viewType === "output"
                          ? "rgba(255,255,255,0.7)"
                          : "#6b7280",
                    }}
                  >
                    Display data beautifully
                  </div>
                </button>
                <button
                  onClick={() => setViewType("input")}
                  className={`p-4 rounded-lg transition-all hover:scale-[1.02] ${
                    viewType === "input" ? "ring-2 ring-[#ff6b4a]" : ""
                  }`}
                  style={{
                    backgroundColor:
                      viewType === "input" ? "#ff6b4a" : "#242424",
                    border: "1px solid #3a3a3a",
                  }}
                >
                  <Terminal
                    className="w-5 h-5 mb-2"
                    style={{ color: viewType === "input" ? "#fff" : "#9ca3af" }}
                  />
                  <div
                    className="font-medium"
                    style={{ color: viewType === "input" ? "#fff" : "#9ca3af" }}
                  >
                    Input View
                  </div>
                  <div
                    className="text-xs mt-1"
                    style={{
                      color:
                        viewType === "input"
                          ? "rgba(255,255,255,0.7)"
                          : "#6b7280",
                    }}
                  >
                    Create custom forms
                  </div>
                </button>
              </div>
            </div>

            {/* Purpose */}
            <div
              className="p-6 rounded-xl"
              style={{
                backgroundColor: "#1a1a1a",
                border: "1px solid #2a2a2a",
              }}
            >
              <label className="block text-sm font-medium text-gray-300 mb-3">
                <Wand2 className="w-4 h-4 inline mr-2" />
                Describe what you want
              </label>
              <input
                type="text"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="e.g., Show user profile with status badges"
                className="w-full px-4 py-3 rounded-lg text-sm transition-all focus:ring-2 focus:ring-[#ff6b4a]"
                style={{
                  backgroundColor: "#0a0a0a",
                  border: "1px solid #3a3a3a",
                  color: "#ffffff",
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleGenerate();
                }}
              />
            </div>

            {/* Data Schema */}
            <div
              className="p-6 rounded-xl"
              style={{
                backgroundColor: "#1a1a1a",
                border: "1px solid #2a2a2a",
              }}
            >
              <label className="block text-sm font-medium text-gray-300 mb-3">
                <Code className="w-4 h-4 inline mr-2" />
                Data Schema (JSON)
              </label>
              <textarea
                value={dataSchema}
                onChange={(e) => setDataSchema(e.target.value)}
                className="w-full px-4 py-3 rounded-lg text-xs font-mono min-h-[200px] transition-all focus:ring-2 focus:ring-[#ff6b4a]"
                style={{
                  backgroundColor: "#0a0a0a",
                  border: "1px solid #3a3a3a",
                  color: "#4ade80",
                }}
              />
            </div>

            {/* Generate Button */}
            <Button
              onClick={handleGenerate}
              disabled={generateView.isPending}
              className="w-full py-6 text-base font-medium rounded-xl transition-all hover:scale-[1.02]"
              style={{
                background: "linear-gradient(135deg, #ff6b4a 0%, #d4af37 100%)",
                color: "#ffffff",
              }}
            >
              {generateView.isPending ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Generating magic...
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5 mr-2" />
                  Generate View
                </>
              )}
            </Button>

            {/* Quick action to load examples */}
            {!getExamples.data && (
              <button
                onClick={() => getExamples.mutate()}
                disabled={getExamples.isPending}
                className="w-full py-3 text-sm rounded-xl transition-all hover:bg-[#2a2a2a]"
                style={{
                  backgroundColor: "#1a1a1a",
                  border: "1px solid #3a3a3a",
                  color: "#9ca3af",
                }}
              >
                {getExamples.isPending
                  ? "Loading..."
                  : "💡 Or load example templates"}
              </button>
            )}
          </div>

          {/* Right: Preview */}
          <div className="space-y-4">
            {generatedView ? (
              <>
                {/* Reasoning */}
                <div
                  className="p-6 rounded-xl"
                  style={{
                    backgroundColor: "#1a1a1a",
                    border: "1px solid #2a2a2a",
                  }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Heart className="w-4 h-4 text-[#ff6b4a]" />
                    <span className="text-sm font-medium text-gray-300">
                      Why this design?
                    </span>
                  </div>
                  <p className="text-sm text-gray-400">{reasoning}</p>
                </div>

                {/* Preview/JSON Toggle */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowJson(false)}
                    className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all ${
                      !showJson ? "ring-2 ring-[#ff6b4a]" : ""
                    }`}
                    style={{
                      backgroundColor: !showJson ? "#ff6b4a" : "#242424",
                      color: "#ffffff",
                      border: "1px solid #3a3a3a",
                    }}
                  >
                    <Eye className="w-4 h-4 inline mr-2" />
                    Preview
                  </button>
                  <button
                    onClick={() => setShowJson(true)}
                    className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all ${
                      showJson ? "ring-2 ring-[#ff6b4a]" : ""
                    }`}
                    style={{
                      backgroundColor: showJson ? "#ff6b4a" : "#242424",
                      color: "#ffffff",
                      border: "1px solid #3a3a3a",
                    }}
                  >
                    <Code className="w-4 h-4 inline mr-2" />
                    JSON
                  </button>
                  <button
                    onClick={handleValidate}
                    disabled={validateView.isPending}
                    className="py-3 px-4 rounded-lg text-sm font-medium transition-all"
                    style={{
                      backgroundColor: validateView.data?.valid
                        ? "#4ade80"
                        : "#242424",
                      color: "#ffffff",
                      border: "1px solid #3a3a3a",
                    }}
                  >
                    {validateView.isPending ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : validateView.data?.valid ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      "✓"
                    )}
                  </button>
                </div>

                {/* Preview Area */}
                <div
                  className="p-6 rounded-xl min-h-[400px]"
                  style={{
                    backgroundColor: "#1a1a1a",
                    border: "1px solid #2a2a2a",
                  }}
                >
                  {showJson ? (
                    <pre
                      className="text-xs overflow-x-auto"
                      style={{ color: "#4ade80" }}
                    >
                      {JSON.stringify(generatedView, null, 2)}
                    </pre>
                  ) : (
                    <div className="animate-in fade-in duration-500">
                      <ViewRenderer
                        definition={generatedView}
                        data={exampleData || {}}
                        formValues={formValues}
                        onChange={(name, value) =>
                          setFormValues((prev) => ({ ...prev, [name]: value }))
                        }
                      />
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={copyToClipboard}
                    className="py-3 px-4 rounded-lg text-sm font-medium transition-all hover:scale-[1.02]"
                    style={{
                      backgroundColor: "#242424",
                      color: "#ffffff",
                      border: "1px solid #3a3a3a",
                    }}
                  >
                    <Copy className="w-4 h-4 inline mr-2" />
                    Copy JSON
                  </button>
                  <button
                    onClick={copyWorkflowExample}
                    className="py-3 px-4 rounded-lg text-sm font-medium transition-all hover:scale-[1.02]"
                    style={{
                      backgroundColor: "#242424",
                      color: "#ffffff",
                      border: "1px solid #3a3a3a",
                    }}
                  >
                    <Terminal className="w-4 h-4 inline mr-2" />
                    Copy for Workflow
                  </button>
                </div>

                {/* How to use */}
                <div
                  className="p-6 rounded-xl"
                  style={{
                    backgroundColor: "#242424",
                    border: "1px solid #3a3a3a",
                  }}
                >
                  <div className="text-sm font-medium text-white mb-2">
                    💡 How to use in your workflow:
                  </div>
                  <div className="text-xs text-gray-400 space-y-1">
                    <div>1. Copy the JSON or workflow example above</div>
                    <div>
                      2. Add it to your WorkflowStep as{" "}
                      <code className="bg-[#1a1a1a] px-1 py-0.5 rounded">
                        {viewType}View
                      </code>
                    </div>
                    <div>
                      3. The view will automatically render when the step runs!
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div
                className="p-12 rounded-xl text-center"
                style={{
                  backgroundColor: "#1a1a1a",
                  border: "1px solid #2a2a2a",
                }}
              >
                <div
                  className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: "#242424" }}
                >
                  <Sparkles className="w-10 h-10 text-gray-500" />
                </div>
                <p className="text-gray-400 text-lg mb-2">
                  Ready to create something awesome?
                </p>
                <p className="text-gray-500 text-sm">
                  Describe what you want and watch the magic happen ✨
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer hint */}
        <div className="mt-8 text-center text-xs text-gray-600">
          <p>💡 Pro tip: Click the logo 5 times for a surprise</p>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 0.3; }
        }
        
        @keyframes slide-in-from-top {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        .animate-in {
          animation-duration: 0.3s;
          animation-timing-function: ease-out;
          animation-fill-mode: both;
        }
        
        .slide-in-from-top {
          animation-name: slide-in-from-top;
        }
        
        .fade-in {
          animation-name: fade-in;
        }
      `}</style>
    </div>
  );
}

export default createRoute({
  path: "/custom-views",
  component: CustomViewsPage,
  getParentRoute: () => rootRoute,
});
