"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Group, Panel, Separator } from "react-resizable-panels";
import { ChevronDown, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import ThemeToggle from "@/components/ThemeToggle";
import SourcesPane from "@/components/dashboard/SourcesPane";
import ChatPane from "@/components/dashboard/ChatPane";
import StudioPane from "@/components/dashboard/StudioPane";
import NotebookSidebar from "@/components/dashboard/NotebookSidebar";
import AddSourceModal, { type NewSourceDraft } from "@/components/dashboard/AddSourceModal";
import ArtifactModal from "@/components/dashboard/ArtifactModal";
import CitationModal from "@/components/dashboard/CitationModal";
import {
  type Artifact,
  type ArtifactType,
  type ChatMsg,
  type Notebook,
  type Source,
  type SourceKind,
} from "@/lib/types";

const TASK_LABELS: Record<ArtifactType, string> = {
  mindmap: "Mindmap",
  quiz: "Quiz",
  summary: "Summary",
  factcheck: "Fact-check",
  deep: "Deep research",
};

function newNotebook(title = "Untitled notebook"): Notebook {
  return {
    id: crypto.randomUUID(),
    title,
    createdAt: Date.now(),
    sources: [],
    chat: [],
    artifacts: [],
  };
}

type CitationState = {
  n: number;
  sourceTitle: string;
  content: string;
  loading: boolean;
} | null;

type Toast = { message: string; kind: "info" | "error" } | null;

export default function DashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [notebooks, setNotebooks] = useState<Notebook[]>(() => [newNotebook()]);
  const [activeId, setActiveId] = useState<string>("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<"sources" | "chat" | "studio">("chat");
  const [menuOpen, setMenuOpen] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [addKind, setAddKind] = useState<SourceKind | null>(null);
  const [runningTask, setRunningTask] = useState<ArtifactType | null>(null);
  const [studioError, setStudioError] = useState<string | null>(null);
  const [openArtifact, setOpenArtifact] = useState<Artifact | null>(null);
  const [citation, setCitation] = useState<CitationState>(null);
  const [toast, setToast] = useState<Toast>(null);

  /* ---------------- auth + load this user's workspace ---------------- */

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        router.replace("/auth");
        return;
      }
      const u = data.session.user;
      setEmail(u.email ?? null);
      setName((u.user_metadata?.full_name as string | undefined) ?? null);
      setUid(u.id);
      setAuthChecked(true);

      const { data: rows } = await supabase
        .from("notebooks")
        .select("*")
        .eq("user_id", u.id)
        .order("created_at", { ascending: true });

      let nbs: Notebook[] = (rows ?? []).map(
        (r: { id: string; title: string; created_at: string }) => ({
          id: r.id,
          title: r.title,
          createdAt: new Date(r.created_at).getTime(),
          sources: [],
          chat: [],
          artifacts: [],
        })
      );

      // first visit -> seed one empty notebook for this account
      if (nbs.length === 0) {
        const nb = newNotebook();
        await supabase.from("notebooks").insert({
          id: nb.id,
          user_id: u.id,
          title: nb.title,
          created_at: new Date(nb.createdAt).toISOString(),
        });
        nbs = [nb];
      }

      const ids = nbs.map((n) => n.id);
      const [{ data: srcRows }, { data: msgRows }, { data: artRows }] = await Promise.all([
        supabase.from("sources").select("*").in("notebook_id", ids),
        supabase
          .from("chat_messages")
          .select("*")
          .in("notebook_id", ids)
          .order("created_at", { ascending: true }),
        supabase.from("artifacts").select("*").in("notebook_id", ids),
      ]);

      const byId = new Map(nbs.map((n) => [n.id, n]));
      for (const r of (srcRows ?? []) as {
        notebook_id: string;
        id: string;
        title: string;
        meta: string;
        kind: SourceKind;
        status: Source["status"];
        enabled: boolean;
      }[]) {
        byId.get(r.notebook_id)?.sources.push({
          id: r.id,
          title: r.title,
          meta: r.meta,
          kind: r.kind,
          status: r.status,
          enabled: r.enabled,
        });
      }
      for (const r of (msgRows ?? []) as {
        notebook_id: string;
        role: "user" | "assistant";
        text: string;
        flag: string | null;
        citations: string[] | null;
      }[]) {
        byId.get(r.notebook_id)?.chat.push({
          role: r.role,
          text: r.text,
          refusal: r.flag === "refusal",
          notice: r.flag === "notice",
          error: r.flag === "error",
          citations: Array.isArray(r.citations) ? r.citations : undefined,
        });
      }
      for (const r of (artRows ?? []) as {
        notebook_id: string;
        id: string;
        type: ArtifactType;
        title: string;
        content: string;
        created_at: string;
      }[]) {
        byId.get(r.notebook_id)?.artifacts.push({
          id: r.id,
          type: r.type,
          title: r.title,
          content: r.content,
          createdAt: new Date(r.created_at).getTime(),
        });
      }

      setNotebooks(nbs);
      setActiveId(nbs[nbs.length - 1].id);
    });
  }, [router]);

  // keep activeId pointing at something
  useEffect(() => {
    if (!notebooks.some((n) => n.id === activeId)) {
      setActiveId(notebooks[0]?.id ?? "");
    }
  }, [notebooks, activeId]);

  // auto-hide toasts
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // auto-hide studio errors
  useEffect(() => {
    if (!studioError) return;
    const t = setTimeout(() => setStudioError(null), 5000);
    return () => clearTimeout(t);
  }, [studioError]);

  const active = notebooks.find((n) => n.id === activeId) ?? notebooks[0];

  const patchActive = useCallback(
    (patch: Partial<Notebook>) =>
      setNotebooks((ns) => ns.map((n) => (n.id === active.id ? { ...n, ...patch } : n))),
    [active.id]
  );

  const accessToken = async (): Promise<string | null> => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  };

  /* ---------------- ingestion (extract -> chunk -> embed -> index) ------- */

  const ingestDraft = async (draft: NewSourceDraft) => {
    const id = crypto.randomUUID();
    const src: Source = {
      id,
      title: draft.title,
      meta: draft.meta,
      kind: draft.kind,
      status: "processing",
      enabled: true,
    };
    patchActive({ sources: [...active.sources, src] });

    const { error: insertError } = await supabase.from("sources").insert({
      id,
      notebook_id: active.id,
      title: draft.title,
      meta: draft.meta,
      kind: draft.kind,
      status: "processing",
      enabled: true,
    });
    if (insertError) {
      patchActive({ sources: active.sources }); // roll back the optimistic row
      setToast({ message: `Could not save the source: ${insertError.message}`, kind: "error" });
      return;
    }

    const token = await accessToken();
    try {
      let res: Response;
      if (draft.file) {
        const fd = new FormData();
        fd.append("sourceType", "pdf");
        fd.append("sourceId", id);
        fd.append("file", draft.file);
        res = await fetch("/api/ingest", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
      } else {
        res = await fetch("/api/ingest", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceType: draft.kind,
            pathOrUrl: draft.url ?? draft.text,
            sourceId: id,
          }),
        });
      }
      const json = (await res.json()) as {
        error?: string;
        title?: string | null;
        chunkCount?: number;
      };
      if (!res.ok) throw new Error(json.error ?? "Ingestion failed.");

      setNotebooks((ns) =>
        ns.map((n) =>
          n.id === active.id
            ? {
                ...n,
                sources: n.sources.map((s) =>
                  s.id === id
                    ? {
                        ...s,
                        status: "ready" as const,
                        title: json.title ?? s.title,
                        meta: json.chunkCount
                          ? `${s.meta} · ${json.chunkCount} chunks`
                          : s.meta,
                      }
                    : s
                ),
              }
            : n
        )
      );
      setToast({ message: `${json.title ?? draft.title} indexed — ready to chat.`, kind: "info" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ingestion failed.";
      setNotebooks((ns) =>
        ns.map((n) =>
          n.id === active.id
            ? {
                ...n,
                sources: n.sources.map((s) =>
                  s.id === id ? { ...s, status: "failed" as const, meta: message.slice(0, 80) } : s
                ),
              }
            : n
        )
      );
      await supabase.from("sources").update({ status: "failed" }).eq("id", id);
      setToast({ message, kind: "error" });
    }
  };

  const toggleSource = (id: string) => {
    const next = !(active.sources.find((s) => s.id === id)?.enabled ?? false);
    patchActive({
      sources: active.sources.map((s) => (s.id === id ? { ...s, enabled: next } : s)),
    });
    void supabase.from("sources").update({ enabled: next }).eq("id", id);
  };

  const deleteSource = (id: string) => {
    patchActive({ sources: active.sources.filter((s) => s.id !== id) });
    void supabase.from("sources").delete().eq("id", id); // chunks cascade
  };

  /* ---------------- chat (search -> rerank -> generate) ---------------- */

  const sendChat = (text: string) => {
    const history = active.chat
      .filter((m) => !m.error)
      .slice(-6)
      .map((m) => ({ role: m.role, text: m.text }));
    patchActive({ chat: [...active.chat, { role: "user", text }] });
    void supabase.from("chat_messages").insert({ notebook_id: active.id, role: "user", text });

    const readySources = active.sources.filter((s) => s.enabled && s.status === "ready");
    if (readySources.length === 0) {
      const reply: ChatMsg = {
        role: "assistant",
        refusal: true,
        text: "I don't know about this. Nothing related is stated in the sources — attach sources first, then ask.",
      };
      patchActive({ chat: [...active.chat, { role: "user", text }, reply] });
      void supabase.from("chat_messages").insert({
        notebook_id: active.id,
        role: "assistant",
        text: reply.text,
        flag: "refusal",
      });
      return;
    }

    setThinking(true);
    setStreamingText("");

    (async () => {
      let finalText: string | null = null;
      let citations: string[] = [];
      let errorMessage: string | null = null;
      try {
        const token = await accessToken();
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            query: text,
            sourceIds: readySources.map((s) => s.id),
            history,
          }),
        });

        if (!res.ok) {
          const json = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(json.error ?? "Chat failed.");
        }

        citations = JSON.parse(res.headers.get("X-Citation-Chunk-Ids") ?? "[]") as string[];
        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response stream.");
        const decoder = new TextDecoder();
        let acc = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          setStreamingText(acc);
        }
        finalText = acc.trim();
      } catch (err) {
        errorMessage = err instanceof Error ? err.message : "Chat failed.";
      }

      setThinking(false);
      setStreamingText(null);

      if (errorMessage) {
        const reply: ChatMsg = {
          role: "assistant",
          text: `Something broke while answering: ${errorMessage}`,
          error: true,
        };
        setNotebooks((ns) =>
          ns.map((n) => (n.id === active.id ? { ...n, chat: [...n.chat, reply] } : n))
        );
        void supabase.from("chat_messages").insert({
          notebook_id: active.id,
          role: "assistant",
          text: reply.text,
          flag: "error",
        });
        return;
      }

      if (finalText) {
        const reply: ChatMsg = { role: "assistant", text: finalText, citations };
        setNotebooks((ns) =>
          ns.map((n) => (n.id === active.id ? { ...n, chat: [...n.chat, reply] } : n))
        );
        void supabase.from("chat_messages").insert({
          notebook_id: active.id,
          role: "assistant",
          text: finalText,
          citations,
        });
      }
    })();
  };

  const openCitation = async (msgIndex: number, n: number) => {
    const msg = active.chat[msgIndex];
    const chunkId = msg?.citations?.[n - 1];
    if (!chunkId) return;
    setCitation({ n, sourceTitle: "source", content: "", loading: true });
    try {
      const token = await accessToken();
      const res = await fetch(`/api/chunks?id=${chunkId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json()) as { error?: string; content?: string; sourceTitle?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not load that citation.");
      setCitation({
        n,
        sourceTitle: json.sourceTitle ?? "source",
        content: json.content ?? "",
        loading: false,
      });
    } catch (err) {
      setCitation(null);
      setToast({
        message: err instanceof Error ? err.message : "Could not load that citation.",
        kind: "error",
      });
    }
  };

  /* ---------------- studio ---------------- */

  const runStudio = (type: ArtifactType) => {
    const readySources = active.sources.filter((s) => s.enabled && s.status === "ready");
    if (readySources.length === 0 || runningTask) return;
    setRunningTask(type);
    setStudioError(null);

    (async () => {
      try {
        const token = await accessToken();
        const res = await fetch("/api/studio", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ task: type, sourceIds: readySources.map((s) => s.id) }),
        });
        const json = (await res.json()) as { error?: string; content?: string };
        if (!res.ok || !json.content) throw new Error(json.error ?? "Studio task failed.");

        // pick a nice title: quiz JSON carries its own
        let title = TASK_LABELS[type];
        if (type === "quiz") {
          try {
            const parsed = JSON.parse(json.content) as { title?: string };
            if (parsed.title) title = parsed.title;
          } catch {
            /* keep default */
          }
        }

        const artifact: Artifact = {
          id: crypto.randomUUID(),
          type,
          title,
          content: json.content,
          createdAt: Date.now(),
        };
        const { error: insertError } = await supabase.from("artifacts").insert({
          id: artifact.id,
          notebook_id: active.id,
          type,
          title,
          content: json.content,
        });
        if (insertError) throw new Error(insertError.message);

        setNotebooks((ns) =>
          ns.map((n) => (n.id === active.id ? { ...n, artifacts: [...n.artifacts, artifact] } : n))
        );
        setOpenArtifact(artifact);
      } catch (err) {
        setStudioError(err instanceof Error ? err.message : "Studio task failed.");
      } finally {
        setRunningTask(null);
      }
    })();
  };

  const deleteArtifact = (id: string) => {
    patchActive({ artifacts: active.artifacts.filter((a) => a.id !== id) });
    void supabase.from("artifacts").delete().eq("id", id);
  };

  /* ---------------- notebooks ---------------- */

  const createNotebook = () => {
    const nb = newNotebook(`Untitled notebook ${notebooks.length + 1}`);
    setNotebooks((ns) => [...ns, nb]);
    setActiveId(nb.id);
    setSidebarOpen(false);
    void supabase.from("notebooks").insert({
      id: nb.id,
      user_id: uid,
      title: nb.title,
      created_at: new Date(nb.createdAt).toISOString(),
    });
  };

  const deleteNotebook = (id: string) => {
    if (notebooks.length <= 1) return;
    const rest = notebooks.filter((n) => n.id !== id);
    setNotebooks(rest);
    if (id === activeId) setActiveId(rest[0].id);
    // sources, chat, artifacts cascade in the database
    void supabase.from("notebooks").delete().eq("id", id);
  };

  const renameNotebook = (title: string) => {
    patchActive({ title });
    void supabase
      .from("notebooks")
      .update({ title, updated_at: new Date().toISOString() })
      .eq("id", active.id);
  };

  /* ---------------- derived ---------------- */

  const readyCount = active?.sources.filter((s) => s.enabled && s.status === "ready").length ?? 0;

  const sourcesPane = (
    <SourcesPane
      sources={active?.sources ?? []}
      onAdd={(k) => setAddKind(k)}
      onToggle={toggleSource}
      onDelete={deleteSource}
    />
  );
  const chatPane = (
    <ChatPane
      notebook={active ?? newNotebook()}
      onRename={renameNotebook}
      onSend={sendChat}
      thinking={thinking}
      streamingText={streamingText}
      onOpenSidebar={() => setSidebarOpen(true)}
      onCitation={openCitation}
    />
  );
  const studioPane = (
    <StudioPane
      sourceCount={readyCount}
      artifacts={active?.artifacts ?? []}
      running={runningTask}
      error={studioError}
      onRun={runStudio}
      onOpen={setOpenArtifact}
      onDeleteArtifact={deleteArtifact}
    />
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* bg + grid + frame */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-app">
        <div className="bg-grid absolute inset-0" />
      </div>
      <div aria-hidden className="pointer-events-none fixed inset-0 z-60 border-2 border-line" />

      {/* top bar */}
      <header className="relative z-30 flex h-14 shrink-0 items-center justify-between border-b-2 border-line bg-surface px-4 sm:px-5">
        <div className="flex items-center gap-4">
          <a href="/" className="group flex items-center gap-2.5">
            <Image
              src="/logo.png"
              alt="OpenbookLM Logo"
              width={28}
              height={28}
              className="h-7 w-7 transition-transform group-hover:-translate-y-0.5"
            />
            <span className="font-mono text-sm font-bold tracking-tight text-app">OpenbookLM</span>
          </a>
          <span className="hidden h-6 w-0.5 bg-line md:block" aria-hidden />
          <span className="hidden truncate font-mono text-[12px] text-muted-c md:block">
            {authChecked ? (name ?? email ?? "") : "…"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden h-9 items-center gap-1.5 rounded-sm border-2 border-line bg-surface-2 px-2.5 font-mono text-[10px] text-muted-c sm:inline-flex">
            <span className={`h-1.5 w-1.5 rounded-full ${readyCount > 0 ? "bg-emerald-500" : "bg-muted-c"}`} />
            {readyCount} source{readyCount === 1 ? "" : "s"} active
          </span>
          <ThemeToggle />
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border-2 border-line bg-surface px-3 font-mono text-[12px] font-bold text-app transition-all duration-150 hover:-translate-y-0.5 hover:shadow-hard-sm active:translate-y-0.5 active:shadow-none"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-sm bg-ink font-mono text-[10px] text-on-ink">
                {(name ?? email ?? "?").charAt(0).toUpperCase()}
              </span>
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {menuOpen && (
              <div className="anim-rise absolute right-0 top-full z-50 mt-1.5 w-44 overflow-hidden rounded-md border-2 border-line bg-surface shadow-hard-lg">
                <p className="border-b border-line px-3 py-2 font-mono text-[10px] text-muted-c">{email}</p>
                <button
                  type="button"
                  onClick={signOut}
                  className="flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-left font-mono text-[12px] text-app transition-colors hover:bg-chip"
                >
                  <X className="h-3.5 w-3.5" /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* mobile tab switcher */}
      <div className="relative z-20 grid shrink-0 grid-cols-3 border-b-2 border-line bg-surface md:hidden">
        {(
          [
            ["sources", "Sources"],
            ["chat", "Chat"],
            ["studio", "Studio"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setMobileTab(id)}
            className={`cursor-pointer border-r-2 border-line py-2.5 font-mono text-[12px] font-bold transition-colors last:border-r-0 ${
              mobileTab === id ? "bg-ink text-on-ink" : "text-muted-c"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* main: blurs behind the notebook sidebar */}
      <main className="relative z-10 min-h-0 flex-1">
        <div className={`h-full transition-[filter] duration-200 ${sidebarOpen ? "blur-[2px]" : ""}`}>
          {/* desktop */}
          <div className="hidden h-full md:block">
            <Group orientation="horizontal" className="h-full">
              <Panel defaultSize={25} minSize={15} className="border-r-2 border-line bg-surface">
                {sourcesPane}
              </Panel>
              <Separator className="group relative w-0.5 cursor-col-resize bg-line transition-colors hover:bg-(--accent)" />
              <Panel defaultSize={55} minSize={30} className="bg-surface">
                {chatPane}
              </Panel>
              <Separator className="group relative w-0.5 cursor-col-resize bg-line transition-colors hover:bg-(--accent)" />
              <Panel defaultSize={20} minSize={14} className="border-l-2 border-line bg-surface">
                {studioPane}
              </Panel>
            </Group>
          </div>

          {/* mobile */}
          <div className="h-full md:hidden">
            {mobileTab === "sources" && sourcesPane}
            {mobileTab === "chat" && chatPane}
            {mobileTab === "studio" && studioPane}
          </div>
        </div>

        {sidebarOpen && authChecked && active && (
          <NotebookSidebar
            notebooks={notebooks}
            activeId={activeId}
            onSwitch={(id) => {
              setActiveId(id);
              setSidebarOpen(false);
            }}
            onNew={createNotebook}
            onDelete={deleteNotebook}
            onClose={() => setSidebarOpen(false)}
          />
        )}
      </main>

      {/* modals */}
      {addKind && (
        <AddSourceModal kind={addKind} onClose={() => setAddKind(null)} onAdd={ingestDraft} />
      )}
      {openArtifact && <ArtifactModal artifact={openArtifact} onClose={() => setOpenArtifact(null)} />}
      {citation && (
        <CitationModal
          citationNumber={citation.n}
          sourceTitle={citation.sourceTitle}
          content={citation.loading ? "loading the passage…" : citation.content}
          onClose={() => setCitation(null)}
        />
      )}

      {/* toast */}
      {toast && (
        <div
          className={`anim-rise fixed bottom-5 left-1/2 z-90 flex max-w-md -translate-x-1/2 items-start gap-2 rounded-md border-2 px-3.5 py-2.5 font-mono text-[11.5px] leading-relaxed shadow-hard-lg ${
            toast.kind === "error"
              ? "border-rose-600 bg-rose-500/10 text-rose-700 dark:text-rose-400"
              : "border-line bg-surface text-app"
          }`}
        >
          <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${toast.kind === "error" ? "bg-rose-600" : "bg-emerald-500"}`} />
          {toast.message}
        </div>
      )}
    </div>
  );
}
