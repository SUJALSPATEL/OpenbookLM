"use client";

import Link from 'next/link';
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

/* ---------------- db row -> app state mappers ---------------- */

type SourceRow = {
  id: string;
  title: string;
  meta: string;
  kind: SourceKind;
  status: Source["status"];
  enabled: boolean;
};

function mapSourceRow(r: SourceRow): Source {
  return { id: r.id, title: r.title, meta: r.meta, kind: r.kind, status: r.status, enabled: r.enabled };
}

type MsgRow = {
  role: "user" | "assistant";
  text: string;
  flag: string | null;
  citations: string[] | null;
};

function mapMsgRow(r: MsgRow): ChatMsg {
  return {
    role: r.role,
    text: r.text,
    refusal: r.flag === "refusal",
    notice: r.flag === "notice",
    error: r.flag === "error",
    citations: Array.isArray(r.citations) ? r.citations : undefined,
  };
}

type ArtifactRow = {
  id: string;
  type: ArtifactType;
  title: string;
  content: string;
  created_at: string;
};

function mapArtifactRow(r: ArtifactRow): Artifact {
  return { id: r.id, type: r.type, title: r.title, content: r.content, createdAt: new Date(r.created_at).getTime() };
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
        const { error: seedErr } = await supabase.from("notebooks").insert({
          id: nb.id,
          user_id: u.id,
          title: nb.title,
          created_at: new Date(nb.createdAt).toISOString(),
        });
        if (seedErr) setToast({ message: `Could not create your first notebook: ${seedErr.message}`, kind: "error" });
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
      for (const r of (srcRows ?? []) as (SourceRow & { notebook_id: string })[]) {
        byId.get(r.notebook_id)?.sources.push(mapSourceRow(r));
      }
      for (const r of (msgRows ?? []) as (MsgRow & { notebook_id: string })[]) {
        byId.get(r.notebook_id)?.chat.push(mapMsgRow(r));
      }
      for (const r of (artRows ?? []) as (ArtifactRow & { notebook_id: string })[]) {
        byId.get(r.notebook_id)?.artifacts.push(mapArtifactRow(r));
      }

      setNotebooks(nbs);

      // Per browser session: refreshes keep the same workspace, but every
      // fresh login lands on a brand-new notebook — the previous ones stay
      // in the notebook history sidebar with all their sources, chat, and
      // studio artifacts (all persisted in Supabase under this account).
      const sessionKey = `oblm-workspace-${u.id}`;
      let remembered: string | null = null;
      try {
        remembered = sessionStorage.getItem(sessionKey);
      } catch {
        /* private mode — treat as fresh */
      }

      let activeNotebookId =
        remembered && nbs.some((n) => n.id === remembered) ? remembered : null;

      if (!activeNotebookId) {
        const newest = nbs[nbs.length - 1];
        const untouched =
          newest &&
          newest.sources.length === 0 &&
          newest.chat.length === 0 &&
          newest.artifacts.length === 0;
        if (untouched) {
          // newest notebook was never used — start there instead of stacking empties
          activeNotebookId = newest.id;
        } else {
          // previous session had content -> open a fresh notebook for this login
          const nb = newNotebook(`Untitled notebook ${nbs.length + 1}`);
          const { error: freshErr } = await supabase.from("notebooks").insert({
            id: nb.id,
            user_id: u.id,
            title: nb.title,
            created_at: new Date(nb.createdAt).toISOString(),
          });
          if (freshErr) {
            // no phantom notebooks — stay in the newest one and say why
            setToast({ message: `Could not start a new notebook: ${freshErr.message}`, kind: "error" });
            activeNotebookId = newest.id;
          } else {
            nbs = [...nbs, nb];
            activeNotebookId = nb.id;
          }
        }
      }

      try {
        sessionStorage.setItem(sessionKey, activeNotebookId);
      } catch {
        /* private mode — refreshes will just pick the newest empty notebook */
      }
      setNotebooks(nbs);
      setActiveId(activeNotebookId);
    });
  }, [router]);

  // keep the remembered workspace in sync as the user switches notebooks
  useEffect(() => {
    if (!activeId || !uid) return;
    try {
      sessionStorage.setItem(`oblm-workspace-${uid}`, activeId);
    } catch {
      /* private mode */
    }
  }, [activeId, uid]);

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

  /**
   * Re-fetches one notebook's sources, chat, and artifacts straight from
   * Supabase and replaces the in-memory copy — so whatever the database says
   * is what the dashboard shows. Called whenever a notebook is opened from
   * the history sidebar: deleted sources can never linger, and rows added
   * elsewhere show up.
   */
  const refreshNotebook = useCallback(async (id: string) => {
    const [{ data: srcRows, error: srcErr }, { data: msgRows, error: msgErr }, { data: artRows, error: artErr }] =
      await Promise.all([
        supabase.from("sources").select("*").eq("notebook_id", id),
        supabase
          .from("chat_messages")
          .select("*")
          .eq("notebook_id", id)
          .order("created_at", { ascending: true }),
        supabase.from("artifacts").select("*").eq("notebook_id", id),
      ]);
    if (srcErr || msgErr || artErr) {
      setToast({
        message: `Could not refresh this notebook: ${(srcErr ?? msgErr ?? artErr)?.message}`,
        kind: "error",
      });
      return;
    }
    setNotebooks((ns) =>
      ns.map((n) =>
        n.id === id
          ? {
              ...n,
              sources: (srcRows ?? []).map(mapSourceRow),
              chat: (msgRows ?? []).map(mapMsgRow),
              artifacts: (artRows ?? []).map(mapArtifactRow),
            }
          : n
      )
    );
  }, []);

  const signOut = async () => {
    // drop the workspace memory so the next login opens a fresh notebook
    if (uid) {
      try {
        sessionStorage.removeItem(`oblm-workspace-${uid}`);
      } catch {
        /* private mode */
      }
    }
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
    setNotebooks((ns) =>
      ns.map((n) =>
        n.id === active.id
          ? { ...n, sources: n.sources.map((s) => (s.id === id ? { ...s, enabled: next } : s)) }
          : n
      )
    );
    supabase
      .from("sources")
      .update({ enabled: next })
      .eq("id", id)
      .then(({ error }) => {
        if (error) {
          // flip the switch back — the DB didn't take it
          setNotebooks((ns) =>
            ns.map((n) =>
              n.id === active.id
                ? { ...n, sources: n.sources.map((s) => (s.id === id ? { ...s, enabled: !next } : s)) }
                : n
            )
          );
          setToast({ message: `Could not update the source: ${error.message}`, kind: "error" });
        }
      });
  };

  const deleteSource = (id: string) => {
    const removed = active.sources.find((s) => s.id === id);
    // remove from state first (snappy UI), but confirm the DB delete — if it
    // fails the row would silently survive and reappear on next login
    setNotebooks((ns) =>
      ns.map((n) =>
        n.id === active.id ? { ...n, sources: n.sources.filter((s) => s.id !== id) } : n
      )
    );
    supabase
      .from("sources")
      .delete()
      .eq("id", id)
      .then(({ error }) => {
        if (error) {
          // put the card back and tell the user
          setNotebooks((ns) =>
            ns.map((n) => {
              if (n.id !== active.id || !removed || n.sources.some((s) => s.id === id)) return n;
              return { ...n, sources: [...n.sources, removed] };
            })
          );
          setToast({ message: `Could not delete the source: ${error.message}`, kind: "error" });
        }
      });
  };

  /* ---------------- chat (search -> rerank -> generate) ---------------- */

  /**
   * Best-effort client-side fallback for messages the server never sees
   * (local refusals, network failures). The main chat flow persists history
   * server-side in /api/chat — this is only for the edge cases.
   */
  const saveMsg = (row: {
    notebook_id: string;
    role: "user" | "assistant";
    text: string;
    flag?: string;
    citations?: string[];
  }) => {
    supabase
      .from("chat_messages")
      .insert(row)
      .then(({ error }) => {
        if (error)
          setToast({ message: `Chat history not saved: ${error.message}`, kind: "error" });
      });
  };

  const sendChat = (text: string) => {
    const history = active.chat
      .filter((m) => !m.error)
      .slice(-6)
      .map((m) => ({ role: m.role, text: m.text }));
    // NOTE: the user message and the answer are persisted by /api/chat itself
    patchActive({ chat: [...active.chat, { role: "user", text }] });

    const readySources = active.sources.filter((s) => s.enabled && s.status === "ready");
    if (readySources.length === 0) {
      const reply: ChatMsg = {
        role: "assistant",
        refusal: true,
        text: "I don't know about this. Nothing related is stated in the sources — attach sources first, then ask.",
      };
      patchActive({ chat: [...active.chat, { role: "user", text }, reply] });
      saveMsg({ notebook_id: active.id, role: "user", text });
      saveMsg({
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
      let reachedServer = false;
      try {
        const token = await accessToken();
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            notebook_id: active.id,
            query: text,
            sourceIds: readySources.map((s) => s.id),
            history,
          }),
        });
        reachedServer = true;

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
        saveMsg({
          notebook_id: active.id,
          role: "assistant",
          text: reply.text,
          flag: "error",
        });
        // if the request never reached the server, the user message wasn't
        // persisted there either — save it here so history stays honest
        if (!reachedServer) saveMsg({ notebook_id: active.id, role: "user", text });
        return;
      }

      if (finalText) {
        const reply: ChatMsg = { role: "assistant", text: finalText, citations };
        setNotebooks((ns) =>
          ns.map((n) => (n.id === active.id ? { ...n, chat: [...n.chat, reply] } : n))
        );
        // the server persisted the user message and this answer (with citations)
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
    const removed = active.artifacts.find((a) => a.id === id);
    setNotebooks((ns) =>
      ns.map((n) =>
        n.id === active.id ? { ...n, artifacts: n.artifacts.filter((a) => a.id !== id) } : n
      )
    );
    supabase
      .from("artifacts")
      .delete()
      .eq("id", id)
      .then(({ error }) => {
        if (error) {
          setNotebooks((ns) =>
            ns.map((n) => {
              if (n.id !== active.id || !removed || n.artifacts.some((a) => a.id === id)) return n;
              return { ...n, artifacts: [...n.artifacts, removed] };
            })
          );
          setToast({ message: `Could not delete the artifact: ${error.message}`, kind: "error" });
        }
      });
  };

  /* ---------------- notebooks ---------------- */

  const createNotebook = () => {
    const nb = newNotebook(`Untitled notebook ${notebooks.length + 1}`);
    setNotebooks((ns) => [...ns, nb]);
    setActiveId(nb.id);
    setSidebarOpen(false);
    supabase
      .from("notebooks")
      .insert({
        id: nb.id,
        user_id: uid,
        title: nb.title,
        created_at: new Date(nb.createdAt).toISOString(),
      })
      .then(({ error }) => {
        if (error) {
          // drop the phantom notebook — it only exists in memory
          setNotebooks((ns) => ns.filter((n) => n.id !== nb.id));
          if (activeId === nb.id) setActiveId(notebooks[0]?.id ?? null);
          setToast({ message: `Could not create the notebook: ${error.message}`, kind: "error" });
        }
      });
  };

  const deleteNotebook = (id: string) => {
    if (notebooks.length <= 1) return;
    const removed = notebooks.find((n) => n.id === id);
    const rest = notebooks.filter((n) => n.id !== id);
    setNotebooks(rest);
    if (id === activeId) setActiveId(rest[0].id);
    // sources, chat, artifacts, and chunks cascade in the database
    supabase
      .from("notebooks")
      .delete()
      .eq("id", id)
      .then(({ error }) => {
        if (error) {
          // put the notebook back — the cascade delete didn't happen
          setNotebooks((ns) => (ns.some((n) => n.id === id) || !removed ? ns : [...ns, removed]));
          setToast({ message: `Could not delete the notebook: ${error.message}`, kind: "error" });
        }
      });
  };

  const renameNotebook = (title: string) => {
    const prevTitle = active.title;
    patchActive({ title });
    supabase
      .from("notebooks")
      .update({ title, updated_at: new Date().toISOString() })
      .eq("id", active.id)
      .then(({ error }) => {
        if (error) {
          // put the old name back so the UI keeps telling the truth
          patchActive({ title: prevTitle });
          setToast({ message: `Could not rename the notebook: ${error.message}`, kind: "error" });
        }
      });
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
          <Link href="/" className="group flex items-center gap-2.5">
            <Image
              src="/logo.png"
              alt="OpenbookLM Logo"
              width={28}
              height={28}
              className="h-7 w-7 transition-transform group-hover:-translate-y-0.5"
            />
            <span className="font-mono text-sm font-bold tracking-tight text-app">OpenbookLM</span>
          </Link>
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
              <Panel defaultSize={25} minSize={15} className="border-r-2 border-line">
                {sourcesPane}
              </Panel>
              <Separator className="group relative w-0.5 cursor-col-resize bg-line transition-colors hover:bg-(--accent)" />
              <Panel defaultSize={55} minSize={30}>
                {chatPane}
              </Panel>
              <Separator className="group relative w-0.5 cursor-col-resize bg-line transition-colors hover:bg-(--accent)" />
              <Panel defaultSize={20} minSize={14} className="border-l-2 border-line">
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
              // the notebook you open is always re-fetched from the database,
              // so deleted sources never come back and renames always stick
              void refreshNotebook(id);
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
