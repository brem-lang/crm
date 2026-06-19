import { helpArticles, helpCategories, HelpArticle } from "@/data/helpArticles";

export type BotStep =
  | { name: "menu" }
  | { name: "category"; categoryId: string }
  | { name: "article"; articleId: string }
  | { name: "collect_name" }
  | { name: "collect_email"; visitorName: string }
  | { name: "awaiting_agent" }
  | { name: "api_guide_auth" }
  | { name: "api_guide_fields" }
  | { name: "api_guide_example" };

export interface BotResponse {
  message: string;
  quickReplies?: string[];
  nextStep: BotStep;
  requestAgent?: boolean;
  collectedName?: string;
  collectedEmail?: string;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function visibleCategories(userRoles: string[]) {
  return helpCategories.filter(
    c => !c.roles || c.roles.some(r => userRoles.includes(r))
  );
}

function visibleArticles(userRoles: string[]) {
  return helpArticles.filter(
    a => !a.roles || a.roles.some(r => userRoles.includes(r))
  );
}

function articlesInCategory(categoryId: string, userRoles: string[]): HelpArticle[] {
  return helpArticles.filter(
    a =>
      a.category === categoryId &&
      (!a.roles || a.roles.some(r => userRoles.includes(r)))
  );
}

function searchArticles(query: string, userRoles: string[]): HelpArticle[] {
  const q = query.toLowerCase();
  return visibleArticles(userRoles).filter(
    a =>
      a.title.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q) ||
      a.steps.some(
        s =>
          s.title.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q)
      )
  );
}

function formatArticle(article: HelpArticle): string {
  const stepLines = article.steps
    .slice(0, 4)
    .map((s, i) => `${i + 1}. ${s.title}: ${s.description}${s.tip ? ` (Tip: ${s.tip})` : ""}`)
    .join("\n");
  const overflow =
    article.steps.length > 4
      ? `\n\n(+${article.steps.length - 4} more steps — see Help & Guides for the full article)`
      : "";
  return `${article.title}\n\n${article.description}\n\n${stepLines}${overflow}`;
}

function relatedQuickReplies(article: HelpArticle, userRoles: string[]): string[] {
  const related = (article.relatedArticles ?? [])
    .map(id => helpArticles.find(a => a.id === id))
    .filter((a): a is HelpArticle => !!a && (!a.roles || a.roles.some(r => userRoles.includes(r))))
    .slice(0, 2)
    .map(a => a.title);
  return [...related, "Back to Menu", "Talk to Agent"];
}

// ── public API ────────────────────────────────────────────────────────────────

export function getGreeting(userRoles: string[]): BotResponse {
  const cats = visibleCategories(userRoles);
  return {
    message:
      "👋 Hi there! I can help you find answers from our Help & Guides. What topic do you need help with?",
    quickReplies: [...cats.slice(0, 4).map(c => c.title), "Submit Leads via API", "Talk to Agent"],
    nextStep: { name: "menu" },
  };
}

