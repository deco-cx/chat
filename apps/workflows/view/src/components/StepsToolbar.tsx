/**
 * STEPS TOOLBAR - Mission Control Step Sequencer
 *
 * Inspired by: Aviation cockpit instrument panels, NASA mission sequencer
 * Features: Step navigation, status indicators, execution control
 */

import { ChevronLeft, ChevronRight, Plus, Play, Zap } from "lucide-react";

interface Step {
  id: string;
  title: string;
  status: "pending" | "active" | "completed" | "error";
}

interface StepsToolbarProps {
  steps: Step[];
  currentStepIndex: number;
  executionStatus: "idle" | "running" | "success" | "error";
  onNavigate: (index: number) => void;
  onAddStep: () => void;
  onRunWorkflow: () => void;
  onExecutionClick: () => void;
}

export function StepsToolbar({
  steps,
  currentStepIndex,
  executionStatus,
  onNavigate,
  onAddStep,
  onRunWorkflow,
  onExecutionClick,
}: StepsToolbarProps) {
  const canNavigatePrev = currentStepIndex > 0;
  const canNavigateNext = currentStepIndex < steps.length - 1;

  const getStepStatusClass = (status: Step["status"]) => {
    switch (status) {
      case "completed":
        return "ready";
      case "active":
        return "active";
      case "error":
        return "error";
      default:
        return "pending";
    }
  };

  const getExecutionLedClass = () => {
    switch (executionStatus) {
      case "running":
        return "active";
      case "success":
        return "ready";
      case "error":
        return "error";
      default:
        return "pending";
    }
  };

  return (
    <div
      className="panel"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "var(--space-3) var(--space-4)",
        gap: "var(--space-4)",
        borderBottom: "1px solid var(--border-primary)",
        background: "var(--bg-panel)",
      }}
    >
      {/* LEFT: Navigation + Steps */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-3)",
          flex: 1,
        }}
      >
        {/* Navigation Controls */}
        <div style={{ display: "flex", gap: "var(--space-1)" }}>
          <button
            className="btn-icon"
            onClick={() => onNavigate(currentStepIndex - 1)}
            disabled={!canNavigatePrev}
            style={{
              opacity: canNavigatePrev ? 1 : 0.3,
              cursor: canNavigatePrev ? "pointer" : "not-allowed",
            }}
            title="Previous Step"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            className="btn-icon"
            onClick={() => onNavigate(currentStepIndex + 1)}
            disabled={!canNavigateNext}
            style={{
              opacity: canNavigateNext ? 1 : 0.3,
              cursor: canNavigateNext ? "pointer" : "not-allowed",
            }}
            title="Next Step"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Step Indicators */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            overflow: "auto",
            maxWidth: "600px",
          }}
        >
          {steps.map((step, index) => (
            <button
              key={step.id}
              onClick={() => onNavigate(index)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2)",
                background:
                  index === currentStepIndex
                    ? "var(--bg-tertiary)"
                    : "transparent",
                border: "1px solid var(--border-primary)",
                borderColor:
                  index === currentStepIndex
                    ? "var(--border-active)"
                    : "var(--border-primary)",
                padding: "var(--space-2) var(--space-3)",
                cursor: "pointer",
                transition: "all var(--transition-fast)",
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-xs)",
                color: "var(--text-secondary)",
                fontWeight: 600,
                letterSpacing: "var(--tracking-wide)",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => {
                if (index !== currentStepIndex) {
                  e.currentTarget.style.borderColor = "var(--border-accent)";
                  e.currentTarget.style.background = "var(--bg-hover)";
                }
              }}
              onMouseLeave={(e) => {
                if (index !== currentStepIndex) {
                  e.currentTarget.style.borderColor = "var(--border-primary)";
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              <span
                className={`status-led ${getStepStatusClass(step.status)}`}
              />
              <span>
                {step.title || `STEP_${String(index).padStart(2, "0")}`}
              </span>
            </button>
          ))}

          {/* Add Step Button */}
          <button
            className="btn-icon"
            onClick={onAddStep}
            title="Add New Step"
            style={{
              color: "var(--accent-primary)",
              borderColor: "var(--border-accent)",
            }}
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* RIGHT: Actions */}
      <div
        style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}
      >
        {/* Run Workflow Button */}
        <button
          className="btn-primary"
          onClick={onRunWorkflow}
          disabled={executionStatus === "running"}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
          }}
        >
          <Play size={14} fill="currentColor" />
          <span>{executionStatus === "running" ? "RUNNING" : "RUN"}</span>
        </button>

        {/* Execution Status Indicator */}
        <button
          className="btn-icon"
          onClick={onExecutionClick}
          title="View Execution Status"
          style={{
            position: "relative",
            borderColor:
              executionStatus !== "idle"
                ? "var(--border-active)"
                : "var(--border-primary)",
          }}
        >
          <Zap
            size={16}
            fill={
              executionStatus === "running"
                ? "var(--status-active)"
                : executionStatus === "success"
                  ? "var(--status-ready)"
                  : "none"
            }
            color={
              executionStatus === "error"
                ? "var(--status-error)"
                : "var(--text-secondary)"
            }
          />
          <span
            className={`status-led ${getExecutionLedClass()}`}
            style={{
              position: "absolute",
              top: "4px",
              right: "4px",
              width: "6px",
              height: "6px",
            }}
          />
        </button>

        {/* System Status Label */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: "var(--space-1)",
          }}
        >
          <span
            className="status-label"
            style={{
              color:
                executionStatus === "running"
                  ? "var(--status-active)"
                  : executionStatus === "success"
                    ? "var(--status-ready)"
                    : executionStatus === "error"
                      ? "var(--status-error)"
                      : "var(--text-dim)",
            }}
          >
            SYS_{executionStatus.toUpperCase()}
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-xs)",
              color: "var(--text-tertiary)",
            }}
          >
            {steps.length} STEPS
          </span>
        </div>
      </div>
    </div>
  );
}
