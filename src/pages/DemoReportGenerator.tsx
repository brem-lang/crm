import { useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import html2canvas from "html2canvas";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { Camera, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { countryData } from "@/components/advertisers/countryData";

type DatePreset = "today" | "yesterday" | "last7" | "thisMonth" | "lastMonth";

const DATE_PRESETS: { key: DatePreset; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "last7", label: "Last 7 Days" },
  { key: "thisMonth", label: "This Month" },
  { key: "lastMonth", label: "Last Month" },
];

interface DemoRow {
  id: string;
  advertiserLabel: string;
  countryCode: string;
  leads: number;
  crPercent: number;
}

const countries = Object.values(countryData).sort((a, b) => a.name.localeCompare(b.name));

// Slight random variation so generated placeholder numbers don't look
// artificially round — only applied at generation time, never to values
// the user types in afterward.
function randomInRange(min: number, max: number): number {
  return Math.round(min + Math.random() * (max - min));
}

function generateRows(count: number): DemoRow[] {
  return Array.from({ length: count }, (_, i) => {
    const country = countries[Math.floor(Math.random() * countries.length)];
    return {
      id: crypto.randomUUID(),
      advertiserLabel: `ADV-${i + 1}`,
      countryCode: country.code,
      leads: randomInRange(200, 3000),
      crPercent: randomInRange(5, 35) + Math.random(),
    };
  });
}

function computeDeposits(leads: number, crPercent: number): number {
  return Math.round((leads * crPercent) / 100);
}

export default function DemoReportGenerator() {
  const { isSuperAdmin } = useAuth();
  const reportRef = useRef<HTMLDivElement>(null);
  const [capturing, setCapturing] = useState(false);

  const [rows, setRows] = useState<DemoRow[]>(() => generateRows(6));
  const [rowCount, setRowCount] = useState(6);

  const [datePreset, setDatePreset] = useState<DatePreset>("last7");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [advertiserFilter, setAdvertiserFilter] = useState<string>("all");

  if (!isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (countryFilter !== "all" && row.countryCode !== countryFilter) return false;
      if (advertiserFilter !== "all" && row.advertiserLabel !== advertiserFilter) return false;
      return true;
    });
  }, [rows, countryFilter, advertiserFilter]);

  const totals = useMemo(() => {
    const totalLeads = filteredRows.reduce((sum, r) => sum + r.leads, 0);
    const totalDeposits = filteredRows.reduce((sum, r) => sum + computeDeposits(r.leads, r.crPercent), 0);
    const avgCr = filteredRows.length
      ? filteredRows.reduce((sum, r) => sum + r.crPercent, 0) / filteredRows.length
      : 0;
    return { totalLeads, totalDeposits, avgCr };
  }, [filteredRows]);

  const handleGenerateRows = () => {
    setRows(generateRows(Math.max(1, rowCount)));
    setAdvertiserFilter("all");
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
          <CardContent className="pt-6 flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label>Number of Advertisers</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={rowCount}
                onChange={(e) => setRowCount(Number(e.target.value) || 1)}
                className="w-32"
              />
            </div>
            <Button onClick={handleGenerateRows}>Generate</Button>
            <Button variant="outline" onClick={handleGenerateScreenshot} disabled={capturing} className="ml-auto">
              <Camera className="h-4 w-4 mr-2" />
              {capturing ? "Generating..." : "Generate Screenshot"}
            </Button>
          </CardContent>
        </Card>

        {/* Captured into the screenshot — filters + table only, nothing else */}
        <div ref={reportRef} className="space-y-4 bg-background p-6 rounded-lg border">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex flex-wrap gap-2">
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
            </div>

            <Select value={countryFilter} onValueChange={setCountryFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="all">All Countries</SelectItem>
                {countries.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.name} ({c.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={advertiserFilter} onValueChange={setAdvertiserFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Advertisers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Advertisers</SelectItem>
                {rows.map((row) => (
                  <SelectItem key={row.id} value={row.advertiserLabel}>
                    <span className="inline-block h-3.5 w-20 rounded-sm bg-foreground" />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                {filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No rows match the current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((row) => {
                    const country = countryData[row.countryCode];
                    const deposits = computeDeposits(row.leads, row.crPercent);
                    return (
                      <TableRow key={row.id}>
                        <TableCell>
                          <span className="inline-block h-4 w-24 rounded-sm bg-foreground" />
                        </TableCell>
                        <TableCell>{country ? `${country.name} (${country.code})` : row.countryCode}</TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min={0}
                            value={row.leads}
                            onChange={(e) => updateRow(row.id, { leads: Number(e.target.value) || 0 })}
                            className="w-28 ml-auto text-right"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step="0.1"
                            value={row.crPercent}
                            onChange={(e) => updateRow(row.id, { crPercent: Number(e.target.value) || 0 })}
                            className="w-24 ml-auto text-right"
                          />
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
              {filteredRows.length > 0 && (
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
