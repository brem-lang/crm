import {
  Rocket,
  Users,
  Building2,
  Target,
  GitMerge,
  Syringe,
  BarChart3,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { helpCategories } from "@/data/helpArticles";

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

interface Props {
  categoryId: string;
  articleCount: number;
  onClick: () => void;
}

export function HelpCategoryCard({ categoryId, articleCount, onClick }: Props) {
  const cat = helpCategories.find((c) => c.id === categoryId);
  if (!cat) return null;

  const Icon = iconMap[cat.icon] ?? Rocket;

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5 border-2 hover:border-primary/30"
      onClick={onClick}
    >
      <CardContent className="p-5 flex flex-col gap-3">
        <div
          className={`w-10 h-10 rounded-lg ${cat.color} flex items-center justify-center flex-shrink-0`}
        >
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div>
          <h3 className="font-semibold text-sm">{cat.title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{cat.description}</p>
        </div>
        <p className="text-xs text-muted-foreground">
          {articleCount} {articleCount === 1 ? "guide" : "guides"}
        </p>
      </CardContent>
    </Card>
  );
}
