import { useCallback, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Archive, Ellipsis, Pencil, PanelRight, ChartPie } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { AdaptiveRenameModal } from "@/components/rename-modal";
import { DensityIcon } from "@/components/ui/density-icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSubTrigger,
  type MenuPageDefinition,
} from "@/components/ui/dropdown-menu";
import { useIconButtonChromeStyle } from "@/components/ui/icon-button-chrome";
import { useToast } from "@/contexts/toast-context";
import { useArchiveAgent } from "@/hooks/use-archive-agent";
import { useSessionStore, type Agent } from "@/stores/session-store";
import { AgentContextWindowDetails } from "@/components/context-window-details";
import { confirmDialog } from "@/utils/confirm-dialog";

const explorerIcon = <DensityIcon icon={PanelRight} size="xs" color="foregroundMuted" />;
const contextIcon = <DensityIcon icon={ChartPie} size="xs" color="foregroundMuted" />;
const archiveIcon = <DensityIcon icon={Archive} size="xs" color="foregroundMuted" />;
const renameIcon = <DensityIcon icon={Pencil} size="xs" color="foregroundMuted" />;
const headerHitSlop = { top: 8, bottom: 8 } as const;

export function ConversationHeaderMenu({
  serverId,
  agentId,
  onToggleExplorer,
  explorerLabel,
}: {
  serverId: string;
  agentId: string | null;
  onToggleExplorer: () => void;
  explorerLabel: string;
}) {
  const { t } = useTranslation();
  const triggerStyle = useIconButtonChromeStyle({ size: "large" });
  const agent = useSessionStore((state) =>
    agentId ? state.sessions[serverId]?.agents.get(agentId) : undefined,
  );
  const pages: MenuPageDefinition[] = agentId
    ? [
        {
          id: "context",
          title: t("contextWindow.title"),
          hoverIntent: false,
          content: <AgentContextWindowDetails serverId={serverId} agentId={agentId} />,
        },
      ]
    : [];
  const actions = (
    <>
      <DropdownMenuItem leading={explorerIcon} onSelect={onToggleExplorer}>
        {explorerLabel}
      </DropdownMenuItem>
      {agentId ? (
        <DropdownMenuSubTrigger id="context" leading={contextIcon}>
          {t("contextWindow.title")}
        </DropdownMenuSubTrigger>
      ) : null}
    </>
  );

  return (
    <ConversationMenu key={`${serverId}:${agentId}`} agent={agent} actions={actions} pages={pages}>
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

export function ConversationMenu({
  agent,
  children,
  actions,
  pages,
}: {
  agent?: Agent;
  children: ReactNode;
  actions?: ReactNode;
  pages?: MenuPageDefinition[];
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [renaming, setRenaming] = useState(false);
  const client = useSessionStore((state) =>
    agent ? (state.sessions[agent.serverId]?.client ?? null) : null,
  );
  const queryClient = useQueryClient();
  const { archiveAgent, isArchivingAgent } = useArchiveAgent();
  const archiving = agent
    ? isArchivingAgent({ serverId: agent.serverId, agentId: agent.id })
    : false;
  const handleRename = useCallback(() => setRenaming(true), []);
  const handleRenameClose = useCallback(() => setRenaming(false), []);
  const handleArchive = useCallback(() => {
    if (!agent) return;
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
  }, [agent, archiveAgent, t, toast]);
  const handleRenameSubmit = useCallback(
    async (title: string) => {
      if (!client || !agent) throw new Error(t("workspace.terminal.hostDisconnected"));
      await client.updateAgent(agent.id, { name: title.trim() });
      void queryClient.invalidateQueries({ queryKey: ["sidebarAgentsList", agent.serverId] });
      void queryClient.invalidateQueries({ queryKey: ["allAgents", agent.serverId] });
      setRenaming(false);
    },
    [agent, client, queryClient, t],
  );

  return (
    <>
      <DropdownMenu compactMode="sheet">
        {children}
        <DropdownMenuContent align="end" width={210} testID="conversation-menu" pages={pages}>
          {actions}
          {agent ? (
            <>
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
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {agent ? (
        <AdaptiveRenameModal
          visible={renaming}
          title={t("workspace.tabs.menu.renameAgent")}
          initialValue={agent.title || ""}
          submitLabel={t("workspace.tabs.menu.rename")}
          maxLength={200}
          onClose={handleRenameClose}
          onSubmit={handleRenameSubmit}
        />
      ) : null}
    </>
  );
}
