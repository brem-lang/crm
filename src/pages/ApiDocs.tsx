import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import html2pdf from "html2pdf.js";
import { useCRMSettings } from "@/hooks/useCRMSettings";

const BASE_URL = "https://backend.marketlinkco.live/functions/v1";

// Inline styles used only in the hidden print layout (no Tailwind classes that may not apply)
const ps = {
  page: { fontFamily: "Arial, sans-serif", fontSize: "13px", color: "#111", lineHeight: "1.5", padding: "32px" } as React.CSSProperties,
  h1: { fontSize: "26px", fontWeight: "bold", marginBottom: "4px" } as React.CSSProperties,
  h2: { fontSize: "20px", fontWeight: "bold", margin: "28px 0 12px" } as React.CSSProperties,
  h3: { fontSize: "15px", fontWeight: "bold", marginBottom: "6px" } as React.CSSProperties,
  section: { border: "1px solid #e2e8f0", borderRadius: "8px", padding: "20px", marginBottom: "20px", pageBreakInside: "avoid" } as React.CSSProperties,
  label: { fontWeight: "bold", fontSize: "13px", marginRight: "8px" } as React.CSSProperties,
  code: { background: "#f1f5f9", padding: "2px 6px", borderRadius: "4px", fontFamily: "monospace", fontSize: "12px" } as React.CSSProperties,
  pre: { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "14px", fontFamily: "monospace", fontSize: "11px", whiteSpace: "pre-wrap" as const, wordBreak: "break-all" as const, margin: "8px 0" },
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: "12px", marginBottom: "12px" } as React.CSSProperties,
  th: { textAlign: "left" as const, padding: "6px 10px", borderBottom: "2px solid #e2e8f0", fontWeight: "600" } as React.CSSProperties,
  td: { padding: "6px 10px", borderBottom: "1px solid #f1f5f9", verticalAlign: "middle" } as React.CSSProperties,
  note: { background: "#fefce8", border: "1px solid #fde68a", borderRadius: "6px", padding: "10px 14px", fontSize: "12px", margin: "8px 0" } as React.CSSProperties,
  noteBlue: { background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "6px", padding: "10px 14px", fontSize: "12px", margin: "8px 0" } as React.CSSProperties,
  noteGreen: { background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "6px", padding: "10px 14px", fontSize: "12px", margin: "8px 0" } as React.CSSProperties,
  // Plain colored text — no background box, avoids all html2canvas centering issues
  badgeReq: { color: "#ef4444", fontWeight: "700", fontSize: "11px" } as React.CSSProperties,
  badgeOpt: { color: "#64748b", fontWeight: "600", fontSize: "11px" } as React.CSSProperties,
  badgeGreen: { color: "#16a34a", fontWeight: "700", fontSize: "11px" } as React.CSSProperties,
  badgeBlue: { color: "#2563eb", fontWeight: "700", fontSize: "11px" } as React.CSSProperties,
  badgeYellow: { color: "#ca8a04", fontWeight: "700", fontSize: "11px" } as React.CSSProperties,
  badgeOrange: { color: "#ea580c", fontWeight: "700", fontSize: "11px" } as React.CSSProperties,
  badgeRed: { color: "#ef4444", fontWeight: "700", fontSize: "11px" } as React.CSSProperties,
  divider: { borderTop: "1px solid #e2e8f0", margin: "10px 0" } as React.CSSProperties,
};

