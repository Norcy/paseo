import { Platform } from "react-native";
import { Fragment, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CompactHeader } from "@/components/headers/compact-header";
import {
  EXPLORER_TOGGLE_KEYS,
  WorkspaceExplorerToggle,
} from "@/screens/workspace/workspace-explorer-toggle";
import {
  useWindowLayout,
  resolveWorkspaceActionPlacement,
  resolveWorkspaceBarActions,
  WindowLayoutActions,
} from "@/window-layout";
import { IconButtonChromeProvider } from "@/components/ui/icon-button-chrome";

export { MobileWorkspaceTabSwitcher } from "./tab-switcher";

interface CompactWorkspaceHeaderProps {
  isLoading: boolean;
  title: string;
  onToggleExplorer: () => void;
  explorerToggleLabel: string;
  explorerToggleAccessibilityState: { expanded: boolean };
  tabSwitcher: ReactNode;
  /** Workspace overflow menu. */
  children: ReactNode;
  headerVariant: "compact" | "full";
  actionsActive: boolean;
}

/** The compact conversation title and controls. */
export function CompactWorkspaceHeader({
  isLoading,
  title,
  onToggleExplorer,
  explorerToggleLabel,
  explorerToggleAccessibilityState,
  children,
  tabSwitcher,
  headerVariant,
  actionsActive,
}: CompactWorkspaceHeaderProps) {
  const { t } = useTranslation();
  const actionsInBar = resolveWorkspaceActionPlacement(useWindowLayout()) === "vertical-bar";
  const isAndroid = Platform.OS === "android";
  const symbols = {
    "tab-count": headerVariant === "compact" || isAndroid ? null : tabSwitcher,
    overflow: children,
    explorer: !isAndroid ? (
      <WorkspaceExplorerToggle
        onPress={onToggleExplorer}
        label={explorerToggleLabel}
        tooltipLabel={t("workspace.tabs.explorerSidebar.toggle")}
        tooltipKeys={EXPLORER_TOGGLE_KEYS}
        accessibilityState={explorerToggleAccessibilityState}
        mobile
      />
    ) : null,
  };
  const actions = resolveWorkspaceBarActions(headerVariant).map((symbol) => (
    <Fragment key={symbol}>{symbols[symbol]}</Fragment>
  ));

  return (
    <IconButtonChromeProvider value="header-island">
      {headerVariant === "compact" ? (
        <CompactHeader
          navigation="menu"
          title={title}
          titleTestID="workspace-header-title"
          loading={isLoading}
          actions={actionsInBar ? undefined : actions}
        />
      ) : null}
      <WindowLayoutActions active={actionsActive}>{actions}</WindowLayoutActions>
    </IconButtonChromeProvider>
  );
}
