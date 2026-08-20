import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, Eye, Search, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useMyProfile, useRoles, useSectors } from "@/hooks/useStaff";
import {
  createUploadUrl,
  getDocumentUrl,
  deleteDocumentFile,
  recordDocumentUpload,
} from "@/lib/staff.functions";
import { DocumentPreview, isPreviewable, type PreviewTarget } from "@/components/DocumentPreview";

export const Route = createFileRoute("/_authenticated/documents")({
  head: () => ({
    meta: [
      { title: "Document Registry | Bamboo Company Staff" },
      {
        name: "description",
        content: "Upload and browse Bamboo Company documents by sector, with role-based visibility.",
      },
      { property: "og:title", content: "Document Registry | Bamboo Company Staff" },
      { property: "og:description", content: "Sector-filtered document registry for Bamboo Company staff." },
    ],
  }),
  component: DocumentsPage,
});

const ACCEPTED = ".pdf,.docx,.doc,.pptx,.ppt,.xlsx,.xls,.csv";
const MAX_BYTES = 25 * 1024 * 1024;

function extOf(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "file";
}

function DocumentsPage() {
  const { data: profile } = useMyProfile();
  const { data: roles = [] } = useRoles();
  const { data: sectors = [] } = useSectors();
  const queryClient = useQueryClient();
  const uploadUrlFn = useServerFn(createUploadUrl);
  const documentUrlFn = useServerFn(getDocumentUrl);
  const deleteFileFn = useServerFn(deleteDocumentFile);

  const [filterSector, setFilterSector] = useState<string>("all");
  const [title, setTitle] = useState("");
  const [sectorId, setSectorId] = useState<string>("none");
  const [file, setFile] = useState<File | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<number[]>([]);
  const [uploading, setUploading] = useState(false);

  const myRank = profile?.role?.rank ?? 99;
  const shareableRoles = roles.filter((r) => r.rank > myRank);

  const { data: documents = [] } = useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select(
          "id, title, file_name, file_type, file_path, sector_id, published_by, publisher_rank, created_at, document_roles(role_id)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const visible = documents.filter((d) =>
    filterSector === "all" ? true : filterSector === "none" ? !d.sector_id : d.sector_id === filterSector,
  );

  async function onUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !profile?.role) return;
    if (file.size > MAX_BYTES) {
      toast.error("Files must be 25 MB or smaller");
      return;
    }
    setUploading(true);
    try {
      const { path, token } = await uploadUrlFn({ data: { file_name: file.name } });
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .uploadToSignedUrl(path, token, file);
      if (uploadError) throw uploadError;

      const { data: inserted, error } = await supabase
        .from("documents")
        .insert({
          title: title.trim() || file.name,
          file_path: path,
          file_name: file.name,
          file_type: extOf(file.name),
          sector_id: sectorId === "none" ? null : sectorId,
          published_by: profile.id,
          publisher_rank: profile.role.rank,
        })
        .select("id")
        .single();
      if (error) throw error;

      if (selectedRoles.length) {
        const { error: roleError } = await supabase
          .from("document_roles")
          .insert(selectedRoles.map((role_id) => ({ document_id: inserted.id, role_id })));
        if (roleError) throw roleError;
      }

      setTitle("");
      setFile(null);
      setSelectedRoles([]);
      setSectorId("none");
      toast.success("Document published");
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const open = useMutation({
    mutationFn: async (id: string) => documentUrlFn({ data: { document_id: id } }),
    onSuccess: ({ url }) => window.open(url, "_blank", "noopener"),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (doc: { id: string; file_path: string }) => {
      const { error } = await supabase.from("documents").delete().eq("id", doc.id);
      if (error) throw error;
      await deleteFileFn({ data: { path: doc.file_path } });
    },
    onSuccess: () => {
      toast.success("Document deleted");
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-border bg-card p-6 shadow-elegant">
        <h2 className="font-display text-2xl">Publish a document</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          PDF, Word, PowerPoint and Excel files. Every role ranked above you sees your upload automatically.
        </p>
        <form onSubmit={onUpload} className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="doc-title">Title</Label>
              <Input
                id="doc-title"
                value={title}
                maxLength={140}
                placeholder="Quarterly logistics report"
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc-sector">Sector</Label>
              <Select value={sectorId} onValueChange={setSectorId}>
                <SelectTrigger id="doc-sector">
                  <SelectValue placeholder="Company-wide" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Company-wide</SelectItem>
                  {sectors.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="doc-file">File</Label>
            <Input
              id="doc-file"
              type="file"
              accept={ACCEPTED}
              required
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Which lower roles may see this?</legend>
            <div className="grid max-h-56 gap-2 overflow-y-auto rounded-md border border-border p-3 sm:grid-cols-2">
              {shareableRoles.length === 0 && (
                <p className="text-sm text-muted-foreground">No lower roles available.</p>
              )}
              {shareableRoles.map((role) => (
                <label key={role.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={selectedRoles.includes(role.id)}
                    onCheckedChange={(checked) =>
                      setSelectedRoles((prev) =>
                        checked ? [...prev, role.id] : prev.filter((id) => id !== role.id),
                      )
                    }
                  />
                  {role.name}
                </label>
              ))}
            </div>
          </fieldset>
          <Button type="submit" disabled={uploading}>
            <Upload className="size-4" /> {uploading ? "Uploading…" : "Publish"}
          </Button>
        </form>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-elegant">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl">Registry</h2>
          <div className="flex items-center gap-2">
            <Label htmlFor="filter" className="text-sm text-muted-foreground">
              Sector
            </Label>
            <Select value={filterSector} onValueChange={setFilterSector}>
              <SelectTrigger id="filter" className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sectors</SelectItem>
                <SelectItem value="none">Company-wide</SelectItem>
                {sectors.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {visible.length === 0 && (
            <p className="text-sm text-muted-foreground">No documents available for your role yet.</p>
          )}
          {visible.map((doc) => (
            <div
              key={doc.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-secondary/40 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{doc.title}</p>
                <p className="text-xs text-muted-foreground">
                  {doc.file_type.toUpperCase()} ·{" "}
                  {sectors.find((s) => s.id === doc.sector_id)?.name ?? "Company-wide"} ·{" "}
                  {new Date(doc.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" onClick={() => open.mutate(doc.id)}>
                  <Download className="size-4" /> Open
                </Button>
                {(doc.published_by === profile?.id || myRank <= 3) && (
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Delete ${doc.title}`}
                    onClick={() => remove.mutate({ id: doc.id, file_path: doc.file_path })}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
