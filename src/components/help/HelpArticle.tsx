import { ArrowLeft, Lightbulb, AlertTriangle, Link } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { helpArticles, helpCategories } from "@/data/helpArticles";

interface Props {
  articleId: string;
  onBack: () => void;
  onNavigate: (articleId: string) => void;
}

export function HelpArticle({ articleId, onBack, onNavigate }: Props) {
  const article = helpArticles.find((a) => a.id === articleId);
  if (!article) return null;

  const category = helpCategories.find((c) => c.id === article.category);
  const relatedArticles = article.relatedArticles
    ?.map((id) => helpArticles.find((a) => a.id === id))
    .filter(Boolean);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Help
        </Button>
        {category && (
          <>
            <span className="text-muted-foreground">/</span>
            <span className="text-sm text-muted-foreground capitalize">
              {category.title}
            </span>
          </>
        )}
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">{article.title}</h1>
        <p className="text-muted-foreground">{article.description}</p>
      </div>

      <div className="space-y-6">
        {article.steps.map((step, index) => (
          <div key={index} className="flex gap-4">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
              {index + 1}
            </div>
            <div className="flex-1 pb-6 border-b last:border-0">
              <h3 className="font-semibold mb-1">{step.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {step.description}
              </p>
              {step.tip && (
                <div className="mt-3 flex gap-2 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <Lightbulb className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700 dark:text-blue-300">{step.tip}</p>
                </div>
              )}
              {step.warning && (
                <div className="mt-3 flex gap-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-300">{step.warning}</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {relatedArticles && relatedArticles.length > 0 && (
        <div className="mt-10 pt-6 border-t">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Link className="h-4 w-4" />
            Related Guides
          </h3>
          <div className="flex flex-wrap gap-2">
            {relatedArticles.map((rel) =>
              rel ? (
                <Button
                  key={rel.id}
                  variant="outline"
                  size="sm"
                  onClick={() => onNavigate(rel.id)}
                  className="text-xs h-8"
                >
                  {rel.title}
                </Button>
              ) : null
            )}
          </div>
        </div>
      )}
    </div>
  );
}
