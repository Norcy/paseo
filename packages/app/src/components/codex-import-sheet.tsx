import type { Theme } from "@/styles/theme";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { StyleSheet, withUnistyles } from "react-native-unistyles";
import type { CodexImportJob } from "@getpaseo/protocol/messages";
import { AdaptiveModalSheet } from "@/components/adaptive-modal-sheet";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useHostFeature } from "@/runtime/host-features";
import { useHostRuntimeClient, useHostRuntimeIsConnected } from "@/runtime/host-runtime";

const ThemedLoadingSpinner = withUnistyles(LoadingSpinner);
const spinnerColor = (theme: Theme) => ({ color: theme.colors.foregroundMuted });

export function CodexImportSheet({ serverId, onClose }: { serverId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const client = useHostRuntimeClient(serverId);
  const connected = useHostRuntimeIsConnected(serverId);
  const supported = useHostFeature(serverId, "codexBulkImport");
  const started = useRef(false);
  const [job, setJob] = useState<CodexImportJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const start = useCallback(async () => {
    if (!client) return;
    setStarting(true);
    setError(null);
    try {
      const next = await client.startCodexImport();
      if (mounted.current) setJob(next);
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (mounted.current) setStarting(false);
    }
  }, [client]);

  useEffect(() => {
    if (!client || !connected || !supported || started.current) return;
    started.current = true;
    void start();
  }, [client, connected, supported, start]);

  useEffect(() => {
    if (!client || !connected || job?.status !== "running") return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const result = await client.getCodexImport();
        if (cancelled) return;
        if (!result.job) throw new Error(t("importSession.bulk.interrupted"));
        setJob(result.job);
        setError(null);
        if (result.job.status === "running") timer = setTimeout(poll, 1000);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      }
    };
    timer = setTimeout(poll, 1000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [client, connected, job?.status, starting, t]);

  const header = useMemo(() => ({ title: t("importSession.bulk.title") }), [t]);
  const retry = useCallback(() => {
    void start();
  }, [start]);
  return (
    <AdaptiveModalSheet visible onClose={onClose} header={header} testID="codex-import-sheet">
      <View style={styles.content}>
        <Text style={styles.hint}>{t("importSession.bulk.description")}</Text>
        {!connected ? (
          <Alert variant="error" description={t("workspace.terminal.hostDisconnected")} />
        ) : null}
        {connected && !supported ? (
          <Alert variant="info" description={t("importSession.status.updateHost")} />
        ) : null}
        {connected && supported ? (
          <CodexImportProgress job={job} error={error} starting={starting} onRetry={retry} />
        ) : null}
        <Text style={styles.hint}>{t("importSession.bulk.background")}</Text>
      </View>
    </AdaptiveModalSheet>
  );
}

function CodexImportProgress({
  job,
  error,
  starting,
  onRetry,
}: {
  job: CodexImportJob | null;
  error: string | null;
  starting: boolean;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  const running = starting || !job || job.status === "running";
  const failed = error || job?.error;
  return (
    <>
      {running && !failed ? (
        <View style={styles.progress}>
          <ThemedLoadingSpinner size="small" uniProps={spinnerColor} />
          <Text style={styles.text}>
            {job?.total
              ? t("importSession.bulk.progress", {
                  done: job.imported + job.skipped + job.failures.length,
                  total: job.total,
                })
              : t("importSession.bulk.scanning")}
          </Text>
        </View>
      ) : null}
      {job ? <CodexImportSummary job={job} running={running} failed={Boolean(failed)} /> : null}
      {failed ? <Alert variant="error" description={failed} /> : null}
      {failed || (!running && job?.failures.length) ? (
        <Button disabled={starting} onPress={onRetry}>
          {t("importSession.bulk.retry")}
        </Button>
      ) : null}
    </>
  );
}

function CodexImportSummary({
  job,
  running,
  failed,
}: {
  job: CodexImportJob;
  running: boolean;
  failed: boolean;
}) {
  const { t } = useTranslation();
  return (
    <>
      <Text style={styles.text}>
        {t("importSession.bulk.result", {
          imported: job.imported,
          skipped: job.skipped,
          failed: job.failures.length,
        })}
      </Text>
      {job.currentTitle ? (
        <Text style={styles.hint} numberOfLines={2}>
          {job.currentTitle}
        </Text>
      ) : null}
      {!running && !failed ? (
        <Alert
          variant={job.failures.length ? "warning" : "success"}
          description={t("importSession.bulk.completed")}
        />
      ) : null}
      {job.failures.map((failure) => (
        <Alert
          key={failure.sessionId}
          variant="error"
          title={failure.title}
          description={failure.error}
        />
      ))}
    </>
  );
}

const styles = StyleSheet.create((theme) => ({
  content: { gap: theme.spacing[3], padding: theme.spacing[4] },
  progress: { flexDirection: "row", alignItems: "center", gap: theme.spacing[2] },
  text: { color: theme.colors.foreground, fontSize: theme.fontSize.base },
  hint: { color: theme.colors.foregroundMuted, fontSize: theme.fontSize.sm },
}));
