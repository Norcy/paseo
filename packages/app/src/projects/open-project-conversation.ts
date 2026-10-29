import { getHostRuntimeStore } from "@/runtime/host-runtime";
import { generateDraftId } from "@/stores/draft-keys";
import { navigateToWorkspace } from "@/stores/navigation-active-workspace-store";
import { normalizeWorkspaceDescriptor, useSessionStore } from "@/stores/session-store";
import { ensureDefaultWorkspace, type ConversationProject } from "./default-workspace";

export async function openProjectConversation(
  serverId: string,
  project: ConversationProject,
): Promise<void> {
  const runtime = getHostRuntimeStore();
  const client = runtime.getClient(serverId);
  if (!client) throw new Error("Host is disconnected");
  const supported =
    useSessionStore.getState().sessions[serverId]?.serverInfo?.features?.workspaceMultiplicity;
  if (!supported)
    throw new Error("Update the host to create conversations in the project directory.");
  const workspace = await ensureDefaultWorkspace(client, project);
  runtime.acceptWorkspaceSnapshots(serverId, [normalizeWorkspaceDescriptor(workspace)]);
  navigateToWorkspace({
    serverId,
    workspaceId: workspace.id,
    target: { kind: "draft", draftId: generateDraftId() },
  });
}
