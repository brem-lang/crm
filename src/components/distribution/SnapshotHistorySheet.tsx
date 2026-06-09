import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { History, RotateCcw, Trash2, Save } from "lucide-react";
import { useDistributionSnapshots } from "@/hooks/useDistributionSnapshots";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function SnapshotHistorySheet({ open, onOpenChange }: Props) {
  const { snapshots, createSnapshot, restoreSnapshot, deleteSnapshot } = useDistributionSnapshots();
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await createSnapshot(label.trim() || undefined);
    setLabel("");
    setSaving(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[440px] sm:max-w-[440px] flex flex-col overflow-hidden">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Snapshot History
          </SheetTitle>
          <SheetDescription>
            Save a point-in-time copy of all distribution settings. Restore at any time.
          </SheetDescription>
        </SheetHeader>

        {/* Save new snapshot */}
        <div className="mt-4 flex gap-2">
          <Input
            placeholder="Snapshot label (optional)"
            value={label}
            onChange={e => setLabel(e.target.value)}
            className="h-9 text-sm flex-1"
            onKeyDown={e => e.key === "Enter" && handleSave()}
          />
          <Button size="sm" onClick={handleSave} disabled={saving} className="h-9">
            <Save className="h-4 w-4 mr-1" />
            Save now
          </Button>
        </div>

        {/* Snapshot list */}
        <div className="mt-4 flex-1 overflow-y-auto space-y-2 pr-1">
          {snapshots.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <History className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No snapshots yet.</p>
              <p className="text-xs mt-1">Click "Save now" to create your first snapshot.</p>
            </div>
          )}

          {snapshots.map(snap => (
            <div
              key={snap.id}
              className="flex items-start gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{snap.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date(snap.created_at).toLocaleString()}
                </p>
                <Badge variant="secondary" className="text-xs mt-1">
                  {snap.settings.length} advertisers
                </Badge>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  title="Restore this snapshot"
                  onClick={() => restoreSnapshot(snap)}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-destructive hover:text-destructive"
                  title="Delete snapshot"
                  onClick={() => deleteSnapshot(snap.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground mt-3 pt-3 border-t">
          Snapshots are stored locally in your browser. Last {snapshots.length} / 20 shown.
        </p>
      </SheetContent>
    </Sheet>
  );
}
