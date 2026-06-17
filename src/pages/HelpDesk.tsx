import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { HelpSearch } from "@/components/help/HelpSearch";
import { HelpArticle } from "@/components/help/HelpArticle";
import { helpArticles, helpCategories } from "@/data/helpArticles";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  Rocket,
  Users,
  Building2,
  Target,
  GitMerge,
  Syringe,
  BarChart3,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  rocket: Rocket,
  users: Users,
  building: Building2,
  target: Target,
  "git-merge": GitMerge,
  syringe: Syringe,
  "bar-chart": BarChart3,
  shield: ShieldCheck,
};

const colorMap: Record<string, string> = {
  "bg-blue-500": "bg-blue-500",
  "bg-green-500": "bg-green-500",
  "bg-purple-500": "bg-purple-500",
  "bg-orange-500": "bg-orange-500",
  "bg-cyan-500": "bg-cyan-500",
  "bg-pink-500": "bg-pink-500",
  "bg-yellow-500": "bg-yellow-500",
  "bg-red-500": "bg-red-500",
};

export default function HelpDesk() {
  const { roles } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const articleParam = searchParams.get("article");

  const allowedRoles = roles as string[];

  const visibleCategories = useMemo(
    () =>
      helpCategories.filter(
        (cat) =>
          !cat.roles || cat.roles.some((r) => allowedRoles.includes(r))
      ),
    [allowedRoles]
  );

  const [selectedCategory, setSelectedCategory] = useState<string | null>(() => {
    if (articleParam) {
      const art = helpArticles.find((a) => a.id === articleParam);
      return art?.category ?? null;
    }
    return null;
  });

  const openArticle = (id: string) => {
    const art = helpArticles.find((a) => a.id === id);
    if (art) setSelectedCategory(art.category);
    setSearchParams({ article: id });
  };

  const articlesForCategory = (categoryId: string) =>
    helpArticles.filter(
      (a) =>
        a.category === categoryId &&
        (!a.roles || a.roles.some((r) => allowedRoles.includes(r)))
    );

  const popularArticleIds = [
    "crm-overview",
    "add-affiliate",
    "add-advertiser",
    "create-distribution-rule",
    "viewing-leads",
    "add-user",
    "create-injection-job",
    "reading-reports",
  ];

  return (
    <DashboardLayout>
      {/* Full-bleed: undo DashboardLayout's padding so this page fills the viewport */}
      <div
        className="-mx-4 sm:-mx-6 lg:-mx-8 flex overflow-hidden"
        style={{ marginTop: "calc(-2rem)", height: "calc(100vh - 4rem)" }}
      >

        {/* ── Left Panel ─────────────────────────────────────── */}
        <aside className="hidden md:flex flex-col w-64 xl:w-72 border-r bg-card flex-shrink-0 overflow-y-auto">
          {/* Branding */}
          <div className="px-4 py-4 border-b">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
                <BookOpen className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <p className="font-semibold text-sm">Help & Guides</p>
                <p className="text-xs text-muted-foreground">CRM documentation</p>
              </div>
            </div>
            <HelpSearch onSelect={openArticle} allowedRoles={allowedRoles} />
          </div>

          {/* Nav */}
          <nav className="flex-1 p-2">
            {/* Home / Popular */}
            <button
              onClick={() => { setSearchParams({}); setSelectedCategory(null); }}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-1",
                !articleParam && !selectedCategory
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Rocket className="h-4 w-4 flex-shrink-0" />
              Getting Started
            </button>

            <p className="px-3 pt-3 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Categories
            </p>

            {visibleCategories
              .filter((c) => c.id !== "getting-started")
              .map((cat) => {
                const count = articlesForCategory(cat.id).length;
                if (count === 0) return null;
                const Icon = iconMap[cat.icon] ?? Rocket;
                const isActive = selectedCategory === cat.id;
                return (
                  <div key={cat.id}>
                    <button
                      onClick={() => {
                        setSelectedCategory(isActive ? null : cat.id);
                        setSearchParams({});
                      }}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                        isActive
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      <span className="flex-1 text-left">{cat.title}</span>
                      <span className="text-xs text-muted-foreground">{count}</span>
                      <ChevronRight
                        className={cn(
                          "h-3 w-3 transition-transform",
                          isActive && "rotate-90"
                        )}
                      />
                    </button>

                    {/* Articles under this category */}
                    {isActive && (
                      <div className="ml-4 mt-0.5 mb-1 space-y-0.5 border-l pl-3">
                        {articlesForCategory(cat.id).map((article) => (
                          <button
                            key={article.id}
                            onClick={() => openArticle(article.id)}
                            className={cn(
                              "w-full text-left px-2 py-1.5 rounded text-xs transition-colors",
                              articleParam === article.id
                                ? "text-primary font-semibold bg-primary/10"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            )}
                          >
                            {article.title}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
          </nav>
        </aside>

        {/* ── Right Panel ────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto bg-background">
          {articleParam ? (
            <div className="p-6 lg:p-10">
              <HelpArticle
                articleId={articleParam}
                onBack={() => {
                  setSearchParams({});
                }}
                onNavigate={openArticle}
              />
            </div>
          ) : (
            <div className="p-6 lg:p-10 space-y-10">

              {/* Hero */}
              <div className="rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border p-8">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
                    <BookOpen className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <h1 className="text-2xl font-bold">How can we help you?</h1>
                </div>
                <p className="text-muted-foreground mb-6 max-w-lg">
                  Step-by-step guides for every part of the CRM — from adding your first affiliate to setting up distribution rules.
                </p>
                <div className="md:hidden">
                  <HelpSearch onSelect={openArticle} allowedRoles={allowedRoles} />
                </div>
              </div>

              {/* Category grid */}
              <div>
                <h2 className="text-base font-semibold mb-4">Browse by Category</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {visibleCategories.map((cat) => {
                    const count = articlesForCategory(cat.id).length;
                    if (count === 0) return null;
                    const Icon = iconMap[cat.icon] ?? Rocket;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className="group text-left p-4 rounded-xl border bg-card hover:shadow-md hover:-translate-y-0.5 hover:border-primary/30 transition-all"
                      >
                        <div
                          className={cn(
                            "w-9 h-9 rounded-lg flex items-center justify-center mb-3",
                            colorMap[cat.color] ?? "bg-primary"
                          )}
                        >
                          <Icon className="h-4 w-4 text-white" />
                        </div>
                        <p className="font-semibold text-sm group-hover:text-primary transition-colors">
                          {cat.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {count} {count === 1 ? "guide" : "guides"}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Popular guides */}
              <div>
                <h2 className="text-base font-semibold mb-4">Popular Guides</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {popularArticleIds
                    .map((id) => helpArticles.find((a) => a.id === id))
                    .filter(
                      (a) =>
                        a &&
                        (!a.roles || a.roles.some((r) => allowedRoles.includes(r)))
                    )
                    .map((article) =>
                      article ? (
                        <button
                          key={article.id}
                          onClick={() => openArticle(article.id)}
                          className="group text-left flex items-start gap-3 p-4 rounded-xl border bg-card hover:bg-muted hover:border-primary/30 transition-all"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm group-hover:text-primary transition-colors">
                              {article.title}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {article.description}
                            </p>
                          </div>
                          <Badge variant="secondary" className="text-xs flex-shrink-0 mt-0.5">
                            {article.steps.length} steps
                          </Badge>
                        </button>
                      ) : null
                    )}
                </div>
              </div>

              {/* Category article lists when one is selected from left nav */}
              {selectedCategory && (
                <div>
                  <h2 className="text-base font-semibold mb-4">
                    {helpCategories.find((c) => c.id === selectedCategory)?.title}
                  </h2>
                  <div className="space-y-2">
                    {articlesForCategory(selectedCategory).map((article) => (
                      <button
                        key={article.id}
                        onClick={() => openArticle(article.id)}
                        className="group w-full text-left flex items-start gap-3 p-4 rounded-xl border bg-card hover:bg-muted hover:border-primary/30 transition-all"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm group-hover:text-primary transition-colors">
                            {article.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {article.description}
                          </p>
                        </div>
                        <Badge variant="secondary" className="text-xs flex-shrink-0 mt-0.5">
                          {article.steps.length} steps
                        </Badge>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </DashboardLayout>
  );
}
