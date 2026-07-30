import { useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import html2canvas from "html2canvas";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { format } from "date-fns";
import { Camera, Check, ChevronDown, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAdvertisers } from "@/hooks/useAdvertisers";
import { countryData } from "@/components/advertisers/countryData";
import { cn } from "@/lib/utils";

type DatePreset = "today" | "yesterday" | "last7" | "thisMonth" | "lastMonth" | "custom";

const DATE_PRESETS: { key: DatePreset; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "last7", label: "Last 7 Days" },
  { key: "thisMonth", label: "This Month" },
  { key: "lastMonth", label: "Last Month" },
  { key: "custom", label: "Custom" },
];

interface DemoRow {
  id: string;
  advertiserId: string;
  countryCode: string;
  leads: number;
  crPercent: number;
}

const countries = Object.values(countryData).sort((a, b) => a.name.localeCompare(b.name));

// Slight random variation so a newly added row's starter numbers don't
// look artificially round — only applied when the row is created, never
// to values the user types in afterward.
function randomInRange(min: number, max: number): number {
  return Math.round(min + Math.random() * (max - min));
}

function makeRow(advertiserId: string, countryCode: string): DemoRow {
  return {
    id: crypto.randomUUID(),
    advertiserId,
    countryCode,
    leads: randomInRange(200, 3000),
    crPercent: randomInRange(5, 35) + Math.random(),
  };
}

function computeDeposits(leads: number, crPercent: number): number {
  return Math.round((leads * crPercent) / 100);
}

