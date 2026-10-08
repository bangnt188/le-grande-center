export type DocumentDownload = { label: string } & (
  { path: string; filename?: string; pending?: never } |
  { pending: string; path?: never; filename?: never }
);
export type ProjectDocumentGroup = {
  id: string;
  title: string;
  description: string;
  icon: "document" | "plan" | "shield";
  downloads: readonly DocumentDownload[];
};