function PrintLayout({ crmName }: { crmName: string }) {
  return (
    <div style={ps.page}>
      {/* Header */}
      <div style={{ marginBottom: "24px", borderBottom: "2px solid #e2e8f0", paddingBottom: "16px" }}>
        <div style={ps.h1}>{crmName} – Affiliate API Documentation</div>
        <div style={{ color: "#64748b", fontSize: "13px" }}>Complete guide to integrate with our lead management system</div>
      </div>

      {/* Authentication */}
      <div style={ps.section}>
        <div style={ps.h3}>🔐 Authentication</div>
        <p>All API requests require an <span style={ps.code}>Api-Key</span> header with your unique affiliate API key.</p>
        <div style={ps.pre}>Header: Api-Key: your_api_key_here</div>
        <p style={{ color: "#64748b", fontSize: "12px" }}>Contact your account manager to receive your API key.</p>
      </div>

      {/* Base URL */}
      <div style={ps.section}>
        <div style={ps.h3}>🌐 Base URL</div>
        <div style={ps.pre}>{BASE_URL}</div>
      </div>

      {/* Endpoints */}
      <div style={ps.h2}>Endpoints</div>

      {/* Submit Lead */}
      <div style={ps.section}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
          <span style={{ ...ps.label, color: "#16a34a" }}>POST</span>
          <span style={{ fontFamily: "monospace", fontWeight: "bold", fontSize: "15px" }}>/submit-lead</span>
        </div>
        <p style={{ color: "#64748b", marginBottom: "14px" }}>Submit a new lead to the system</p>

        <div style={ps.h3}>Parameters</div>
        <table style={ps.table}>
          <thead>
            <tr>
              <th style={ps.th}>Parameter</th>
              <th style={ps.th}>Type</th>
              <th style={ps.th}>Required</th>
              <th style={ps.th}>Description</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["firstname", "string", true, "Lead's first name"],
              ["lastname", "string", true, "Lead's last name"],
              ["email", "string", true, "Lead's email address"],
              ["mobile", "string", true, "Lead's phone number"],
              ["country_code", "string", true, "2-letter ISO country code (e.g., US, GB, CA)"],
              ["country", "string", false, "Full country name"],
              ["ip_address", "string", true, "Lead's IP address"],
              ["offer_name", "string", false, "Offer/campaign name"],
              ["custom1", "string", false, "Custom tracking parameter 1"],
              ["custom2", "string", false, "Custom tracking parameter 2"],
              ["custom3", "string", false, "Custom tracking parameter 3"],
              ["comment", "string", false, "Additional notes"],
              ["click_id", "string", false, "Ad click tracking ID — unique ID generated when user clicks an affiliate ad link. Pass this to trace the lead back to the exact ad click for attribution and reporting."],
              ["locale", "string", false, "Browser/language locale of the lead (e.g. en-US, fr-FR). Auto-derived from country_code if not provided."],
            ].map(([param, type, req, desc]) => (
              <tr key={param as string}>
                <td style={{ ...ps.td, fontFamily: "monospace" }}>{param}</td>
                <td style={ps.td}>{type}</td>
                <td style={ps.td}><span style={req ? ps.badgeReq : ps.badgeOpt}>{req ? "Required" : "Optional"}</span></td>
                <td style={ps.td}>{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={ps.h3}>Example Request</div>
        <div style={ps.pre}>{`POST ${BASE_URL}/submit-lead
Headers:
  Api-Key: your_api_key_here
  Content-Type: application/json

Body:
{
  "firstname": "John",
  "lastname": "Doe",
  "email": "john.doe@example.com",
  "mobile": "+14165551234",
  "country_code": "CA",
  "country": "Canada",
  "offer_name": "Summer Promo",
  "custom1": "tracking123",
  "click_id": "abc123",
  "locale": "en-CA"
}`}</div>

        <div style={ps.h3}>Success Response</div>
        <div style={ps.pre}>{`{
  "success": true,
  "message": "Lead submitted successfully",
  "data": {
    "lead_id": "9783cddc-ea4a-4a36-b207-52360b6634fc",
    "request_id": "fa4b6d82-b789-4c29-b069-a3c6a8d0fa9d",
    "autologin_url": "https://broker.com/autologin?token=abc123"
  }
}`}</div>
        <div style={ps.noteGreen}>
          <strong>🔗 Autologin URL:</strong> When available, the <span style={ps.code}>autologin_url</span> field contains a URL that allows the lead to be instantly logged into the advertiser's platform. Redirect the user to this URL immediately after submission for seamless onboarding.
        </div>

        <div style={ps.h3}>Error Responses</div>
        <div style={ps.pre}>{`// Validation Error (422)
{ "success": false, "message": "Validation failed", "errors": { "email": "Invalid email format" } }

// Duplicate Email (409)
{ "success": false, "message": "DUPLICATE" }

// Caps Full (503)
{ "success": false, "message": "CAPS_FULL" }`}</div>
      </div>

      {/* Get Leads */}
      <div style={ps.section}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
          <span style={{ ...ps.label, color: "#2563eb" }}>GET</span>
          <span style={{ fontFamily: "monospace", fontWeight: "bold", fontSize: "15px" }}>/get-leads</span>
        </div>
        <p style={{ color: "#64748b", marginBottom: "14px" }}>Retrieve leads with status and FTD updates</p>

        <div style={ps.h3}>Query Parameters</div>
        <table style={ps.table}>
          <thead>
            <tr>
              <th style={ps.th}>Parameter</th>
              <th style={ps.th}>Type</th>
              <th style={ps.th}>Required</th>
              <th style={ps.th}>Description</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["fromDate", "string", true, "Start date (MM/DD/YY)"],
              ["toDate", "string", true, "End date (MM/DD/YY)"],
              ["hasFTD", "integer", false, "Filter by FTD status (0 or 1)"],
              ["status", "string", false, "Filter by sale status (returned from advertiser CRM)"],
              ["email", "string", false, "Filter by email"],
              ["lead_id", "string", false, "Filter by specific lead ID"],
            ].map(([param, type, req, desc]) => (
              <tr key={param as string}>
                <td style={{ ...ps.td, fontFamily: "monospace" }}>{param}</td>
                <td style={ps.td}>{type}</td>
                <td style={ps.td}><span style={req ? ps.badgeReq : ps.badgeOpt}>{req ? "Required" : "Optional"}</span></td>
                <td style={ps.td}>{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={ps.note}>
          <strong>Note:</strong> Date range filters by <span style={ps.code}>updated_at</span> — returns only leads that had status/FTD changes in that period. Rejected leads are excluded by default.
        </div>

        <div style={ps.h3}>Example Request</div>
        <div style={ps.pre}>{`GET ${BASE_URL}/get-leads?fromDate=01/01/26&toDate=01/31/26&hasFTD=1
Headers:
  Api-Key: your_api_key_here`}</div>

        <div style={ps.h3}>Response</div>
        <div style={ps.pre}>{`{
  "success": true,
  "message": "Leads fetched successfully",
  "count": 2,
  "data": [
    {
      "id": "9783cddc-ea4a-4a36-b207-52360b6634fc",
      "lead_code": "fa4b6d82-b789-4c29-b069-a3c6a8d0fa9d",
      "firstname": "John",
      "lastname": "Doe",
      "email": "john.doe@example.com",
      "country_code": "CA",
      "mobile": "14165551234",
      "status": "Depositor",
      "is_ftd": 1,
      "ftd_date": "2026-01-15T10:30:00Z"
    }
  ]
}`}</div>
        <div style={ps.noteBlue}>
          <strong>ℹ️ Status Field:</strong> The <span style={ps.code}>status</span> field contains the sale status as reported by the advertiser's CRM system (e.g., "New", "Callback", "Depositor", "No Answer"). Values vary by advertiser.
        </div>
      </div>

      {/* Lead Status */}
      <div style={ps.section}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
          <span style={{ ...ps.label, color: "#2563eb" }}>GET</span>
          <span style={{ fontFamily: "monospace", fontWeight: "bold", fontSize: "15px" }}>/lead-status</span>
        </div>
        <p style={{ color: "#64748b", marginBottom: "14px" }}>Check status of a specific lead</p>

        <div style={ps.h3}>Query Parameters (one required)</div>
        <table style={ps.table}>
          <thead>
            <tr>
              <th style={ps.th}>Parameter</th>
              <th style={ps.th}>Type</th>
              <th style={ps.th}>Description</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["lead_id", "string", "The lead UUID"],
              ["request_id", "string", "The request ID returned from submission"],
              ["email", "string", "The lead's email address"],
            ].map(([param, type, desc]) => (
              <tr key={param as string}>
                <td style={{ ...ps.td, fontFamily: "monospace" }}>{param}</td>
                <td style={ps.td}>{type}</td>
                <td style={ps.td}>{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={ps.h3}>Example Request</div>
        <div style={ps.pre}>{`GET ${BASE_URL}/lead-status?request_id=fa4b6d82-b789-4c29-b069-a3c6a8d0fa9d
Headers:
  Api-Key: your_api_key_here`}</div>

        <div style={ps.h3}>Response</div>
        <div style={ps.pre}>{`{
  "success": true,
  "lead_id": "9783cddc-ea4a-4a36-b207-52360b6634fc",
  "request_id": "fa4b6d82-b789-4c29-b069-a3c6a8d0fa9d",
  "status": "Callback",
  "is_ftd": 0
}`}</div>
        <div style={ps.noteBlue}>
          <strong>ℹ️ Status Field:</strong> The <span style={ps.code}>status</span> field contains the sale status as reported by the advertiser's CRM system.
        </div>
      </div>

      {/* Status Values */}
      <div style={ps.section}>
        <div style={ps.h3}>📊 Status Values</div>
        <p style={{ fontSize: "12px", color: "#64748b", marginBottom: "10px" }}>
          The <span style={ps.code}>status</span> field contains the sale status as reported by the advertiser's CRM. Common examples:
        </p>
        <table style={ps.table}>
          <tbody>
            {[
              ["New", "#3b82f6", "Lead received"],
              ["Callback", "#eab308", "Scheduled callback"],
              ["No Answer", "#f97316", "No response"],
              ["Depositor", "#22c55e", "Made deposit"],
              ["Interested", "#a855f7", "Shows interest"],
              ["Not Interested", "#ef4444", "Declined"],
            ].map(([status, color, desc]) => (
              <tr key={status as string}>
                <td style={{ ...ps.td, width: "120px" }}>
                  <span style={{ color: color as string, fontWeight: "700", fontSize: "11px" }}>{status}</span>
                </td>
                <td style={ps.td}>{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: "11px", color: "#94a3b8" }}>Exact values depend on the advertiser's CRM configuration and may differ from the examples above.</p>
      </div>

      {/* HTTP Status Codes */}
      <div style={ps.section}>
        <div style={ps.h3}>⚠️ HTTP Status Codes</div>
        <table style={ps.table}>
          <thead>
            <tr>
              <th style={{ ...ps.th, width: "80px" }}>Code</th>
              <th style={ps.th}>Description</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["200", "#22c55e", "Success"],
              ["201", "#22c55e", "Lead created successfully"],
              ["400", "#eab308", "Bad request – missing required parameters"],
              ["401", "#ef4444", "Unauthorized – invalid or missing API key"],
              ["404", "#ef4444", "Lead not found"],
              ["409", "#f97316", "Duplicate – email already exists"],
              ["422", "#f97316", "Validation error"],
              ["503", "#ef4444", "Caps full – try again later"],
            ].map(([code, color, desc]) => (
              <tr key={code as string}>
                <td style={ps.td}>
                  <span style={{ color: color as string, fontWeight: "700", fontSize: "11px" }}>{code}</span>
                </td>
                <td style={ps.td}>{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Support */}
      <div style={ps.section}>
        <div style={ps.h3}>💬 Support</div>
        <p style={{ color: "#64748b" }}>For API access, technical support, or questions, contact your account manager.</p>
      </div>
    </div>
  );
}

export default function ApiDocs() {
  const contentRef = useRef<HTMLDivElement>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const { crmName } = useCRMSettings();

  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    setIsGenerating(true);
    try {
      const safeName = (crmName || "CRM").replace(/[^a-zA-Z0-9]/g, "-");
      const opt = {
        margin: [8, 8, 8, 8] as [number, number, number, number],
        filename: `${safeName}-API-Documentation.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true },
        jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
        pagebreak: { mode: ['css', 'legacy'] as ('css' | 'legacy')[] },
      };
      await html2pdf().set(opt).from(printRef.current).save();
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6 md:p-12">
      {/* Hidden print layout used for PDF generation */}
      <div style={{ position: "absolute", left: "-9999px", top: 0, width: "794px", background: "#fff" }} aria-hidden>
        <div ref={printRef}>
          <PrintLayout crmName={crmName || "CRM"} />
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-8" ref={contentRef}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold">Affiliate API Documentation</h1>
            <p className="text-muted-foreground text-lg">
              Complete guide to integrate with our lead management system
            </p>
          </div>
          <Button
            onClick={handleDownloadPDF}
            disabled={isGenerating}
            className="self-start print:hidden"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Download PDF
              </>
            )}
          </Button>
        </div>

        {/* Authentication */}
        <Card>
          <CardHeader>
            <CardTitle>🔐 Authentication</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>All API requests require an <code className="bg-muted px-2 py-1 rounded">Api-Key</code> header with your unique affiliate API key.</p>
            <div className="bg-muted p-4 rounded-lg font-mono text-sm">
              <span className="text-muted-foreground">Header:</span> Api-Key: your_api_key_here
            </div>
            <p className="text-sm text-muted-foreground">
              Contact your account manager to receive your API key.
            </p>
          </CardContent>
        </Card>

        {/* Base URL */}
        <Card>
          <CardHeader>
            <CardTitle>🌐 Base URL</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted p-4 rounded-lg font-mono text-sm break-all">
              {BASE_URL}
            </div>
          </CardContent>
        </Card>

        {/* Endpoints */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold">Endpoints</h2>

          {/* Submit Lead */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Badge className="bg-green-500">POST</Badge>
                <CardTitle className="font-mono">/submit-lead</CardTitle>
              </div>
              <p className="text-muted-foreground">Submit a new lead to the system</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-semibold mb-3">Parameters</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 pr-4">Parameter</th>
                        <th className="text-left py-2 pr-4">Type</th>
                        <th className="text-left py-2 pr-4">Required</th>
                        <th className="text-left py-2">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b"><td className="py-2 pr-4 font-mono">firstname</td><td className="py-2 pr-4">string</td><td className="py-2 pr-4"><Badge variant="destructive">Required</Badge></td><td className="py-2">Lead's first name</td></tr>
                      <tr className="border-b"><td className="py-2 pr-4 font-mono">lastname</td><td className="py-2 pr-4">string</td><td className="py-2 pr-4"><Badge variant="destructive">Required</Badge></td><td className="py-2">Lead's last name</td></tr>
                      <tr className="border-b"><td className="py-2 pr-4 font-mono">email</td><td className="py-2 pr-4">string</td><td className="py-2 pr-4"><Badge variant="destructive">Required</Badge></td><td className="py-2">Lead's email address</td></tr>
                      <tr className="border-b"><td className="py-2 pr-4 font-mono">mobile</td><td className="py-2 pr-4">string</td><td className="py-2 pr-4"><Badge variant="destructive">Required</Badge></td><td className="py-2">Lead's phone number</td></tr>
                      <tr className="border-b"><td className="py-2 pr-4 font-mono">country_code</td><td className="py-2 pr-4">string</td><td className="py-2 pr-4"><Badge variant="destructive">Required</Badge></td><td className="py-2">2-letter ISO country code (e.g., US, GB, CA)</td></tr>
                      <tr className="border-b"><td className="py-2 pr-4 font-mono">country</td><td className="py-2 pr-4">string</td><td className="py-2 pr-4"><Badge variant="secondary">Optional</Badge></td><td className="py-2">Full country name</td></tr>
                      <tr className="border-b"><td className="py-2 pr-4 font-mono">ip_address</td><td className="py-2 pr-4">string</td><td className="py-2 pr-4"><Badge variant="destructive">Required</Badge></td><td className="py-2">Lead's IP address</td></tr>
                      <tr className="border-b"><td className="py-2 pr-4 font-mono">offer_name</td><td className="py-2 pr-4">string</td><td className="py-2 pr-4"><Badge variant="secondary">Optional</Badge></td><td className="py-2">Offer/campaign name</td></tr>
                      <tr className="border-b"><td className="py-2 pr-4 font-mono">custom1</td><td className="py-2 pr-4">string</td><td className="py-2 pr-4"><Badge variant="secondary">Optional</Badge></td><td className="py-2">Custom tracking parameter 1</td></tr>
                      <tr className="border-b"><td className="py-2 pr-4 font-mono">custom2</td><td className="py-2 pr-4">string</td><td className="py-2 pr-4"><Badge variant="secondary">Optional</Badge></td><td className="py-2">Custom tracking parameter 2</td></tr>
                      <tr className="border-b"><td className="py-2 pr-4 font-mono">custom3</td><td className="py-2 pr-4">string</td><td className="py-2 pr-4"><Badge variant="secondary">Optional</Badge></td><td className="py-2">Custom tracking parameter 3</td></tr>
                      <tr className="border-b"><td className="py-2 pr-4 font-mono">comment</td><td className="py-2 pr-4">string</td><td className="py-2 pr-4"><Badge variant="secondary">Optional</Badge></td><td className="py-2">Additional notes</td></tr>
                      <tr className="border-b"><td className="py-2 pr-4 font-mono">click_id</td><td className="py-2 pr-4">string</td><td className="py-2 pr-4"><Badge variant="secondary">Optional</Badge></td><td className="py-2">Ad click tracking ID — unique ID generated when user clicks an affiliate ad link. Used for attribution, reporting, and fraud detection.</td></tr>
                      <tr><td className="py-2 pr-4 font-mono">locale</td><td className="py-2 pr-4">string</td><td className="py-2 pr-4"><Badge variant="secondary">Optional</Badge></td><td className="py-2">Browser/language locale of the lead (e.g. en-US, fr-FR). Auto-derived from country_code if not provided.</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <Tabs defaultValue="request">
                <TabsList>
                  <TabsTrigger value="request">Example Request</TabsTrigger>
                  <TabsTrigger value="success">Success Response</TabsTrigger>
                  <TabsTrigger value="error">Error Response</TabsTrigger>
                </TabsList>
                <TabsContent value="request">
                  <div className="bg-slate-900 text-slate-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                    <pre>{`POST ${BASE_URL}/submit-lead\nHeaders:\n  Api-Key: your_api_key_here\n  Content-Type: application/json\n\nBody:\n{\n  "firstname": "John",\n  "lastname": "Doe",\n  "email": "john.doe@example.com",\n  "mobile": "+14165551234",\n  "country_code": "CA",\n  "country": "Canada",\n  "offer_name": "Summer Promo",\n  "custom1": "tracking123",\n  "click_id": "abc123",\n  "locale": "en-CA"\n}`}</pre>
                  </div>
                </TabsContent>
                <TabsContent value="success">
                  <div className="bg-slate-900 text-slate-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                    <pre>{`{\n  "success": true,\n  "message": "Lead submitted successfully",\n  "data": {\n    "lead_id": "9783cddc-ea4a-4a36-b207-52360b6634fc",\n    "request_id": "fa4b6d82-b789-4c29-b069-a3c6a8d0fa9d",\n    "autologin_url": "https://broker.com/autologin?token=abc123"\n  }\n}`}</pre>
                  </div>
                  <div className="mt-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 rounded-lg">
                    <p className="text-sm"><strong>🔗 Autologin URL:</strong> When available, redirect the user to this URL immediately after submission for seamless onboarding.</p>
                  </div>
                </TabsContent>
                <TabsContent value="error">
                  <div className="bg-slate-900 text-slate-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                    <pre>{`// Validation Error (422)\n{ "success": false, "message": "Validation failed", "errors": { "email": "Invalid email format" } }\n\n// Duplicate Email (409)\n{ "success": false, "message": "DUPLICATE" }\n\n// Caps Full (503)\n{ "success": false, "message": "CAPS_FULL" }`}</pre>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Get Leads */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Badge className="bg-blue-500">GET</Badge>
                <CardTitle className="font-mono">/get-leads</CardTitle>
              </div>
              <p className="text-muted-foreground">Retrieve leads with status and FTD updates</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-semibold mb-3">Query Parameters</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 pr-4">Parameter</th>
                        <th className="text-left py-2 pr-4">Type</th>
                        <th className="text-left py-2 pr-4">Required</th>
                        <th className="text-left py-2">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b"><td className="py-2 pr-4 font-mono">fromDate</td><td className="py-2 pr-4">string</td><td className="py-2 pr-4"><Badge variant="destructive">Required</Badge></td><td className="py-2">Start date (MM/DD/YY)</td></tr>
                      <tr className="border-b"><td className="py-2 pr-4 font-mono">toDate</td><td className="py-2 pr-4">string</td><td className="py-2 pr-4"><Badge variant="destructive">Required</Badge></td><td className="py-2">End date (MM/DD/YY)</td></tr>
                      <tr className="border-b"><td className="py-2 pr-4 font-mono">hasFTD</td><td className="py-2 pr-4">integer</td><td className="py-2 pr-4"><Badge variant="secondary">Optional</Badge></td><td className="py-2">Filter by FTD status (0 or 1)</td></tr>
                      <tr className="border-b"><td className="py-2 pr-4 font-mono">status</td><td className="py-2 pr-4">string</td><td className="py-2 pr-4"><Badge variant="secondary">Optional</Badge></td><td className="py-2">Filter by sale status</td></tr>
                      <tr className="border-b"><td className="py-2 pr-4 font-mono">email</td><td className="py-2 pr-4">string</td><td className="py-2 pr-4"><Badge variant="secondary">Optional</Badge></td><td className="py-2">Filter by email</td></tr>
                      <tr className="border-b"><td className="py-2 pr-4 font-mono">lead_id</td><td className="py-2 pr-4">string</td><td className="py-2 pr-4"><Badge variant="secondary">Optional</Badge></td><td className="py-2">Filter by specific lead ID</td></tr>
                      <tr className="border-b"><td className="py-2 pr-4 font-mono">page</td><td className="py-2 pr-4">integer</td><td className="py-2 pr-4"><Badge variant="secondary">Optional</Badge></td><td className="py-2">0-indexed page number (default 0)</td></tr>
                      <tr><td className="py-2 pr-4 font-mono">limit</td><td className="py-2 pr-4">integer</td><td className="py-2 pr-4"><Badge variant="secondary">Optional</Badge></td><td className="py-2">Results per page (default 500, max 1000)</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4 rounded-lg">
                <p className="text-sm"><strong>Note:</strong> Date range filters by <code>updated_at</code> — returns only leads that had status/FTD changes in that period. Rejected leads are excluded by default. <code>fromDate</code>/<code>toDate</code> are inclusive boundaries evaluated in the server's UTC clock: <code>fromDate</code> at 00:00:00.000 through <code>toDate</code> at 23:59:59.999.</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
                <p className="text-sm"><strong>Rate limit:</strong> 100 requests per minute per affiliate API key. Exceeding it returns HTTP 429 with <code>{`{ "success": false, "rejection": { "code": "RATE_LIMITED" } }`}</code>.</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
                <p className="text-sm"><strong>Conversions:</strong> <code>hasFTD=1</code> is the sole mechanism for pulling converted leads — there is no separate conversions endpoint.</p>
              </div>
              <Tabs defaultValue="request">
                <TabsList>
                  <TabsTrigger value="request">Example Request</TabsTrigger>
                  <TabsTrigger value="response">Response</TabsTrigger>
                </TabsList>
                <TabsContent value="request">
                  <div className="bg-slate-900 text-slate-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                    <pre>{`GET ${BASE_URL}/get-leads?fromDate=01/01/26&toDate=01/31/26&hasFTD=1&page=0&limit=500\nHeaders:\n  Api-Key: your_api_key_here`}</pre>
                  </div>
                </TabsContent>
                <TabsContent value="response">
                  <div className="bg-slate-900 text-slate-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                    <pre>{`{\n  "success": true,\n  "total": 2,\n  "page": 0,\n  "limit": 500,\n  "pages": 1,\n  "count": 2,\n  "data": [\n    {\n      "id": "9783cddc-ea4a-4a36-b207-52360b6634fc",\n      "lead_code": "fa4b6d82-b789-4c29-b069-a3c6a8d0fa9d",\n      "firstname": "John",\n      "lastname": "Doe",\n      "email": "john.doe@example.com",\n      "country_code": "CA",\n      "status": "Depositor",\n      "is_ftd": 1,\n      "ftd_date": "2026-01-15T10:30:00Z",\n      "created_at": "2026-01-10T08:12:00Z"\n    }\n  ]\n}`}</pre>
                  </div>
                  <div className="mt-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
                    <p className="text-sm"><strong>ℹ️ Status Field:</strong> Contains the sale status reported by the advertiser's CRM (e.g., "New", "Callback", "Depositor"). Values vary by advertiser and are independent of the <code>is_ftd</code> field — <code>sale_status</code> is display text only and should never be used as an FTD signal.</p>
                  </div>
                  <div className="mt-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
                    <p className="text-sm"><strong>ℹ️ is_ftd Field:</strong> Only becomes <code>1</code> once the FTD has been manually released internally — it can lag behind the advertiser's reported <code>sale_status</code>.</p>
                  </div>
                  <div className="mt-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
                    <p className="text-sm"><strong>ℹ️ created_at Field:</strong> The lead's original registration timestamp (UTC, ISO 8601).</p>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Lead Status */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Badge className="bg-blue-500">GET</Badge>
                <CardTitle className="font-mono">/lead-status</CardTitle>
              </div>
              <p className="text-muted-foreground">Check status of a specific lead</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-semibold mb-3">Query Parameters (one required)</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 pr-4">Parameter</th>
                        <th className="text-left py-2 pr-4">Type</th>
                        <th className="text-left py-2">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b"><td className="py-2 pr-4 font-mono">lead_id</td><td className="py-2 pr-4">string</td><td className="py-2">The lead UUID</td></tr>
                      <tr className="border-b"><td className="py-2 pr-4 font-mono">request_id</td><td className="py-2 pr-4">string</td><td className="py-2">The request ID returned from submission</td></tr>
                      <tr><td className="py-2 pr-4 font-mono">email</td><td className="py-2 pr-4">string</td><td className="py-2">The lead's email address</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <Tabs defaultValue="request">
                <TabsList>
                  <TabsTrigger value="request">Example Request</TabsTrigger>
                  <TabsTrigger value="response">Response</TabsTrigger>
                </TabsList>
                <TabsContent value="request">
                  <div className="bg-slate-900 text-slate-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                    <pre>{`GET ${BASE_URL}/lead-status?request_id=fa4b6d82-b789-4c29-b069-a3c6a8d0fa9d\nHeaders:\n  Api-Key: your_api_key_here`}</pre>
                  </div>
                </TabsContent>
                <TabsContent value="response">
                  <div className="bg-slate-900 text-slate-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                    <pre>{`{\n  "success": true,\n  "lead_id": "9783cddc-ea4a-4a36-b207-52360b6634fc",\n  "request_id": "fa4b6d82-b789-4c29-b069-a3c6a8d0fa9d",\n  "status": "Callback",\n  "is_ftd": 0\n}`}</pre>
                  </div>
                  <div className="mt-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
                    <p className="text-sm"><strong>ℹ️ Status Field:</strong> Contains the sale status as reported by the advertiser's CRM system.</p>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Status Codes */}
        <Card>
          <CardHeader><CardTitle>📊 Status Values</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Common sale status values returned by the advertiser's CRM:</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[["New","bg-blue-100 text-blue-800","Lead received"],["Callback","bg-yellow-100 text-yellow-800","Scheduled callback"],["No Answer","bg-orange-100 text-orange-800","No response"],["Depositor","bg-green-100 text-green-800","Made deposit"],["Interested","bg-purple-100 text-purple-800","Shows interest"],["Not Interested","bg-red-100 text-red-800","Declined"]].map(([s,c,d]) => (
                <div key={s} className="flex items-center gap-2">
                  <Badge className={c}>{s}</Badge>
                  <span className="text-sm">{d}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Exact values depend on the advertiser's CRM configuration.</p>
          </CardContent>
        </Card>

        {/* HTTP Status Codes */}
        <Card>
          <CardHeader><CardTitle>⚠️ HTTP Status Codes</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b"><th className="text-left py-2 pr-4">Code</th><th className="text-left py-2">Description</th></tr></thead>
                <tbody>
                  {[["200","bg-green-500","Success"],["201","bg-green-500","Lead created successfully"],["400","bg-yellow-500","Bad request – missing required parameters"],["401","bg-red-500","Unauthorized – invalid or missing API key"],["404","bg-red-500","Lead not found"],["409","bg-orange-500","Duplicate – email already exists"],["422","bg-orange-500","Validation error"],["503","bg-red-500","Caps full – try again later"]].map(([code,cls,desc]) => (
                    <tr key={code} className="border-b last:border-0">
                      <td className="py-2 pr-4"><Badge className={cls}>{code}</Badge></td>
                      <td className="py-2">{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Support */}
        <Card>
          <CardHeader><CardTitle>💬 Support</CardTitle></CardHeader>
          <CardContent>
            <p className="text-muted-foreground">For API access, technical support, or questions, contact your account manager.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