// Picker for choosing which real advertisers to build fake numbers for —
// this control sits outside the captured screenshot area, so showing the
// actual advertiser name here is safe; the table itself never does.
function AdvertiserPicker({
  advertisers,
  selected,
  onToggle,
  disabled,
}: {
  advertisers: { id: string; name: string }[];
  selected: string[];
  onToggle: (advertiserId: string) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" disabled={disabled} className="w-56 justify-between font-normal">
          <span className="truncate">
            {selected.length > 0 ? `${selected.length} advertiser${selected.length === 1 ? "" : "s"} selected` : "Select advertisers"}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0 bg-popover" align="start">
        <Command>
          <CommandInput placeholder="Search advertisers..." />
          <CommandList className="max-h-72">
            <CommandEmpty>No advertisers found.</CommandEmpty>
            <CommandGroup>
              {advertisers.map((advertiser) => {
                const checked = selected.includes(advertiser.id);
                return (
                  <CommandItem
                    key={advertiser.id}
                    value={advertiser.id}
                    keywords={[advertiser.name]}
                    onSelect={() => onToggle(advertiser.id)}
                  >
                    <div
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-primary mr-2",
                        checked ? "bg-primary" : "bg-transparent"
                      )}
                    >
                      <Check className={cn("h-3 w-3 text-primary-foreground", checked ? "opacity-100" : "opacity-0")} />
                    </div>
                    <span className="truncate">{advertiser.name}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function DemoReportGenerator() {
  const { isSuperAdmin } = useAuth();
  const { data: advertisersData } = useAdvertisers();
  const reportRef = useRef<HTMLDivElement>(null);
  const [capturing, setCapturing] = useState(false);

  const [rows, setRows] = useState<DemoRow[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [datePreset, setDatePreset] = useState<DatePreset>("last7");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  if (!isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const activeAdvertisers = useMemo(
    () => (advertisersData ?? []).filter((a) => a.is_active),
    [advertisersData]
  );

  // Only rows for the currently selected country are shown/edited at a time —
  // rows built for other countries persist in the background and reappear
  // when you switch back.
  const visibleRows = useMemo(
    () => rows.filter((r) => r.countryCode === selectedCountry),
    [rows, selectedCountry]
  );

  const selectedAdvertiserIds = useMemo(
    () => visibleRows.map((r) => r.advertiserId),
    [visibleRows]
  );

  const totals = useMemo(() => {
    const totalLeads = visibleRows.reduce((sum, r) => sum + r.leads, 0);
    const totalDeposits = visibleRows.reduce((sum, r) => sum + computeDeposits(r.leads, r.crPercent), 0);
    const avgCr = visibleRows.length
      ? visibleRows.reduce((sum, r) => sum + r.crPercent, 0) / visibleRows.length
      : 0;
    return { totalLeads, totalDeposits, avgCr };
  }, [visibleRows]);

  const toggleAdvertiser = (advertiserId: string) => {
    if (!selectedCountry) return;
    setRows((prev) => {
      const exists = prev.some(
        (r) => r.countryCode === selectedCountry && r.advertiserId === advertiserId
      );
      if (exists) {
        return prev.filter(
          (r) => !(r.countryCode === selectedCountry && r.advertiserId === advertiserId)
        );
      }
      return [...prev, makeRow(advertiserId, selectedCountry)];
    });
  };

  const updateRow = (id: string, patch: Partial<Pick<DemoRow, "leads" | "crPercent">>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleGenerateScreenshot = async () => {
    if (!reportRef.current) return;
    setCapturing(true);
    // Wait for React to actually repaint with capturing=true (swapping the
    // Leads/CR% inputs for plain text) before html2canvas snapshots the DOM —
    // native <input> elements render unreliably (often blank) in html2canvas,
    // so the table must show static text at the moment of capture.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    try {
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: getComputedStyle(document.body).backgroundColor || "#ffffff",
        scale: 2,
        useCORS: true,
      });
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      const datePart = format(new Date(), "yyyy-MM-dd");
      link.download = `demo-report-${datePart}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Screenshot downloaded");
    } catch (err) {
      toast.error("Failed to generate screenshot");
    } finally {
      setCapturing(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Demo Report Generator</h1>
          <p className="text-muted-foreground">
            Build a mock performance table and export it as a screenshot. Nothing here is saved or reflects real data.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6 flex flex-wrap items-center gap-3">
            <SearchableSelect
              value={selectedCountry || "all"}
              onValueChange={(v) => setSelectedCountry(v === "all" ? "" : v)}
              options={countries.map((c) => ({ value: c.code, label: `${c.name} (${c.code})` }))}
              placeholder="Select a country"
              searchPlaceholder="Search countries..."
              className="w-48"
            />

            <AdvertiserPicker
              advertisers={activeAdvertisers}
              selected={selectedAdvertiserIds}
              onToggle={toggleAdvertiser}
              disabled={!selectedCountry}
            />

            <Button
              variant="outline"
              onClick={handleGenerateScreenshot}
              disabled={capturing || visibleRows.length === 0}
              className="ml-auto"
            >
              <Camera className="h-4 w-4 mr-2" />
              {capturing ? "Generating..." : "Generate Screenshot"}
            </Button>
          </CardContent>
        </Card>

        {/* Captured into the screenshot — filters + table only, nothing else */}
        <div ref={reportRef} className="space-y-4 bg-background p-6 rounded-lg border">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {DATE_PRESETS.map((preset) => (
              <Badge
                key={preset.key}
                variant={datePreset === preset.key ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setDatePreset(preset.key)}
              >
                {preset.label}
              </Badge>
            ))}
            {datePreset === "custom" && (
              <div className="flex items-center gap-2">
                <Input
                  placeholder="From (e.g. Jul 1)"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="w-36 h-8"
                />
                <span className="text-muted-foreground text-sm">to</span>
                <Input
                  placeholder="To (e.g. Jul 29)"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="w-36 h-8"
                />
              </div>
            )}
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Advertiser</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">CR %</TableHead>
                  <TableHead className="text-right">Deposits</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      {selectedCountry
                        ? "Select advertisers above to add rows."
                        : "Select a country to get started."}
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleRows.map((row) => {
                    const country = countryData[row.countryCode];
                    const deposits = computeDeposits(row.leads, row.crPercent);
                    return (
                      <TableRow key={row.id}>
                        <TableCell>
                          <span className="inline-block h-4 w-24 rounded-sm bg-foreground" />
                        </TableCell>
                        <TableCell>{country ? `${country.name} (${country.code})` : row.countryCode}</TableCell>
                        <TableCell className="text-right">
                          {capturing ? (
                            <span className="font-medium">{row.leads.toLocaleString()}</span>
                          ) : (
                            <Input
                              type="number"
                              min={0}
                              value={row.leads}
                              onChange={(e) => updateRow(row.id, { leads: Number(e.target.value) || 0 })}
                              className="w-28 ml-auto text-right"
                            />
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {capturing ? (
                            <span className="font-medium">{row.crPercent.toFixed(1)}%</span>
                          ) : (
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              step="0.1"
                              value={row.crPercent}
                              onChange={(e) => updateRow(row.id, { crPercent: Number(e.target.value) || 0 })}
                              className="w-24 ml-auto text-right"
                            />
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">{deposits.toLocaleString()}</TableCell>
                        <TableCell>
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeRow(row.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
              {visibleRows.length > 0 && (
                <TableBody>
                  <TableRow className="font-semibold bg-muted/50">
                    <TableCell colSpan={2}>Total</TableCell>
                    <TableCell className="text-right">{totals.totalLeads.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{totals.avgCr.toFixed(1)}%</TableCell>
                    <TableCell className="text-right">{totals.totalDeposits.toLocaleString()}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              )}
            </Table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
