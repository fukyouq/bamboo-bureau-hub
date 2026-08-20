import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink } from "lucide-react";

export type PreviewTarget = {
  title: string;
  url: string;
  file_type: string;
  file_name: string;
};

const OFFICE_TYPES = ["doc", "docx", "ppt", "pptx", "xls", "xlsx"];

export function isPreviewable(fileType: string) {
  const t = fileType.toLowerCase();
  return t === "pdf" || OFFICE_TYPES.includes(t);
}

export function DocumentPreview({
  target,
  onOpenChange,
  onDownload,
}: {
  target: PreviewTarget | null;
  onOpenChange: (open: boolean) => void;
  onDownload: () => void;
}) {
  const type = target?.file_type.toLowerCase() ?? "";
  const src =
    type === "pdf"
      ? `${target?.url}#view=FitH`
      : `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(target?.url ?? "")}`;

  return (
    <Dialog open={Boolean(target)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{target?.title}</DialogTitle>
          <DialogDescription>
            {target?.file_name} · {type.toUpperCase()} preview
          </DialogDescription>
        </DialogHeader>

        {target && isPreviewable(type) ? (
          <iframe
            title={`Preview of ${target.title}`}
            src={src}
            className="h-[70vh] w-full rounded-md border border-border bg-secondary/30"
          />
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">
            This file type cannot be previewed in the browser. Download it to view the contents.
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          {target && (
            <Button variant="secondary" asChild>
              <a href={target.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4" /> Open in new tab
              </a>
            </Button>
          )}
          <Button onClick={onDownload}>
            <Download className="size-4" /> Download
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
