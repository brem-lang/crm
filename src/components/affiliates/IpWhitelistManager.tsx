import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Trash2, ClipboardList } from "lucide-react";

interface Props {
  ips: string[];
  onChange: (ips: string[]) => void;
  disabled?: boolean;
}

const IP_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/;

function parseAndValidateIps(raw: string, existing: string[]) {
  const candidates = raw.split(/[\s,;]+/).map(s => s.trim()).filter(Boolean);
  const added: string[] = [];
  let invalid = 0;
  let duplicate = 0;
  for (const ip of candidates) {
    if (!IP_REGEX.test(ip)) { invalid++; continue; }
    if (existing.includes(ip) || added.includes(ip)) { duplicate++; continue; }
    added.push(ip);
  }
  return { added, invalid, duplicate };
}

export function IpWhitelistManager({ ips, onChange, disabled }: Props) {
  const [singleInput, setSingleInput] = useState("");
  const [bulkInput, setBulkInput] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [search, setSearch] = useState("");

  const filteredIps = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ips;
    return ips.filter(ip => ip.includes(q));
  }, [ips, search]);

  const handleAddSingle = () => {
    const ip = singleInput.trim();
    if (!ip) return;
    if (!IP_REGEX.test(ip)) { toast.error("Invalid IPv4 address"); return; }
    if (ips.includes(ip)) { toast.error("IP already in list"); return; }
    onChange([...ips, ip]);
    setSingleInput("");
  };

  const handleAddBulk = () => {
    if (!bulkInput.trim()) return;
    const { added, invalid, duplicate } = parseAndValidateIps(bulkInput, ips);
    if (added.length > 0) onChange([...ips, ...added]);
    const parts: string[] = [];
    if (added.length > 0) parts.push(`Added ${added.length} IP${added.length !== 1 ? "s" : ""}`);
    if (invalid > 0) parts.push(`${invalid} invalid`);
    if (duplicate > 0) parts.push(`${duplicate} duplicate${duplicate !== 1 ? "s" : ""} skipped`);
    if (added.length > 0) toast.success(parts.join(" · "));
    else toast.error(parts.join(" · ") || "No valid IPs found");
    setBulkInput("");
    setShowBulk(false);
  };

  const handleRemove = (ip: string) => {
    onChange(ips.filter(i => i !== ip));
  };

  const handleClearAll = () => {
    onChange([]);
    setSearch("");
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Only listed IPs can submit leads for this affiliate.</p>

      {/* Single add + search row */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[140px]">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search IPs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 text-xs h-8"
            disabled={disabled}
          />
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="e.g. 192.168.1.1"
            value={singleInput}
            onChange={(e) => setSingleInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddSingle())}
            className="text-xs h-8 w-36"
            disabled={disabled}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddSingle}
            disabled={disabled}
            className="h-8 gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowBulk(v => !v)}
            disabled={disabled}
            className="h-8 gap-1"
          >
            <ClipboardList className="h-3.5 w-3.5" />
            Bulk Add
          </Button>
        </div>
      </div>

      {/* Bulk add textarea */}
      {showBulk && (
        <div className="space-y-2 border rounded-md p-3 bg-muted/30">
          <p className="text-xs text-muted-foreground">Paste IPs separated by commas, newlines, or spaces.</p>
          <Textarea
            placeholder={"192.168.1.1\n10.0.0.5, 10.0.0.6\n172.16.0.1"}
            value={bulkInput}
            onChange={(e) => setBulkInput(e.target.value)}
            className="text-xs font-mono h-24 resize-none"
            disabled={disabled}
          />
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={() => { setShowBulk(false); setBulkInput(""); }}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={handleAddBulk} disabled={disabled || !bulkInput.trim()}>
              Add IPs
            </Button>
          </div>
        </div>
      )}

      {/* IP list table */}
      {ips.length === 0 ? (
        <div className="text-center py-4 text-xs text-muted-foreground border rounded-md bg-muted/20">
          No IPs added yet. Add individual IPs or use Bulk Add.
        </div>
      ) : (
        <div className="border rounded-md overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[2rem_1fr_2.5rem] items-center px-3 py-1.5 bg-muted/50 border-b text-xs font-medium text-muted-foreground">
            <span>#</span>
            <span>IP Address</span>
            <span />
          </div>

          {/* Rows */}
          <div className="divide-y max-h-52 overflow-y-auto">
            {filteredIps.length === 0 ? (
              <div className="py-3 text-center text-xs text-muted-foreground">
                No IPs match "{search}"
              </div>
            ) : (
              filteredIps.map((ip, idx) => (
                <div
                  key={ip}
                  className="grid grid-cols-[2rem_1fr_2.5rem] items-center px-3 py-1.5 hover:bg-muted/30 transition-colors"
                >
                  <span className="text-xs text-muted-foreground">{ips.indexOf(ip) + 1}</span>
                  <span className="font-mono text-xs">{ip}</span>
                  <button
                    type="button"
                    onClick={() => handleRemove(ip)}
                    disabled={disabled}
                    className="flex items-center justify-center h-6 w-6 rounded hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50"
                    title="Remove IP"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30 border-t">
            <span className="text-xs text-muted-foreground">
              {search
                ? `Showing ${filteredIps.length} of ${ips.length} IP${ips.length !== 1 ? "s" : ""}`
                : `${ips.length} IP${ips.length !== 1 ? "s" : ""} total`}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              disabled={disabled}
              className="h-6 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 px-2"
            >
              Clear All
            </Button>
          </div>
        </div>
      )}

      {/* Count badge summary when list is non-empty */}
      {ips.length > 0 && (
        <div className="flex items-center gap-1.5">
          <Badge variant="secondary" className="text-xs">
            {ips.length} IP{ips.length !== 1 ? "s" : ""} whitelisted
          </Badge>
        </div>
      )}
    </div>
  );
}
