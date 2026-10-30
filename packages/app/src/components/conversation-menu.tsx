import { useCallback, useState, type ReactNode } from "react";
import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useQueryClient } from "@tanstack/react-query";
import { Archive, Ellipsis, Pencil } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { AdaptiveRenameModal } from "@/components/rename-modal";
import { DensityIcon } from "@/components/ui/density-icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIconButtonChromeStyle } from "@/components/ui/icon-button-chrome";
import { useToast } from "@/contexts/toast-context";
import { useArchiveAgent } from "@/hooks/use-archive-agent";
import { useSessionStore, type Agent } from "@/stores/session-store";
import { confirmDialog } from "@/utils/confirm-dialog";

const archiveIcon = <DensityIcon icon={Archive} size="xs" color="foregroundMuted" />;
const renameIcon = <DensityIcon icon={Pencil} size="xs" color="foregroundMuted" />;
const headerHitSlop = { top: 8, bottom: 8 } as const;

export function ConversationHeaderMenu({
  serverId,
  agentId,
}: {
  serverId: string;
  agentId: string | null;
}) {
  const { t } = useTranslation();
  const triggerStyle = useIconButtonChromeStyle({ size: "large" });
  const agent = useSessionStore((state) =>
    agentId ? state.sessions[serverId]?.agents.get(agentId) : undefined,
  );
  if (!agent) return null;

  return (
    <ConversationMenu key={`${agent.serverId}:${agent.id}`} agent={agent}>
      <DropdownMenuTrigger
        style={triggerStyle}
        hitSlop={headerHitSlop}
        accessibilityRole="button"
        accessibilityLabel={t("sidebar.project.actions.menu")}
        testID="conversation-header-menu-trigger"
      >
        <DensityIcon icon={Ellipsis} size="md" color="foregroundMuted" />
      </DropdownMenuTrigger>
    </ConversationMenu>
  );
}

export function ConversationMenu({ agent, children }: { agent: Agent; children: ReactNode }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [renaming, setRenaming] = useState(false);
  const client = useSessionStore((state) => state.sessions[agent.serverId]?.client ?? null);
  const queryClient = useQueryClient();
  const { archiveAgent, isArchivingAgent } = useArchiveAgent();
  const archiving = isArchivingAgent({ serverId: agent.serverId, agentId: agent.id });
  const handleRename = useCallback(() => setRenaming(true), []);
  const handleRenameClose = useCallback(() => setRenaming(false), []);
  const handleArchive = useCallback(() => {
    void (async () => {
      if (
        agent.status === "running" &&
        !(await confirmDialog({
          title: t("workspace.tabs.confirmations.archiveRunningAgentTitle"),
          message: t("workspace.tabs.confirmations.archiveRunningAgentMessage"),
          confirmLabel: t("workspace.tabs.confirmations.archive"),
          cancelLabel: t("workspace.tabs.confirmations.cancel"),
          destructive: true,
        }))
      ) {
        return;
      }
      await archiveAgent({ serverId: agent.serverId, agentId: agent.id });
    })().catch((error: unknown) => {
      toast.error(String(error));
    });
  }, [agent.id, agent.serverId, agent.status, archiveAgent, t, toast]);
  const handleRenameSubmit = useCallback(
    async (title: string) => {
      if (!client) throw new Error(t("workspace.terminal.hostDisconnected"));
      await client.updateAgent(agent.id, { name: title.trim() });
      void queryClient.invalidateQueries({ queryKey: ["sidebarAgentsList", agent.serverId] });
      void queryClient.invalidateQueries({ queryKey: ["allAgents", agent.serverId] });
      setRenaming(false);
    },
    [agent.id, agent.serverId, client, queryClient, t],
  );

  return (
    <>
      <DropdownMenu compactMode="sheet">
        {children}
        <DropdownMenuContent
          align="end"
          width={210}
          sheetTitle={agent.title || t("sidebar.actions.newConversation", "New conversation")}
          testID="conversation-menu"
        >
          <View style={styles.actions}>
            <DropdownMenuItem
              leading={renameIcon}
              onSelect={handleRename}
              disabled={!client || archiving}
            >
              {t("workspace.tabs.menu.rename")}
            </DropdownMenuItem>
            <DropdownMenuItem
              leading={archiveIcon}
              onSelect={handleArchive}
              disabled={!client || archiving}
            >
              {t("agentList.archiveSheet.archive")}
            </DropdownMenuItem>
          </View>
        </DropdownMenuContent>
      </DropdownMenu>
      <AdaptiveRenameModal
        visible={renaming}
        title={t("workspace.tabs.menu.renameAgent")}
        initialValue={agent.title || ""}
        submitLabel={t("workspace.tabs.menu.rename")}
        maxLength={200}
        onClose={handleRenameClose}
        onSubmit={handleRenameSubmit}
      />
    </>
  );
}

const styles = StyleSheet.create((theme) => ({
  actions: {
    paddingVertical: theme.spacing[4],
    gap: theme.spacing[2],
  },
}));
