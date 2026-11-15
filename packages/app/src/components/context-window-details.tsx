import { useMemo } from "react";
import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { AgentUsage } from "@/usage";
import { useSessionStore } from "@/stores/session-store";
import {
  formatSessionCost,
  getUsagePercentage,
  formatTokenCount,
} from "./context-window-meter.utils";

interface ContextWindowDetailsProps {
  serverId: string;
  agentId: string;
  context: {
    percentage: number;
    usedTokens: number;
    maxTokens: number;
  } | null;
  sessionCost: string | null;
  /** The hover card and tooltip title themselves; the sheet's header carries the title instead. */
  showTitle: boolean;
  /** Whether the usage cards have a Refresh button; without one they show their freshness. */
  refreshable: boolean;
}

/**
 * What the context window meter opens: how full the window is, then the usage of the agent's
 * account. The desktop hover card, the native wide tooltip, and the compact sheet all render it.
 */
export function ContextWindowDetails({
  serverId,
  agentId,
  context,
  sessionCost,
  showTitle,
  refreshable,
}: ContextWindowDetailsProps) {
  const { t } = useTranslation();
  return (
    <>
      <View style={styles.summary}>
        {showTitle ? <Text style={styles.title}>{t("contextWindow.title")}</Text> : null}
        {context ? (
          <>
            <Text style={styles.text}>
              {t("contextWindow.used", { percentage: context.percentage })}
            </Text>
            <Text style={styles.detail}>
              {t("contextWindow.tokens", {
                used: formatTokenCount(context.usedTokens),
                max: formatTokenCount(context.maxTokens),
              })}
            </Text>
          </>
        ) : (
          <Text style={styles.detail}>{t("contextWindow.noData")}</Text>
        )}
        {sessionCost ? (
          <Text style={styles.detail}>{t("contextWindow.sessionCost", { cost: sessionCost })}</Text>
        ) : null}
      </View>
      <AgentUsage serverId={serverId} agentId={agentId} refreshable={refreshable} />
    </>
  );
}

export function AgentContextWindowDetails({
  serverId,
  agentId,
}: {
  serverId: string;
  agentId: string;
}) {
  const usage = useSessionStore(
    (state) => state.sessions[serverId]?.agents.get(agentId)?.lastUsage,
  );
  const maxTokens = usage?.contextWindowMaxTokens ?? null;
  const usedTokens = usage?.contextWindowUsedTokens ?? null;
  const percentage =
    maxTokens !== null && usedTokens !== null ? getUsagePercentage(maxTokens, usedTokens) : null;
  const context = useMemo(
    () =>
      percentage !== null && maxTokens !== null && usedTokens !== null
        ? { percentage: Math.round(percentage), maxTokens, usedTokens }
        : null,
    [percentage, maxTokens, usedTokens],
  );
  return (
    <View style={styles.menuDetails}>
      <ContextWindowDetails
        serverId={serverId}
        agentId={agentId}
        context={context}
        sessionCost={
          typeof usage?.totalCostUsd === "number" ? formatSessionCost(usage.totalCostUsd) : null
        }
        showTitle={false}
        refreshable
      />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  menuDetails: { padding: theme.spacing[4], gap: theme.spacing[4] },
  summary: {
    gap: theme.spacing[1.5],
    minWidth: 200,
  },
  title: {
    color: theme.colors.foreground,
    fontSize: theme.fontSize.base,
  },
  text: {
    color: theme.colors.foreground,
    fontSize: theme.fontSize.base,
    lineHeight: theme.fontSize.base * 1.4,
  },
  detail: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.sm,
    lineHeight: theme.fontSize.sm * 1.4,
  },
}));
