import { useCallback, useMemo, useState } from "react";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Archive, MessageCircle, MoreVertical, Pencil, Plus } from "lucide-react-native";
import { useAgentDescriptor } from "@/agent-presentation";
import { StatusIcon } from "@/components/status-icon";
import { ProjectLeadingVisual } from "@/components/sidebar/project-leading-visual";
import { useProjectIcons } from "@/projects/icons";
import type { ProjectIconTarget } from "@/projects/icon-target";
import { ScrollView, Text, View } from "react-native";
import { PressHighlight } from "@/components/ui/press-highlight";
import { useTranslation } from "react-i18next";
import { StyleSheet } from "react-native-unistyles";
import { DensityIcon } from "@/components/ui/density-icon";
import { AdaptiveRenameModal } from "@/components/rename-modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useArchiveAgent } from "@/hooks/use-archive-agent";
import { confirmDialog } from "@/utils/confirm-dialog";
import {
  navigateToWorkspace,
  useActiveWorkspaceSelection,
} from "@/stores/navigation-active-workspace-store";
import { useSessionStore, type Agent } from "@/stores/session-store";

const renameIcon = <DensityIcon icon={Pencil} size="xs" color="foregroundMuted" />;
const archiveIcon = <DensityIcon icon={Archive} size="xs" color="foregroundMuted" />;

interface ConversationGroup extends ProjectIconTarget {
  id: string;
  serverId: string;
  projectId: string;
  title: string;
  sourceDirectory: string;
  entries: Agent[];
}

