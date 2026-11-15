import type { DaemonClient } from "@getpaseo/client/internal/daemon-client";
import type {
  WorkspaceDescriptorPayload,
  WorkspaceProjectDescriptorPayload,
} from "@getpaseo/protocol/messages";

export type ConversationProject = Pick<
  WorkspaceProjectDescriptorPayload,
  "projectId" | "projectRootPath"
>;
interface WorkspaceClient {
  fetchWorkspaces: (
    ...args: Parameters<DaemonClient["fetchWorkspaces"]>
  ) => ReturnType<DaemonClient["fetchWorkspaces"]>;
  createWorkspace: DaemonClient["createWorkspace"];
}
const pending = new WeakMap<WorkspaceClient, Map<string, Promise<WorkspaceDescriptorPayload>>>();

export function ensureDefaultWorkspace(
  client: WorkspaceClient,
  project: ConversationProject,
): Promise<WorkspaceDescriptorPayload> {
  let projects = pending.get(client);
  if (!projects) {
    projects = new Map();
    pending.set(client, projects);
  }
  const existing = projects.get(project.projectId);
  if (existing) return existing;
  const request = findOrCreateDefaultWorkspace(client, project).finally(() =>
    projects.delete(project.projectId),
  );
  projects.set(project.projectId, request);
  return request;
}

async function findOrCreateDefaultWorkspace(
  client: WorkspaceClient,
  project: ConversationProject,
): Promise<WorkspaceDescriptorPayload> {
  const candidates: WorkspaceDescriptorPayload[] = [];
  let cursor: string | undefined;
  do {
    const page = await client.fetchWorkspaces({
      filter: { projectId: project.projectId },
      page: { limit: 200, cursor },
    });
    candidates.push(
      ...page.entries.filter(
        (workspace) =>
          workspace.projectId === project.projectId &&
          workspace.workspaceDirectory === project.projectRootPath &&
          workspace.workspaceKind !== "worktree" &&
          !workspace.background,
      ),
    );
    cursor = page.pageInfo.nextCursor ?? undefined;
  } while (cursor);
  candidates.sort((a, b) => a.id.localeCompare(b.id));
  if (candidates[0]) return candidates[0];
  const result = await client.createWorkspace({
    source: { kind: "directory", path: project.projectRootPath, projectId: project.projectId },
  });
  if (result.error || !result.workspace)
    throw new Error(result.error ?? "Unable to create workspace");
  return result.workspace;
}