export function getBotResponse(
  input: string,
  step: BotStep,
  userRoles: string[]
): BotResponse {
  const text = input.trim();
  const lower = text.toLowerCase();

  // ── "Talk to Agent" always takes priority ─────────────────────────────────
  if (
    lower.includes("talk to agent") ||
    lower.includes("live agent") ||
    lower.includes("speak to") ||
    lower === "agent"
  ) {
    return {
      message: "I'll connect you with a live agent now. Please hold on a moment...",
      nextStep: { name: "awaiting_agent" },
      requestAgent: true,
    };
  }

  // ── Back to menu ──────────────────────────────────────────────────────────
  if (lower === "back to menu" || lower === "menu" || lower === "back" || lower === "start over") {
    return getGreeting(userRoles);
  }

  // ── API guide flow ────────────────────────────────────────────────────────
  if (lower === "submit leads via api" || lower === "submit leads" || lower === "api guide") {
    return {
      message:
        "I'll walk you through submitting leads via the API.\n\n" +
        "📡 Endpoint:\nPOST /functions/v1/submit-lead\n\n" +
        "🔑 Authentication:\nInclude your affiliate API key in the request header:\n" +
        "Api-Key: YOUR_API_KEY\n\n" +
        "You can find your API key in the Affiliates section of the CRM.",
      quickReplies: ["Next: Required Fields", "Back to Menu"],
      nextStep: { name: "api_guide_auth" },
    };
  }

  if (step.name === "api_guide_auth" || lower === "next: required fields") {
    return {
      message:
        "📋 Required fields (JSON body):\n\n" +
        "• firstname — 2–50 characters\n" +
        "• lastname — 2–50 characters\n" +
        "• email — valid email address\n" +
        "• mobile — digits only, 7–15 digits\n" +
        "• country_code — 2-letter ISO code (e.g. US, GB, DE)\n\n" +
        "Optional: custom1, custom2, custom3, offer_name, comment",
      quickReplies: ["See Example Request", "Back to Menu"],
      nextStep: { name: "api_guide_fields" },
    };
  }

  if (step.name === "api_guide_fields" || lower === "see example request") {
    return {
      message:
        "📦 Example request:\n\n" +
        "POST /functions/v1/submit-lead\n" +
        "Content-Type: application/json\n" +
        "Api-Key: YOUR_API_KEY\n\n" +
        "{\n" +
        '  "firstname": "John",\n' +
        '  "lastname": "Doe",\n' +
        '  "email": "john@example.com",\n' +
        '  "mobile": "1234567890",\n' +
        '  "country_code": "US"\n' +
        "}\n\n" +
        "✅ A successful response returns HTTP 201 with a lead_id.",
      quickReplies: ["View Full API Docs", "Back to Menu"],
      nextStep: { name: "api_guide_example" },
    };
  }

  if (step.name === "api_guide_example" || lower === "view full api docs") {
    return {
      message:
        "You can find the full API documentation — including all optional fields, response codes, and error handling — in the API Docs section. Navigate there from the sidebar.",
      quickReplies: ["Back to Menu", "Talk to Agent"],
      nextStep: { name: "menu" },
    };
  }

  // ── Browse all categories ─────────────────────────────────────────────────
  if (lower.includes("browse") || lower.includes("all topic") || lower.includes("all guide")) {
    const cats = visibleCategories(userRoles);
    return {
      message: "Here are all the available help topics:",
      quickReplies: [...cats.map(c => c.title), "Talk to Agent"],
      nextStep: { name: "menu" },
    };
  }

  // ── Info collection flow ──────────────────────────────────────────────────
  if (step.name === "collect_name") {
    return {
      message: `Thanks, ${text}! What's your email address so we can follow up with you?`,
      nextStep: { name: "collect_email", visitorName: text },
      collectedName: text,
    };
  }

  if (step.name === "collect_email") {
    const emailLike = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
    if (!emailLike) {
      return {
        message: "That doesn't look like a valid email. Please enter your email address:",
        nextStep: step,
      };
    }
    return {
      message:
        "Got it! We've saved your details and an agent will reach out to you soon. Is there anything else I can help with?",
      quickReplies: ["Back to Menu", "Talk to Agent"],
      nextStep: { name: "menu" },
      collectedEmail: text,
      collectedName: step.visitorName,
    };
  }

  // ── Category match ────────────────────────────────────────────────────────
  const catMatch = visibleCategories(userRoles).find(
    c => c.title.toLowerCase() === lower || c.id === lower.replace(/ /g, "-")
  );
  if (catMatch) {
    const arts = articlesInCategory(catMatch.id, userRoles);
    if (arts.length === 0) {
      return {
        message: `No guides are available in "${catMatch.title}" for your access level.`,
        quickReplies: ["Back to Menu", "Talk to Agent"],
        nextStep: { name: "menu" },
      };
    }
    return {
      message: `Here are the guides in "${catMatch.title}":`,
      quickReplies: [...arts.slice(0, 6).map(a => a.title), "Back to Menu"],
      nextStep: { name: "category", categoryId: catMatch.id },
    };
  }

  // ── Exact article title match ─────────────────────────────────────────────
  const exactArticle = visibleArticles(userRoles).find(
    a => a.title.toLowerCase() === lower
  );
  if (exactArticle) {
    return {
      message: formatArticle(exactArticle),
      quickReplies: relatedQuickReplies(exactArticle, userRoles),
      nextStep: { name: "article", articleId: exactArticle.id },
    };
  }

  // ── Full-text search ──────────────────────────────────────────────────────
  const results = searchArticles(text, userRoles);

  if (results.length === 1) {
    return {
      message: formatArticle(results[0]),
      quickReplies: relatedQuickReplies(results[0], userRoles),
      nextStep: { name: "article", articleId: results[0].id },
    };
  }

  if (results.length > 1) {
    return {
      message: `I found ${results.length} guides related to "${text}". Which one would you like?`,
      quickReplies: [...results.slice(0, 5).map(a => a.title), "Talk to Agent"],
      nextStep: { name: "menu" },
    };
  }

  // ── Fallback ──────────────────────────────────────────────────────────────
  return {
    message:
      "I couldn't find anything matching that. Try picking a topic below, or talk to a live agent.",
    quickReplies: [
      ...visibleCategories(userRoles)
        .slice(0, 3)
        .map(c => c.title),
      "Talk to Agent",
    ],
    nextStep: step,
  };
}