export function MobileConversationList({ onSelect }: { onSelect: () => void }) {
  const { t } = useTranslation();
  const selection = useActiveWorkspaceSelection();
  const activeAgentId = useSessionStore((state) =>
    selection ? state.sessions[selection.serverId]?.focusedAgentId : null,
  );
  const sessions = useSessionStore((state) => state.sessions);
  const groups = useMemo(() => {
    const byProject = new Map<string, ConversationGroup>();
    for (const [serverId, session] of Object.entries(sessions)) {
      for (const workspace of session.workspaces.values()) {
        const id = `${serverId}:${workspace.projectId}`;
        if (!byProject.has(id)) {
          const project = session.projects.get(workspace.projectId);
          byProject.set(id, {
            id,
            projectViewKey: id,
            serverId,
            projectId: workspace.projectId,
            iconWorkingDir: workspace.projectRootPath,
            customIconRevision: workspace.projectCustomIconRevision,
            iconRevision: project?.projectIconRevision,
            title: workspace.projectCustomName || workspace.projectDisplayName,
            sourceDirectory: workspace.projectRootPath,
            entries: [],
          });
        }
      }
      for (const agent of session.agents.values()) {
        if (agent.archivedAt || !agent.workspaceId) continue;
        const workspace = session.workspaces.get(agent.workspaceId);
        if (!workspace) continue;
        byProject.get(`${serverId}:${workspace.projectId}`)?.entries.push(agent);
      }
    }
    return [...byProject.values()].map((group) => {
      group.entries.sort((a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime());
      return group;
    });
  }, [sessions]);
  const projectIcons = useProjectIcons({ projects: groups });
  const emptyLabel = t("sidebar.empty.noConversations", "No conversations yet");
  const newLabel = t("sidebar.actions.newConversation", "New conversation");

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {groups.length === 0 ? (
          <Text style={styles.empty}>{emptyLabel}</Text>
        ) : (
          groups.map((group) => (
            <View key={group.id} style={styles.group}>
              <ProjectGroupHeader
                group={group}
                iconDataUri={projectIcons.get(group.projectViewKey) ?? null}
                newLabel={newLabel}
                onSelect={onSelect}
              />
              {group.entries.map((agent) => {
                const active = selection?.serverId === agent.serverId && activeAgentId === agent.id;
                return (
                  <ConversationRow
                    key={`${agent.serverId}:${agent.id}`}
                    agent={agent}
                    selected={active}
                    fallbackTitle={newLabel}
                    onSelect={onSelect}
                  />
                );
              })}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function ProjectGroupHeader({
  group,
  iconDataUri,
  newLabel,
  onSelect,
}: {
  group: ConversationGroup;
  iconDataUri: string | null;
  newLabel: string;
  onSelect: () => void;
}) {
  const handleAdd = useCallback(() => {
    onSelect();
    router.push({
      pathname: "/new",
      params: {
        serverId: group.serverId,
        projectId: group.projectId,
        dir: group.sourceDirectory,
        name: group.title,
      },
    });
  }, [group, onSelect]);

  return (
    <View style={styles.groupHeader}>
      <ProjectLeadingVisual
        displayName={group.title}
        iconDataUri={iconDataUri}
        projectViewKey={group.projectViewKey}
        statusBucket={null}
        backdrop="surfaceSidebar"
      />
      <Text numberOfLines={1} style={styles.groupTitle}>
        {group.title}
      </Text>
      <PressHighlight
        onPress={handleAdd}
        accessibilityRole="button"
        accessibilityLabel={`${newLabel}: ${group.title}`}
        style={styles.projectAddButton}
        highlightStyle={styles.rowPressed}
      >
        <DensityIcon icon={Plus} size="xs" color="foregroundMuted" />
      </PressHighlight>
    </View>
  );
}

function ConversationRow({
  agent,
  selected,
  fallbackTitle,
  onSelect,
}: {
  agent: Agent;
  selected: boolean;
  fallbackTitle: string;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  const [renaming, setRenaming] = useState(false);
  const client = useSessionStore((state) => state.sessions[agent.serverId]?.client ?? null);
  const queryClient = useQueryClient();
  const { archiveAgent } = useArchiveAgent();
  const descriptor = useAgentDescriptor(
    { kind: "agent", agentId: agent.id },
    { serverId: agent.serverId },
  );
  const handlePress = useCallback(() => {
    if (agent.workspaceId) {
      navigateToWorkspace({
        serverId: agent.serverId,
        workspaceId: agent.workspaceId,
        target: { kind: "agent", agentId: agent.id },
      });
    }
    onSelect();
  }, [agent, onSelect]);
  const handleRename = useCallback(() => setRenaming(true), []);
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
    })().catch(() => {});
  }, [agent.id, agent.serverId, agent.status, archiveAgent, t]);
  const handleRenameClose = useCallback(() => setRenaming(false), []);
  const handleRenameSubmit = useCallback(
    async (title: string) => {
      if (!client) throw new Error(t("workspace.terminal.hostDisconnected"));
      await client.updateAgent(agent.id, { name: title.trim() });
      void queryClient.invalidateQueries({
        queryKey: ["sidebarAgentsList", agent.serverId],
      });
      void queryClient.invalidateQueries({ queryKey: ["allAgents", agent.serverId] });
      setRenaming(false);
    },
    [agent.id, agent.serverId, client, queryClient, t],
  );

  return (
    <>
      <View style={selected ? [styles.row, styles.rowSelected] : styles.row}>
        <PressHighlight
          onPress={handlePress}
          accessibilityRole="button"
          accessibilityLabel={agent.title || fallbackTitle}
          style={styles.rowMain}
          highlightStyle={styles.rowPressed}
        >
          <StatusIcon
            statusBucket={descriptor.statusBucket}
            size={16}
            backdrop={selected ? "surfaceSidebarSelected" : "surfaceSidebar"}
          >
            <DensityIcon icon={MessageCircle} size="xs" color="foregroundMuted" />
          </StatusIcon>
          <Text numberOfLines={1} style={styles.conversationTitle}>
            {agent.title || fallbackTitle}
          </Text>
        </PressHighlight>
        <DropdownMenu compactMode="sheet">
          <DropdownMenuTrigger
            hitSlop={8}
            style={styles.moreButton}
            accessibilityRole="button"
            accessibilityLabel={t("sidebar.project.actions.menu")}
          >
            <DensityIcon icon={MoreVertical} size="xs" color="foregroundMuted" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" width={210} sheetTitle={agent.title || fallbackTitle}>
            <DropdownMenuItem leading={renameIcon} onSelect={handleRename}>
              {t("workspace.tabs.menu.renameAgent")}
            </DropdownMenuItem>
            <DropdownMenuItem leading={archiveIcon} onSelect={handleArchive} disabled={!client}>
              {t("agentList.archiveSheet.archive")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </View>
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
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: theme.spacing[3],
    paddingTop: theme.spacing[4],
    paddingBottom: theme.spacing[3],
  },
  empty: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.sm,
    padding: theme.spacing[2],
  },
  group: { marginBottom: theme.spacing[4] },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[2],
    paddingLeft: theme.spacing[2],
    marginBottom: theme.spacing[1],
  },
  projectAddButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.borderRadius.full,
  },
  groupTitle: {
    flex: 1,
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    paddingRight: theme.spacing[1],
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 42,
    paddingLeft: theme.spacing[2],
    paddingRight: theme.spacing[1],
    borderRadius: 8,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[2],
    minHeight: 42,
  },
  moreButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.borderRadius.full,
  },
  rowSelected: { backgroundColor: theme.colors.surface2 },
  rowPressed: { backgroundColor: theme.colors.surface2 },
  conversationTitle: {
    flex: 1,
    color: theme.colors.foreground,
    fontSize: theme.fontSize.sm,
  },
}));
