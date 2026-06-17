import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { HelpSearch } from "@/components/help/HelpSearch";
import { HelpCategoryCard } from "@/components/help/HelpCategoryCard";
import { HelpArticle } from "@/components/help/HelpArticle";
import { helpArticles, helpCategories } from "@/data/helpArticles";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { BookOpen } from "lucide-react";

export default function HelpDesk() {
  const { roles } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const articleParam = searchParams.get("article");

  const allowedRoles = roles as string[];

  const visibleCategories = useMemo(
    () =>
      helpCategories.filter(
        (cat) => !cat.roles || cat.roles.some((r) => allowedRoles.includes(r))
      ),
    [allowedRoles]
  );

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const openArticle = (id: string) => {
    setSearchParams({ article: id });
    setSelectedCategory(null);
  };

  const goHome = () => {
    setSearchParams({});
    setSelectedCategory(null);
  };

  const articlesForCategory = (categoryId: string) =>
    helpArticles.filter(
      (a) =>
        a.category === categoryId &&
        (!a.roles || a.roles.some((r) => allowedRoles.includes(r)))
    );

  const categoryArticles = selectedCategory
    ? articlesForCategory(selectedCategory)
    : [];

  const selectedCategoryData = helpCategories.find(
    (c) => c.id === selectedCategory
  );

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        {!articleParam && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Help & Guides</h1>
                <p className="text-sm text-muted-foreground">
                  Step-by-step guides to help you use the CRM
                </p>
              </div>
            </div>
            <HelpSearch onSelect={openArticle} allowedRoles={allowedRoles} />
          </div>
        )}

        {/* Article view */}
        {articleParam ? (
          <HelpArticle
            articleId={articleParam}
            onBack={goHome}
            onNavigate={openArticle}
          />
        ) : selectedCategory ? (
          /* Category article list */
          <div>
            <button
              onClick={() => setSelectedCategory(null)}
              className="text-sm text-muted-foreground hover:text-foreground mb-4 flex items-center gap-1"
            >
              ← All Categories
            </button>
            <h2 className="text-xl font-semibold mb-1">
              {selectedCategoryData?.title}
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              {selectedCategoryData?.description}
            </p>
            <div className="space-y-2">
              {categoryArticles.map((article) => (
                <button
                  key={article.id}
                  onClick={() => openArticle(article.id)}
                  className="w-full text-left p-4 rounded-lg border bg-card hover:bg-muted transition-colors group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-sm group-hover:text-primary transition-colors">
                        {article.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {article.description}
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-xs flex-shrink-0">
                      {article.steps.length} steps
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Home: category grid */
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {visibleCategories.map((cat) => {
                const count = articlesForCategory(cat.id).length;
                if (count === 0) return null;
                return (
                  <HelpCategoryCard
                    key={cat.id}
                    categoryId={cat.id}
                    articleCount={count}
                    onClick={() => setSelectedCategory(cat.id)}
                  />
                );
              })}
            </div>

            {/* Popular articles */}
            <div className="mt-8">
              <h2 className="text-base font-semibold mb-3">Popular Guides</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  "add-affiliate",
                  "add-advertiser",
                  "create-distribution-rule",
                  "viewing-leads",
                  "add-user",
                  "create-injection-job",
                ]
                  .map((id) => helpArticles.find((a) => a.id === id))
                  .filter(
                    (a) =>
                      a &&
                      (!a.roles ||
                        a.roles.some((r) => allowedRoles.includes(r)))
                  )
                  .map((article) =>
                    article ? (
                      <button
                        key={article.id}
                        onClick={() => openArticle(article.id)}
                        className="text-left p-3 rounded-lg border bg-card hover:bg-muted transition-colors group"
                      >
                        <p className="text-sm font-medium group-hover:text-primary transition-colors">
                          {article.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {article.description}
                        </p>
                      </button>
                    ) : null
                  )}
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
