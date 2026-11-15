import type { CodexImportJob } from "@getpaseo/protocol/messages";

export interface CodexImportCandidate {
  providerHandleId: string;
  cwd: string;
  title: string | null;
  firstPromptPreview: string | null;
}

interface CodexImportDependencies {
  list: () => Promise<CodexImportCandidate[]>;
  isImported: (sessionId: string) => Promise<boolean>;
  import: (session: CodexImportCandidate) => Promise<void>;
}

/** One host-owned job survives the requesting socket and deduplicates repeated starts. */
export class CodexSessionImport {
  private job: CodexImportJob | null = null;

  get(): CodexImportJob | null {
    return this.job ? structuredClone(this.job) : null;
  }

  start(deps: CodexImportDependencies): CodexImportJob {
    if (this.job?.status === "running") return this.get()!;
    const job: CodexImportJob = {
      status: "running",
      total: 0,
      imported: 0,
      skipped: 0,
      currentTitle: null,
      failures: [],
      error: null,
    };
    this.job = job;
    void this.run(job, deps);
    return this.get()!;
  }

  private async run(job: CodexImportJob, deps: CodexImportDependencies): Promise<void> {
    try {
      const sessions = await deps.list();
      const unique = [
        ...new Map(sessions.map((session) => [session.providerHandleId, session])).values(),
      ];
      job.total = unique.length;
      for (const session of unique) {
        const title = session.title || session.firstPromptPreview || session.providerHandleId;
        job.currentTitle = title;
        try {
          if (await deps.isImported(session.providerHandleId)) {
            job.skipped++;
            continue;
          }
          await deps.import(session);
          job.imported++;
        } catch (error) {
          // A manual import can win the same per-session mutation lane meanwhile.
          if (await deps.isImported(session.providerHandleId)) {
            job.skipped++;
          } else {
            job.failures.push({
              sessionId: session.providerHandleId,
              title,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }
    } catch (error) {
      job.error = error instanceof Error ? error.message : String(error);
    } finally {
      job.currentTitle = null;
      job.status = "completed";
    }
  }
}

const imports = new WeakMap<object, CodexSessionImport>();
export function codexSessionImportForHost(owner: object): CodexSessionImport {
  let job = imports.get(owner);
  if (!job) {
    job = new CodexSessionImport();
    imports.set(owner, job);
  }
  return job;
}
