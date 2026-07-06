export interface HelpStep {
  title: string;
  description: string;
  tip?: string;
  warning?: string;
}

export interface HelpArticle {
  id: string;
  title: string;
  description: string;
  category: string;
  roles?: string[];
  steps: HelpStep[];
  relatedArticles?: string[];
}

export interface HelpCategory {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  roles?: string[];
}

export const helpCategories: HelpCategory[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    description: "Learn the basics and navigate the CRM",
    icon: "rocket",
    color: "bg-blue-500",
  },
  {
    id: "affiliates",
    title: "Affiliates",
    description: "Add and manage affiliate partners",
    icon: "users",
    color: "bg-green-500",
    roles: ["super_admin", "manager"],
  },
  {
    id: "advertisers",
    title: "Advertisers",
    description: "Configure advertisers and their settings",
    icon: "building",
    color: "bg-purple-500",
    roles: ["super_admin", "manager"],
  },
  {
    id: "leads",
    title: "Leads",
    description: "View, filter, and manage incoming leads",
    icon: "target",
    color: "bg-orange-500",
  },
  {
    id: "distribution",
    title: "Distribution",
    description: "Set up routing rules and distribution logic",
    icon: "git-merge",
    color: "bg-cyan-500",
    roles: ["super_admin", "manager"],
  },
  {
    id: "injection",
    title: "Injection",
    description: "Create and monitor injection jobs",
    icon: "syringe",
    color: "bg-pink-500",
    roles: ["super_admin", "manager"],
  },
  {
    id: "reports",
    title: "Reports",
    description: "Read reports, conversions, and performance data",
    icon: "bar-chart",
    color: "bg-yellow-500",
    roles: ["super_admin", "manager"],
  },
  {
    id: "users",
    title: "User Management",
    description: "Add users, assign roles, and manage permissions",
    icon: "shield",
    color: "bg-red-500",
    roles: ["super_admin"],
  },
];

