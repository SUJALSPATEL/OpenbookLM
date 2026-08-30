export type SourceStatus = "ready" | "processing" | "failed";
export type SourceKind = "url" | "pdf" | "youtube" | "text";

export type Source = {
  id: string;
  title: string;
  meta: string;
  kind: SourceKind;
  status: SourceStatus;
  enabled: boolean;
};

export type ChatMsg = {
  role: "user" | "assistant";
  text: string;
  refusal?: boolean;
  notice?: boolean;
  error?: boolean;
  /** chunk ids in context order — [n] maps to citations[n-1] */
  citations?: string[];
};

export type Notebook = {
  id: string;
  title: string;
  createdAt: number;
  sources: Source[];
  chat: ChatMsg[];
  artifacts: Artifact[];
};

export type ArtifactType = "mindmap" | "quiz" | "summary" | "factcheck" | "deep";

export type Artifact = {
  id: string;
  type: ArtifactType;
  title: string;
  content: string;
  createdAt: number;
};

export type StudioTask = {
  id: ArtifactType;
  label: string;
  desc: string;
};

export const STUDIO_TASKS: StudioTask[] = [
  { id: "mindmap", label: "Mindmap", desc: "concept tree" },
  { id: "quiz", label: "Quiz", desc: "cited questions" },
  { id: "summary", label: "Summary", desc: "key points" },
  { id: "factcheck", label: "Fact-check", desc: "verdict table" },
  { id: "deep", label: "Deep research", desc: "cited report" },
];

export const STARTERS = [
  "Summarize my sources",
  "What are the key claims?",
  "What do these sources disagree on?",
];
