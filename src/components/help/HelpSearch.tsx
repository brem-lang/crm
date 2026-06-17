import { useState, useMemo } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { helpArticles } from "@/data/helpArticles";

interface Props {
  onSelect: (articleId: string) => void;
  allowedRoles: string[];
}

export function HelpSearch({ onSelect, allowedRoles }: Props) {
  const [query, setQuery] = useState("");

  const visibleArticles = useMemo(
    () =>
      helpArticles.filter(
        (a) => !a.roles || a.roles.some((r) => allowedRoles.includes(r))
      ),
    [allowedRoles]
  );

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return visibleArticles.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.steps.some(
          (s) =>
            s.title.toLowerCase().includes(q) ||
            s.description.toLowerCase().includes(q)
        )
    );
  }, [query, visibleArticles]);

  return (
    <div className="relative w-full max-w-xl">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search guides… e.g. 'add advertiser', 'distribution rule'"
          className="pl-9 pr-9"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {query && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              No articles found for &ldquo;{query}&rdquo;
            </p>
          ) : (
            results.map((article) => (
              <button
                key={article.id}
                onClick={() => {
                  onSelect(article.id);
                  setQuery("");
                }}
                className="w-full text-left px-4 py-3 hover:bg-muted transition-colors border-b last:border-0"
              >
                <p className="text-sm font-medium">{article.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {article.description}
                </p>
                <Badge variant="secondary" className="mt-1 text-xs capitalize">
                  {article.category.replace(/-/g, " ")}
                </Badge>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