export const helpArticles: HelpArticle[] = [
  // ── GETTING STARTED ──────────────────────────────────────────
  {
    id: "crm-overview",
    title: "CRM Overview",
    description: "Understand the key concepts and how leads flow through the system",
    category: "getting-started",
    steps: [
      {
        title: "What is this CRM?",
        description:
          "This is a lead management platform. Affiliates send leads into the system via an API or manually. Those leads are then distributed to Advertisers based on rules you configure. The CRM tracks every step — from submission to conversion.",
      },
      {
        title: "The Lead Lifecycle",
        description:
          "A lead enters the system → it is evaluated against Distribution Rules → it is routed to a matching Advertiser → the Advertiser's CRM processes it and reports back a status (e.g. 'Depositor'). You can track this entire journey from the Leads page.",
      },
      {
        title: "Key Roles",
        description:
          "Super Admin has full access. Manager can handle day-to-day operations (leads, affiliates, advertisers, reports). Agent sees leads and reports only. Affiliate can only submit leads via API.",
        tip: "Your role is shown at the bottom of the left sidebar under your username.",
      },
      {
        title: "Navigating the Sidebar",
        description:
          "The left sidebar contains all sections of the CRM. Items with an arrow ( › ) have sub-pages — click the arrow to expand them. On mobile, tap the hamburger menu (top-left) to open the sidebar.",
      },
    ],
    relatedArticles: ["add-affiliate", "add-advertiser"],
  },
  {
    id: "sidebar-navigation",
    title: "Navigating the Sidebar",
    description: "Learn how to move around the CRM quickly",
    category: "getting-started",
    steps: [
      {
        title: "Main Navigation",
        description:
          "Every major feature is accessible from the left sidebar: Dashboard, Leads, Affiliates, Advertisers, Distribution, Reports, Injections, and Admin sections.",
      },
      {
        title: "Collapsing the Sidebar",
        description:
          "Click the arrow icon at the top-right of the sidebar to collapse it to icon-only mode. This gives more space for the main content area. Hover over icons to see tooltips with page names.",
      },
      {
        title: "Expandable Sections",
        description:
          "Sections like Affiliates, Advertisers, and Distribution have sub-pages. Click the section title to navigate to it, and click the chevron ( › ) on the right to expand sub-items.",
      },
      {
        title: "Mobile Navigation",
        description:
          "On smaller screens, the sidebar is hidden by default. Tap the hamburger icon (three lines) in the top-left corner to open it. Tap outside the sidebar or navigate to a page to close it.",
      },
    ],
  },
  {
    id: "understanding-your-dashboard",
    title: "Understanding Your Dashboard",
    description: "Read the key metrics on your main dashboard",
    category: "getting-started",
    steps: [
      {
        title: "Summary Cards",
        description:
          "The top row shows today's key stats: total leads, distributed leads, conversions, and active advertisers. These update in real-time as new data arrives.",
      },
      {
        title: "Recent Leads",
        description:
          "The leads table below the cards shows the most recently submitted leads with their current status. Click any row to see lead details.",
      },
      {
        title: "Charts and Trends",
        description:
          "Charts on the dashboard show lead volume over time and distribution breakdowns. Use these to quickly spot trends or unusual drops in traffic.",
        tip: "For more detailed reporting, go to the Reports section in the sidebar.",
      },
    ],
    relatedArticles: ["reading-reports"],
  },

  // ── AFFILIATES ───────────────────────────────────────────────
  {
    id: "add-affiliate",
    title: "How to Add an Affiliate",
    description: "Create a new affiliate account and generate their API key",
    category: "affiliates",
    roles: ["super_admin", "manager"],
    steps: [
      {
        title: "Go to Affiliates",
        description: "In the sidebar, click Affiliates. This opens the affiliates list page.",
      },
      {
        title: "Click 'Add Affiliate'",
        description:
          "Click the 'Add Affiliate' button in the top-right corner of the page. A dialog will open.",
      },
      {
        title: "Fill in the Affiliate Details",
        description:
          "Enter the affiliate's name, email, and any other required fields. The name is displayed in reports and lead records.",
        tip: "Use a clear, recognizable name — it will appear on every lead the affiliate sends.",
      },
      {
        title: "Save and Get the API Key",
        description:
          "Click Save. The new affiliate will appear in the list. Click on the affiliate to open their detail panel — the API key is shown there. Share this key with the affiliate so they can start submitting leads.",
        warning:
          "The API key is sensitive. Only share it directly with the affiliate, not via public channels.",
      },
    ],
    relatedArticles: ["affiliate-performance"],
  },
  {
    id: "affiliate-performance",
    title: "Viewing Affiliate Performance",
    description: "Track how many leads each affiliate is sending and their conversion rates",
    category: "affiliates",
    roles: ["super_admin", "manager"],
    steps: [
      {
        title: "Open Affiliate Performance",
        description:
          "In the sidebar, expand Affiliates and click Performance. This shows a breakdown by affiliate.",
      },
      {
        title: "Reading the Table",
        description:
          "Each row shows an affiliate with their total leads submitted, accepted leads, rejected leads, and conversion rate. Sort by any column by clicking the column header.",
      },
      {
        title: "Date Filtering",
        description:
          "Use the date range picker at the top to filter results to a specific period. This is useful for monthly or weekly performance reviews.",
      },
    ],
    relatedArticles: ["add-affiliate", "reading-reports"],
  },

  // ── ADVERTISERS ──────────────────────────────────────────────
  {
    id: "add-advertiser",
    title: "How to Add an Advertiser",
    description: "Create an advertiser account in the CRM",
    category: "advertisers",
    roles: ["super_admin", "manager"],
    steps: [
      {
        title: "Go to Advertisers",
        description: "Click Advertisers in the left sidebar.",
      },
      {
        title: "Click 'Add Advertiser'",
        description: "Click the Add Advertiser button. A dialog form will open.",
      },
      {
        title: "Enter Advertiser Details",
        description:
          "Fill in the advertiser's name and endpoint URL. The endpoint URL is where the CRM will send leads via HTTP POST.",
        tip: "If the advertiser uses a specific authentication method (API key header, Basic Auth), you can set that up in Advertiser Config after saving.",
      },
      {
        title: "Save",
        description:
          "Click Save. The advertiser now appears in the list and can be targeted in Distribution Rules.",
      },
    ],
    relatedArticles: ["configure-advertiser", "create-distribution-rule"],
  },
  {
    id: "configure-advertiser",
    title: "Configuring Advertiser Settings",
    description: "Set up caps, schedules, authentication, and field mappings for an advertiser",
    category: "advertisers",
    roles: ["super_admin", "manager"],
    steps: [
      {
        title: "Go to Distribution → Advertiser Config",
        description:
          "In the sidebar, expand Distribution and click Advertiser Config. Find your advertiser in the list.",
      },
      {
        title: "Set Daily / Monthly Caps",
        description:
          "Caps limit how many leads the advertiser receives per day or per month. Once a cap is reached, the system will stop routing leads to that advertiser until the cap resets.",
        tip: "Leave caps at 0 or blank to mean 'unlimited'.",
      },
      {
        title: "Configure the Schedule",
        description:
          "Use the schedule heatmap to define which hours and days the advertiser accepts leads. Cells you click are marked as active. Leads are only sent during active time slots.",
        tip: "You can drag across multiple cells to set a range quickly.",
      },
      {
        title: "Authentication & Headers",
        description:
          "If the advertiser's endpoint requires an API key or other header, set it here. Common options: API key in header, Basic Auth, or Bearer token.",
      },
      {
        title: "Field Mapping",
        description:
          "If the advertiser expects different field names (e.g., 'phone' instead of 'mobile'), use the field mapping section to translate CRM field names to what the advertiser expects.",
      },
    ],
    relatedArticles: ["add-advertiser", "create-distribution-rule"],
  },

  // ── LEADS ────────────────────────────────────────────────────
  {
    id: "viewing-leads",
    title: "Viewing and Filtering Leads",
    description: "Find, search, and filter leads in the leads table",
    category: "leads",
    steps: [
      {
        title: "Go to Leads",
        description: "Click Leads in the sidebar. The leads table shows all leads in the system.",
      },
      {
        title: "Search by Name or Email",
        description:
          "Use the search bar at the top of the table to find a specific lead by first name, last name, or email address.",
      },
      {
        title: "Filter by Status, Country, or Affiliate",
        description:
          "Use the filter dropdowns above the table to narrow results. You can combine multiple filters — for example: show only 'Depositor' leads from 'United Kingdom' from a specific affiliate.",
      },
      {
        title: "Filter by Date Range",
        description:
          "Use the date picker to show leads submitted within a specific date range. This is useful for daily or weekly reviews.",
      },
      {
        title: "Exporting Leads",
        description:
          "Click the Export button (top-right of the table) to download the current filtered view as a CSV file.",
        tip: "Apply all filters first before exporting — the export includes only the rows currently shown.",
      },
    ],
    relatedArticles: ["understanding-lead-status", "rejected-leads"],
  },
  {
    id: "understanding-lead-status",
    title: "Understanding Lead Statuses",
    description: "What each lead status means and how it gets assigned",
    category: "leads",
    steps: [
      {
        title: "New",
        description: "The lead was just submitted and has not been processed yet.",
      },
      {
        title: "Distributed",
        description:
          "The lead was successfully sent to an advertiser. The system is waiting for the advertiser to report back a sale status.",
      },
      {
        title: "Rejected",
        description:
          "The lead was rejected — either by the CRM (duplicate, failed validation) or by the advertiser's endpoint. Check the rejection reason in the lead detail.",
      },
      {
        title: "Sale Statuses (from Advertiser)",
        description:
          "Once the advertiser processes the lead, they report a status back. Common values: 'Callback', 'No Answer', 'Interested', 'Depositor'. These come directly from the advertiser's CRM.",
        tip: "A 'Depositor' status typically means a first-time deposit (FTD) was made.",
      },
    ],
    relatedArticles: ["viewing-leads", "rejected-leads"],
  },
  {
    id: "rejected-leads",
    title: "Working with Rejected Leads",
    description: "Understand why leads are rejected and what you can do",
    category: "leads",
    roles: ["super_admin", "manager"],
    steps: [
      {
        title: "Go to Rejected Leads",
        description:
          "Click Rejected Leads in the sidebar. This shows all leads the system could not route to an advertiser.",
      },
      {
        title: "Read the Rejection Reason",
        description:
          "Each row includes a rejection reason column. Common reasons: 'No matching rule' (no distribution rule matched the lead), 'Caps full' (advertiser daily/monthly cap was hit), 'Outside schedule' (lead arrived outside active hours).",
      },
      {
        title: "Fixing Common Rejections",
        description:
          "For 'No matching rule' rejections, review your Distribution Rules to make sure the lead's country and affiliate are covered. For 'Caps full', check the advertiser's daily cap settings in Advertiser Config.",
      },
    ],
    relatedArticles: ["create-distribution-rule", "configure-advertiser"],
  },

  // ── DISTRIBUTION ─────────────────────────────────────────────
  {
    id: "create-distribution-rule",
    title: "Creating a Distribution Rule",
    description: "Define how leads are routed to advertisers",
    category: "distribution",
    roles: ["super_admin", "manager"],
    steps: [
      {
        title: "Go to Distribution → Distribution Rules",
        description: "In the sidebar, expand Distribution and click Distribution Rules.",
      },
      {
        title: "Click 'Add Rule'",
        description: "Click the Add Rule button. A dialog form will open.",
      },
      {
        title: "Set the Rule Name",
        description:
          "Give the rule a clear name that describes what it matches — for example, 'US Leads – Advertiser A'.",
      },
      {
        title: "Set Conditions",
        description:
          "Define which leads this rule applies to. Conditions include: country, affiliate, lead source, and custom fields. A lead must match ALL conditions to be routed by this rule.",
        tip: "Leave a condition blank to match any value — e.g. leave Affiliate blank to match leads from all affiliates.",
      },
      {
        title: "Assign Target Advertisers",
        description:
          "Add one or more advertisers as targets. If you add multiple, the system will use the priority order you set. The lead goes to the highest-priority advertiser that has capacity.",
      },
      {
        title: "Set Priority",
        description:
          "Each rule has a priority number. Lower numbers run first. If a lead matches multiple rules, only the highest-priority (lowest number) rule is used.",
        warning:
          "Make sure you don't have conflicting rules at the same priority — the first match wins.",
      },
      {
        title: "Save and Activate",
        description:
          "Click Save. The rule is active immediately. New leads that match its conditions will be routed accordingly.",
      },
    ],
    relatedArticles: ["configure-advertiser", "rejected-leads"],
  },
  {
    id: "distribution-history",
    title: "Viewing Distribution History",
    description: "See a log of every routing decision made by the system",
    category: "distribution",
    roles: ["super_admin", "manager"],
    steps: [
      {
        title: "Go to Distribution → History",
        description: "In the sidebar, expand Distribution and click History.",
      },
      {
        title: "Reading the Log",
        description:
          "Each row shows a lead, which rule was matched, which advertiser it was sent to, and the result (success or failure with reason).",
      },
      {
        title: "Filtering",
        description:
          "Filter by date range, advertiser, or result status to zero in on specific routing issues.",
      },
    ],
    relatedArticles: ["create-distribution-rule"],
  },

  // ── INJECTION ────────────────────────────────────────────────
  {
    id: "create-injection-job",
    title: "Creating an Injection Job",
    description: "Send a batch of leads to an advertiser using the injection system",
    category: "injection",
    roles: ["super_admin", "manager"],
    steps: [
      {
        title: "What is Injection?",
        description:
          "Injection lets you send a batch of existing leads to an advertiser manually — outside of the normal real-time routing flow. This is useful for re-sending rejected leads or running a bulk campaign.",
      },
      {
        title: "Go to Injections → Injection Jobs",
        description: "In the sidebar, expand Injections and click Injection Jobs.",
      },
      {
        title: "Click 'New Job'",
        description: "Click the New Job button. A setup form will open.",
      },
      {
        title: "Select the Advertiser",
        description: "Choose which advertiser will receive the leads in this job.",
      },
      {
        title: "Select the Lead Pool or Upload Leads",
        description:
          "Choose an existing lead pool as the data source, or upload a CSV of leads directly.",
        tip: "Lead Pools are reusable batches of leads you can create in advance under Injections → Lead Pools.",
      },
      {
        title: "Set Rate Limits",
        description:
          "Configure how many leads per minute/hour to send. This prevents overwhelming the advertiser's endpoint.",
      },
      {
        title: "Start the Job",
        description:
          "Click Start. The job will run in the background. You can monitor progress on the Injection Jobs page — it shows sent count, failed count, and current status.",
      },
    ],
    relatedArticles: ["monitor-injection-job", "create-lead-pool"],
  },
  {
    id: "monitor-injection-job",
    title: "Monitoring an Injection Job",
    description: "Track progress and handle failures in a running injection job",
    category: "injection",
    roles: ["super_admin", "manager"],
    steps: [
      {
        title: "Go to Injections → Injection Jobs",
        description: "The jobs list shows all injection jobs with their current status.",
      },
      {
        title: "Click a Job to Open Details",
        description:
          "The detail view shows the job's progress: leads sent, leads pending, failures, and the per-lead log.",
      },
      {
        title: "Reviewing Failed Leads",
        description:
          "Click Failed Leads in the sidebar (under Injections) to see all leads that failed across all jobs. Each entry shows the error message returned by the advertiser.",
      },
      {
        title: "Pausing or Stopping a Job",
        description:
          "From the job detail page, use the Pause or Stop buttons to halt a running job. Paused jobs can be resumed; stopped jobs cannot.",
        warning: "Stopping a job is irreversible — stopped jobs cannot be restarted.",
      },
    ],
    relatedArticles: ["create-injection-job"],
  },
  {
    id: "create-lead-pool",
    title: "Creating a Lead Pool",
    description: "Build a reusable batch of leads for injection jobs",
    category: "injection",
    roles: ["super_admin", "manager"],
    steps: [
      {
        title: "Go to Injections → Lead Pools",
        description: "In the sidebar, expand Injections and click Lead Pools.",
      },
      {
        title: "Click 'Create Pool'",
        description: "Click Create Pool. Give the pool a name and description.",
      },
      {
        title: "Add Leads",
        description:
          "Upload a CSV of leads, or use the filter builder to pull in existing leads from the CRM that match specific criteria (country, affiliate, date range, etc.).",
      },
      {
        title: "Save the Pool",
        description:
          "Save the pool. It will appear in the list and can now be selected when creating injection jobs.",
        tip: "You can reuse the same pool in multiple injection jobs targeting different advertisers.",
      },
    ],
    relatedArticles: ["create-injection-job"],
  },

  // ── REPORTS ──────────────────────────────────────────────────
  {
    id: "reading-reports",
    title: "Reading the Reports Page",
    description: "Understand the main report and how to slice the data",
    category: "reports",
    roles: ["super_admin", "manager"],
    steps: [
      {
        title: "Go to Reports",
        description: "Click Reports in the sidebar.",
      },
      {
        title: "Set the Date Range",
        description:
          "Use the date range picker at the top to set the period you want to analyze. All metrics on the page update based on this selection.",
      },
      {
        title: "Reading the Summary",
        description:
          "The summary row shows totals for the selected period: total leads, distributed leads, conversions (FTDs), and rejection rate.",
      },
      {
        title: "Breakdown by Affiliate / Advertiser",
        description:
          "The table below breaks down performance by affiliate or advertiser. Switch between views using the tabs above the table.",
      },
    ],
    relatedArticles: ["conversion-report", "country-performance"],
  },
  {
    id: "conversion-report",
    title: "Conversion Report",
    description: "Track first-time deposits (FTDs) and conversion rates",
    category: "reports",
    roles: ["super_admin", "manager"],
    steps: [
      {
        title: "Go to Reports → Conversions",
        description: "In the sidebar, expand Reports and click Conversions.",
      },
      {
        title: "What is a Conversion?",
        description:
          "A conversion (FTD — First Time Deposit) is when a lead makes their first deposit with an advertiser. The advertiser's CRM reports this back, and the status is updated to reflect it.",
      },
      {
        title: "Filtering Conversions",
        description:
          "Filter by date, affiliate, or advertiser to see conversion performance for specific partners.",
      },
    ],
    relatedArticles: ["reading-reports", "country-performance"],
  },
  {
    id: "country-performance",
    title: "Country Performance",
    description: "See which countries are driving the most leads and conversions",
    category: "reports",
    roles: ["super_admin", "manager"],
    steps: [
      {
        title: "Go to Reports → Country Performance",
        description: "In the sidebar, expand Reports and click Country Performance.",
      },
      {
        title: "Reading the Map and Table",
        description:
          "The heatmap shows lead volume by country. The table below ranks countries by leads submitted, FTDs, and conversion rate.",
      },
      {
        title: "Using this Data",
        description:
          "Use country performance data to decide which countries to prioritize in your distribution rules — focus on countries with high conversion rates.",
        tip: "If a country has high lead volume but low conversions, check whether you have a well-configured advertiser accepting leads from that country.",
      },
    ],
    relatedArticles: ["reading-reports", "create-distribution-rule"],
  },

  // ── USER MANAGEMENT ─────────────────────────────────────────
  {
    id: "add-user",
    title: "Adding a New User",
    description: "Create a CRM account for a new team member",
    category: "users",
    roles: ["super_admin"],
    steps: [
      {
        title: "Go to Users",
        description: "Click Users in the sidebar (visible to Super Admins only).",
      },
      {
        title: "Click 'Add User'",
        description: "Click the Add User button in the top-right. A dialog will open.",
      },
      {
        title: "Fill in User Details",
        description:
          "Enter the new user's email address, a username, their full name, and a temporary password.",
        tip: "Ask the new user to change their password after their first login.",
      },
      {
        title: "Assign a Role",
        description:
          "Select a system role: Super Admin, Manager, Agent, Affiliate, or Affiliate Manager. The role controls what pages and actions the user can access.",
        warning:
          "Super Admin has unrestricted access to everything — only assign this to trusted administrators.",
      },
      {
        title: "Save",
        description:
          "Click Save. The user can now log in with the credentials you set. They will appear in the Users list.",
      },
    ],
    relatedArticles: ["manage-roles-permissions"],
  },
  {
    id: "manage-roles-permissions",
    title: "Managing Roles and Permissions",
    description: "Create custom roles and fine-tune what users can do",
    category: "users",
    roles: ["super_admin"],
    steps: [
      {
        title: "Go to Roles & Permissions",
        description: "Click Roles & Permissions in the sidebar.",
      },
      {
        title: "System Roles vs Custom Roles",
        description:
          "System roles (Super Admin, Manager, Agent, Affiliate) are built-in and cannot be deleted. Custom roles let you define your own permission sets for more granular control.",
      },
      {
        title: "Creating a Custom Role",
        description:
          "Click Add Role. Give it a name and choose which permissions to grant. Permissions cover read/write access to every module: leads, advertisers, affiliates, reports, settings, etc.",
      },
      {
        title: "Assigning a Custom Role to a User",
        description:
          "Go to Users, open the user, and assign the custom role. A user can have one system role and one or more custom roles — permissions from all are combined.",
        tip: "Super Admins bypass all permission checks, regardless of custom role settings.",
      },
    ],
    relatedArticles: ["add-user"],
  },
];
