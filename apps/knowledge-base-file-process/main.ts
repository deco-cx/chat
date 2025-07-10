import { withRuntime } from "@deco/workers-runtime";
import { createFileProcessingWorkflow } from "./src/workflows/file-processing.ts";

const { Workflow, ...app } = withRuntime({
  workflows: [createFileProcessingWorkflow],
});

export { Workflow };
export default app; 