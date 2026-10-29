import { useCallback, useMemo, useState } from "react";
import { useToast } from "@/contexts/toast-context";
import { openProjectConversation } from "@/projects/open-project-conversation";
import {
  ChevronDown,
  ChevronRight,
  CircleAlert,
  MessageCircle,
  MoreVertical,
  Plus,
} from "lucide-react-native";
import { useAgentDescriptor } from "@/agent-presentation";
import { StatusRing } from "@/components/status-ring";
import { densityIconBox } from "@/styles/density";
import type { SidebarStateBucket } from "@/utils/sidebar-agent-state";
import { getStatusDotColor } from "@/utils/status-dot-color";
import { STATUS_INDICATOR_FILLED_DOT_SIZE } from "@/utils/status-indicator-geometry";
import { ProjectLeadingVisual } from "@/components/sidebar/project-leading-visual";
import { useProjectIcons } from "@/projects/icons";
import type { ProjectIconTarget } from "@/projects/icon-target";
import { ScrollView, Text, View } from "react-native";
import { PressHighlight } from "@/components/ui/press-highlight";
import { useTranslation } from "react-i18next";
import { StyleSheet } from "react-native-unistyles";
import { DensityIcon } from "@/components/ui/density-icon";
import { ConversationMenu } from "@/components/conversation-menu";
import { DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  navigateToWorkspace,
  useActiveWorkspaceSelection,
} from "@/stores/navigation-active-workspace-store";
import { useSessionStore, type Agent } from "@/stores/session-store";
import { useSidebarCollapsedSectionsStore } from "@/stores/sidebar-collapsed-sections-store";

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
  const collapsedProjectKeys = useSidebarCollapsedSectionsStore(
    (state) => state.collapsedProjectKeys,
  );
  const toggleProjectCollapsed = useSidebarCollapsedSectionsStore(
    (state) => state.toggleProjectCollapsed,
  );
  const groups = useMemo(() => {
    const byProject = new Map<string, ConversationGroup>();
    for (const [serverId, session] of Object.entries(sessions)) {
      for (const project of session.projects.values()) {
        const id = `${serverId}:${project.projectId}`;
        byProject.set(id, {
          id,
          projectViewKey: id,
          serverId,
          projectId: project.projectId,
          iconWorkingDir: project.projectRootPath,
          customIconRevision: project.projectCustomIconRevision,
          iconRevision: project.projectIconRevision,
          title: project.projectCustomName || project.projectDisplayName,
          sourceDirectory: project.projectRootPath,
          entries: [],
        });
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
                collapsed={collapsedProjectKeys.has(group.projectViewKey)}
                onToggleCollapsed={toggleProjectCollapsed}
              />
              {!collapsedProjectKeys.has(group.projectViewKey) &&
                group.entries.map((agent) => {
                  const active =
                    selection?.serverId === agent.serverId && activeAgentId === agent.id;
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
  collapsed,
  onToggleCollapsed,
}: {
  group: ConversationGroup;
  iconDataUri: string | null;
  newLabel: string;
  onSelect: () => void;
  collapsed: boolean;
  onToggleCollapsed: (projectViewKey: string) => void;
}) {
  const toast = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const toggleCollapsed = useCallback(
    () => onToggleCollapsed(group.projectViewKey),
    [group.projectViewKey, onToggleCollapsed],
  );
  const collapseState = useMemo(() => ({ expanded: !collapsed }), [collapsed]);
  const chevron = collapsed ? ChevronRight : ChevronDown;
  const accessibilityState = useMemo(
    () => ({ disabled: isCreating, busy: isCreating }),
    [isCreating],
  );
  const handleAdd = useCallback(async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      await openProjectConversation(group.serverId, {
        projectId: group.projectId,
        projectRootPath: group.sourceDirectory,
      });
      onSelect();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create conversation");
    } finally {
      setIsCreating(false);
    }
  }, [group, isCreating, onSelect, toast]);

  return (
    <View style={styles.groupHeader}>
      <PressHighlight
        onPress={toggleCollapsed}
        accessibilityRole="button"
        accessibilityLabel={group.title}
        accessibilityState={collapseState}
        style={styles.projectToggle}
        highlightStyle={styles.rowPressed}
      >
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
        <DensityIcon icon={chevron} size="xs" color="foregroundMuted" />
      </PressHighlight>
      <PressHighlight
        onPress={handleAdd}
        disabled={isCreating}
        accessibilityState={accessibilityState}
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

  return (
    <View style={selected ? [styles.row, styles.rowSelected] : styles.row}>
      <PressHighlight
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={agent.title || fallbackTitle}
        style={styles.rowMain}
        highlightStyle={styles.rowPressed}
      >
        <View style={styles.conversationIcon}>
          <ConversationIcon bucket={descriptor.statusBucket} />
        </View>
        <Text numberOfLines={1} style={styles.conversationTitle}>
          {agent.title || fallbackTitle}
        </Text>
      </PressHighlight>
      <ConversationMenu agent={agent}>
        <DropdownMenuTrigger
          hitSlop={8}
          style={styles.moreButton}
          accessibilityRole="button"
          accessibilityLabel={t("sidebar.project.actions.menu")}
        >
          <DensityIcon icon={MoreVertical} size="xs" color="foregroundMuted" />
        </DropdownMenuTrigger>
      </ConversationMenu>
    </View>
  );
}

function ConversationIcon({ bucket }: { bucket: SidebarStateBucket | null }) {
  switch (bucket) {
    case "running":
      return <StatusRing />;
    case "needs_input":
      return <DensityIcon icon={CircleAlert} size="xs" color="statusDotWarning" />;
    case "failed":
      return <View style={[styles.statusDot, styles.statusFailed]} />;
    case "attention":
      return <View style={[styles.statusDot, styles.statusAttention]} />;
    default:
      return <DensityIcon icon={MessageCircle} size="xs" color="foregroundMuted" />;
  }
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
  projectToggle: {
    flex: 1,
    minWidth: 0,
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[2],
    borderRadius: theme.borderRadius.md,
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
    fontSize: theme.fontSize.base,
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
  conversationIcon: {
    width: densityIconBox("md"),
    height: densityIconBox("md"),
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  statusDot: {
    width: STATUS_INDICATOR_FILLED_DOT_SIZE,
    height: STATUS_INDICATOR_FILLED_DOT_SIZE,
    borderRadius: theme.borderRadius.full,
  },
  statusFailed: {
    backgroundColor: getStatusDotColor({ theme, bucket: "failed" }) ?? undefined,
  },
  statusAttention: {
    backgroundColor: getStatusDotColor({ theme, bucket: "attention" }) ?? undefined,
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
    fontSize: theme.fontSize.base,
  },
}));
