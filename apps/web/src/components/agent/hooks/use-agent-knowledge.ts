import {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useMemo,
  useRef,
} from "react";
import {
  type Agent,
  type Integration,
  KNOWLEDGE_BASE_DIMENSION,
  useCreateKnowledge,
  useDeleteFile,
  useIntegrations,
  useKnowledgeAddFile,
  useReadFile,
  useWriteFile,
} from "@deco/sdk";
import {
  getKnowledgeBaseIntegrationId,
  parseToValidIndexName,
} from "@deco/sdk/utils";
import { toast } from "@deco/ui/components/sonner.tsx";

interface UseAgentKnowledgeIntegrationProps {
  setIntegrationTools: (integrationId: string, tools: string[]) => void;
  agent: Agent;
}

export const useAgentKnowledgeIntegration = ({
  agent,
}: Pick<UseAgentKnowledgeIntegrationProps, "agent">) => {
  const { id: idProp } = agent;
  const knowledgeName = useMemo(() => parseToValidIndexName(idProp), [idProp]);
  const knowledgeIntegrationId = useMemo(
    () => getKnowledgeBaseIntegrationId(knowledgeName),
    [knowledgeName],
  );
  const integrations = useIntegrations();
  const knowledgeIntegration = useMemo(
    () =>
      integrations.data?.find(
        (integration) => integration.id === knowledgeIntegrationId,
      ),
    [knowledgeIntegrationId, integrations],
  );

  return {
    integration: knowledgeIntegration,
    id: knowledgeIntegrationId,
    name: knowledgeName,
  };
};

export const useCreateAgentKnowledgeIntegration = ({
  setIntegrationTools,
  agent,
}: UseAgentKnowledgeIntegrationProps) => {
  const {
    integration: knowledgeIntegration,
    name: knowledgeName,
    id,
  } = useAgentKnowledgeIntegration({
    agent,
  });
  const integrations = useIntegrations();
  const createKnowledge = useCreateKnowledge();

  const createAgentKnowledge = async () => {
    if (knowledgeIntegration) {
      return {
        name: knowledgeIntegration.id,
        dimmension: KNOWLEDGE_BASE_DIMENSION,
      };
    }
    const kb = await createKnowledge.mutateAsync({ name: knowledgeName });
    integrations.refetch();

    setIntegrationTools(id, ["KNOWLEDGE_BASE_SEARCH"]);

    return kb;
  };

  return {
    integration: knowledgeIntegration,
    createAgentKnowledge,
  };
};

export const agentKnowledgeBasePath = (agentId: string) =>
  `agent/${agentId}/knowledge`;

const agentKnowledgeBaseFilepath = (agentId: string, path: string) =>
  `${agentKnowledgeBasePath(agentId)}/${path}`;

export const useAgentKnowledgeRootPath = (agentId: string) =>
  useMemo(() => agentKnowledgeBasePath(agentId), [agentId]);

export interface UploadFile {
  file: File;
  fileUrl?: string;
  uploading?: boolean;
  // docIds?: string[];
}

interface UseUploadAgentKnowledgeFilesProps {
  agent: Agent;
  onAddFile: Dispatch<SetStateAction<UploadFile[]>>;
  setIntegrationTools: (integrationId: string, tools: string[]) => void;
}

export const useUploadAgentKnowledgeFiles = ({
  agent,
  onAddFile,
  setIntegrationTools,
}: UseUploadAgentKnowledgeFilesProps) => {
  const { integration: knowledgeIntegration, createAgentKnowledge } =
    useCreateAgentKnowledgeIntegration({
      agent,
      setIntegrationTools,
    });
  const writeFileMutation = useWriteFile();
  const addFileToKnowledgeBase = useKnowledgeAddFile();
  const readFile = useReadFile();
  const deleteFile = useDeleteFile();
  const knowledeIntegrationPromise =
    useRef<PromiseWithResolvers<Integration>>(null);

  useEffect(() => {
    if (!knowledeIntegrationPromise.current || !knowledgeIntegration) return;

    knowledeIntegrationPromise.current.resolve(knowledgeIntegration);
  }, [knowledgeIntegration]);

  const _uploadKnowledgeFiles = async (
    files: File[],
    knowledgeIntegration: Integration,
  ) => {
    if (!knowledgeIntegration.connection) {
      throw new Error("Not found knowledge for this agent");
    }

    try {
      // Upload each file using the writeFileMutation
      const uploadPromises = files.map(async (file) => {
        let fileWasUploaded = false;
        let filePath = "";

        try {
          const filename = file.name;
          const path = agentKnowledgeBaseFilepath(agent.id, filename);
          filePath = path;
          const buffer = await file.arrayBuffer();

          const fileMutateData = {
            path,
            contentType: file.type || "application/octet-stream",
            content: new Uint8Array(buffer),
          };

          const savedResponse =
            await writeFileMutation.mutateAsync(fileMutateData);

          if (!savedResponse.ok) {
            throw new Error(`Failed to upload file ${filename}`);
          }

          fileWasUploaded = true;

          const fileUrl = await readFile(
            path,
            { expiresIn: 60 * 60 }, // 1 hour days
          );

          if (!fileUrl) {
            throw new Error(`Failed to read uploaded file ${filename}`);
          }

          await addFileToKnowledgeBase.mutateAsync({
            connection: knowledgeIntegration?.connection,
            fileUrl,
            metadata: {
              agentId: agent.id,
            },
            path,
            filename: file.name,
          });

          onAddFile((prev) => prev.filter((fileObj) => fileObj.file !== file));
        } catch (error) {
          console.error(`Failed to upload ${file.name}:`, error);

          // Show toast error message
          toast.error(`Failed to upload file ${file.name}`);

          // Clean up: if file was uploaded but failed at later stages, remove it
          if (fileWasUploaded && filePath) {
            try {
              console.log(`Cleaning up uploaded file: ${filePath}`);
              await deleteFile.mutateAsync({ path: filePath });
            } catch (deleteError) {
              console.error(
                `Failed to clean up file ${filePath}:`,
                deleteError,
              );
            }
          }

          // Remove failed upload from the list
          onAddFile((prev) => prev.filter((fileObj) => fileObj.file !== file));

          throw error;
        }
      });

      await Promise.all(uploadPromises);
    } catch (error) {
      console.error("Failed to upload some knowledge files:", error);
    }
  };

  const uploadKnowledgeFiles = async (files: File[]) => {
    onAddFile((prev) => [
      ...prev,
      ...files.map((file) => ({ file, uploading: true })),
    ]);
    if (!knowledgeIntegration?.connection) {
      await createAgentKnowledge();
      knowledeIntegrationPromise.current = Promise.withResolvers();

      await knowledeIntegrationPromise.current.promise;
    }
    const kbIntegration =
      knowledgeIntegration ??
      (await knowledeIntegrationPromise.current?.promise);
    if (!kbIntegration) throw new Error("Not found knowledge for this agent");
    return _uploadKnowledgeFiles(files, kbIntegration);
  };

  return {
    uploadKnowledgeFiles,
  };
};
