import { useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import html2canvas from "html2canvas";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { format } from "date-fns";
import { Camera, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { countryData } from "@/components/advertisers/countryData";

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

type DatePreset = 'today' | 'yesterday' | 'last7' | 'last30' | 'thisMonth' | 'custom';

const DATE_PRESETS: { key: DatePreset; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'last7', label: 'Last 7 Days' },
  { key: 'last30', label: 'Last 30 Days' },
  { key: 'thisMonth', label: 'This Month' },
];

interface BreakdownRow {
  id: string;
  label: string;
  count: number;
}

const countries = Object.values(countryData).sort((a, b) => a.name.localeCompare(b.name));

export default function DemoReportGenerator() {
  const { isSuperAdmin } = useAuth();
  const reportRef = useRef<HTMLDivElement>(null);
  const [capturing, setCapturing] = useState(false);

  const [reportTitle, setReportTitle] = useState("Campaign Performance Report");
  const [countryCode, setCountryCode] = useState("DE");
  const [datePreset, setDatePreset] = useState<DatePreset>('last7');
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [leadsCount, setLeadsCount] = useState(1250);
  const [conversions, setConversions] = useState(187);
  const [breakdown, setBreakdown] = useState<BreakdownRow[]>([
    { id: "1", label: "Converted", count: 187 },
    { id: "2", label: "Pending", count: 640 },
    { id: "3", label: "Rejected", count: 423 },
  ]);

  if (!isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const dateLabel = useMemo(() => {
    if (datePreset === 'custom') {
      if (customFrom && customTo) return `${customFrom} - ${customTo}`;
      return 'Custom Range';
    }
    return DATE_PRESETS.find((p) => p.key === datePreset)?.label ?? 'Last 7 Days';
  }, [datePreset, customFrom, customTo]);

  const country = countryData[countryCode];
  const cr = leadsCount > 0 ? ((conversions / leadsCount) * 100).toFixed(1) : '0.0';

  const addBreakdownRow = () => {
    setBreakdown((rows) => [...rows, { id: crypto.randomUUID(), label: "", count: 0 }]);
  };

  const removeBreakdownRow = (id: string) => {
    setBreakdown((rows) => rows.filter((r) => r.id !== id));
  };

  const updateBreakdownRow = (id: string, patch: Partial<BreakdownRow>) => {
    setBreakdown((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const chartData = breakdown.filter((r) => r.label.trim().length > 0);

  const handleGenerate = async () => {
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
      link.download = `demo-report-${countryCode}-${datePart}.png`;
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
            Build a mock report with any numbers you choose and export it as a screenshot. Nothing here is saved or reflects real data.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          {/* Input panel */}
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Report Inputs</CardTitle>
              <CardDescription>These values only control the preview below.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Report Title</Label>
                <Input value={reportTitle} onChange={(e) => setReportTitle(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Geo</Label>
                <Select value={countryCode} onValueChange={setCountryCode}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {countries.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.name} ({c.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Date Range</Label>
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
                  <Badge
                    variant={datePreset === 'custom' ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setDatePreset('custom')}
                  >
                    Custom
                  </Badge>
                </div>
                {datePreset === 'custom' && (
                  <div className="flex gap-2 pt-1">
                    <Input placeholder="From (e.g. Jul 1)" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
                    <Input placeholder="To (e.g. Jul 29)" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Total Leads</Label>
                  <Input
                    type="number"
                    min={0}
                    value={leadsCount}
                    onChange={(e) => setLeadsCount(Number(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Conversions</Label>
                  <Input
                    type="number"
                    min={0}
                    value={conversions}
                    onChange={(e) => setConversions(Number(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Breakdown</Label>
                  <Button type="button" variant="ghost" size="sm" onClick={addBreakdownRow}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Row
                  </Button>
                </div>
                <div className="space-y-2">
                  {breakdown.map((row) => (
                    <div key={row.id} className="flex items-center gap-2">
                      <Input
                        placeholder="Label"
                        value={row.label}
                        onChange={(e) => updateBreakdownRow(row.id, { label: e.target.value })}
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        min={0}
                        value={row.count}
                        onChange={(e) => updateBreakdownRow(row.id, { count: Number(e.target.value) || 0 })}
                        className="w-24"
                      />
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeBreakdownRow(row.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <Button className="w-full" onClick={handleGenerate} disabled={capturing}>
                <Camera className="h-4 w-4 mr-2" />
                {capturing ? "Generating..." : "Generate Screenshot"}
              </Button>
            </CardContent>
          </Card>

          {/* Preview panel — captured into the screenshot */}
          <div ref={reportRef} className="space-y-6 bg-background p-6 rounded-lg border">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2 className="text-2xl font-bold">{reportTitle}</h2>
                <p className="text-muted-foreground">{dateLabel}</p>
              </div>
              <Badge variant="secondary" className="text-sm w-fit">
                {country ? `${country.name} (${country.code})` : countryCode}
              </Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{leadsCount.toLocaleString()}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Conversions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{conversions.toLocaleString()}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{cr}%</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Breakdown</CardTitle>
                <CardDescription>{dateLabel} &middot; {country?.name ?? countryCode}</CardDescription>
              </CardHeader>
              <CardContent>
                {chartData.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Add breakdown rows to see a chart.</p>
                ) : (
                  <div className="grid gap-6 md:grid-cols-2">
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="count" fill="hsl(var(--primary))" />
                      </BarChart>
                    </ResponsiveContainer>
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={chartData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ label, percent }) => `${label} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          dataKey="count"
                          nameKey="label"
                        >
                          {chartData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
