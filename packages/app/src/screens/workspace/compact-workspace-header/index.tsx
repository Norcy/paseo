import { Platform } from "react-native";
import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CompactHeader } from "@/components/headers/compact-header";
import {
  EXPLORER_TOGGLE_KEYS,
  WorkspaceExplorerToggle,
} from "@/screens/workspace/workspace-explorer-toggle";

export { MobileWorkspaceTabSwitcher } from "./tab-switcher";

interface CompactWorkspaceHeaderProps {
  isLoading: boolean;
  title: string;
  onToggleExplorer: () => void;
  explorerToggleLabel: string;
  explorerToggleAccessibilityState: { expanded: boolean };
  /** Tab switcher and conversation menu, after the explorer toggle. */
  children: ReactNode;
}

/** The compact conversation title and controls. */
export function CompactWorkspaceHeader({
  isLoading,
  title,
  onToggleExplorer,
  explorerToggleLabel,
  explorerToggleAccessibilityState,
  children,
}: CompactWorkspaceHeaderProps) {
  const { t } = useTranslation();
  const actions = (
    <>
      {Platform.OS !== "android" && (
        <WorkspaceExplorerToggle
          onPress={onToggleExplorer}
          label={explorerToggleLabel}
          tooltipLabel={t("workspace.tabs.explorerSidebar.toggle")}
          tooltipKeys={EXPLORER_TOGGLE_KEYS}
          accessibilityState={explorerToggleAccessibilityState}
          mobile
        />
      )}
      {children}
    </>
  );

  return (
    <CompactHeader
      navigation="menu"
      title={title}
      titleTestID="workspace-header-title"
      loading={isLoading}
      actions={actions}
    />
  );
}
