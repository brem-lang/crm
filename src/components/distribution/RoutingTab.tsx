import { useState, useMemo, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GripVertical, Save, Zap, TrendingUp } from "lucide-react";
import { useDistributionSettings, useBatchUpdatePriorities } from "@/hooks/useDistributionSettings";
import { useAdvertisers } from "@/hooks/useAdvertisers";
import { useRecentDistributionStats } from "@/hooks/useRecentDistributionStats";
import { cn } from "@/lib/utils";

interface RoutingTabProps {
  highlightedAdvertiserId: string;
}

interface RowItem {
  settingId: string;
  advertiserId: string;
  name: string;
  advertiserType: string;
  advertiserActive: boolean;
  isActive: boolean;
  priority: number;
  weight: number;
}

function SortableRow({
  item,
  totalWeight,
  whatIfWeight,
  whatIfId,
  isHighlighted,
  avgDaily,
}: {
  item: RowItem;
  totalWeight: number;
  whatIfWeight: number | null;
  whatIfId: string | null;
  isHighlighted: boolean;
  avgDaily: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.settingId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  };

  const effectiveWeight = whatIfId === item.advertiserId ? (whatIfWeight ?? item.weight) : item.weight;
  const pct = totalWeight > 0 ? Math.round((effectiveWeight / totalWeight) * 100) : 0;
  const projectedLeads = Math.round((pct / 100) * avgDaily * 7);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 px-4 py-3 border-b last:border-0 bg-background transition-colors",
        isDragging && "shadow-lg opacity-90",
        isHighlighted && "bg-primary/5 border-l-2 border-l-primary",
        !item.isActive && "opacity-50"
      )}
    >
      {/* Drag handle */}
      <button
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Priority badge */}
      <Badge variant="outline" className="w-8 text-center text-xs shrink-0">
        {item.priority}
      </Badge>

      {/* Name */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn("font-medium text-sm truncate", isHighlighted && "text-primary")}>
            {item.name}
          </span>
          <Badge variant="secondary" className="text-xs hidden sm:inline-flex">
            {item.advertiserType}
          </Badge>
          {!item.advertiserActive && (
            <Badge variant="destructive" className="text-xs">Disabled</Badge>
          )}
        </div>
        {/* Weight bar */}
        <div className="mt-1.5 flex items-center gap-2">
          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                isHighlighted ? "bg-primary" : "bg-muted-foreground/40"
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground w-10 text-right">{pct}%</span>
        </div>
      </div>

      {/* Weight + stats */}
      <div className="text-right shrink-0">
        <span className="text-sm font-medium">wt {item.weight}</span>
        {avgDaily > 0 && (
          <div className="text-xs text-muted-foreground flex items-center justify-end gap-0.5 mt-0.5">
            <TrendingUp className="h-3 w-3" />
            ~{projectedLeads}/wk
          </div>
        )}
      </div>
    </div>
  );
}

export function RoutingTab({ highlightedAdvertiserId }: RoutingTabProps) {
  const { data: advertisers = [] } = useAdvertisers();
  const { data: settings = [] } = useDistributionSettings();
  const { data: avgStats = {} } = useRecentDistributionStats(7);
  const batchUpdate = useBatchUpdatePriorities();

  const [whatIfEnabled, setWhatIfEnabled] = useState(false);
  const [whatIfWeight, setWhatIfWeight] = useState<number>(100);
  const [isDirty, setIsDirty] = useState(false);

  const baseItems = useMemo<RowItem[]>(() => {
    const advertiserMap = new Map(advertisers.map(a => [a.id, a]));
    return settings
      .map(s => {
        const adv = advertiserMap.get(s.advertiser_id);
        if (!adv) return null;
        return {
          settingId: s.id,
          advertiserId: s.advertiser_id,
          name: adv.name,
          advertiserType: adv.advertiser_type,
          advertiserActive: adv.is_active,
          isActive: s.is_active,
          priority: s.priority,
          weight: s.base_weight ?? 100,
        } satisfies RowItem;
      })
      .filter(Boolean) as RowItem[];
  }, [advertisers, settings]);

  const [orderedItems, setOrderedItems] = useState<RowItem[]>([]);

  // Sync from server whenever base items change and user has no pending local edits
  useEffect(() => {
    if (!isDirty && baseItems.length > 0) {
      setOrderedItems([...baseItems].sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name)));
    }
  }, [baseItems, isDirty]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const totalWeight = useMemo(
    () => orderedItems.filter(i => i.isActive && i.advertiserActive).reduce((s, i) => s + i.weight, 0),
    [orderedItems]
  );

  const totalAvgDaily = useMemo(
    () => Object.values(avgStats).reduce((s, v) => s + v, 0),
    [avgStats]
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setOrderedItems(prev => {
      const oldIndex = prev.findIndex(i => i.settingId === active.id);
      const newIndex = prev.findIndex(i => i.settingId === over.id);
      const next = arrayMove(prev, oldIndex, newIndex);
      // Reassign sequential priorities
      return next.map((item, idx) => ({ ...item, priority: idx + 1 }));
    });
    setIsDirty(true);
  }

  function handleSave() {
    batchUpdate.mutate(
      orderedItems.map(item => ({ id: item.settingId, priority: item.priority })),
      { onSuccess: () => setIsDirty(false) }
    );
  }

  const highlightedItem = orderedItems.find(i => i.advertiserId === highlightedAdvertiserId);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Priority Order</CardTitle>
              <CardDescription>
                Drag advertisers to reorder. Lower position = higher priority. Within the same priority,
                leads are split by weight share.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {isDirty && (
                <Button size="sm" onClick={handleSave} disabled={batchUpdate.isPending}>
                  <Save className="h-4 w-4 mr-1" />
                  Save order
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
              items={orderedItems.map(i => i.settingId)}
              strategy={verticalListSortingStrategy}
            >
              <div className="rounded-b-lg border-t overflow-hidden">
                {orderedItems.map(item => (
                  <SortableRow
                    key={item.settingId}
                    item={item}
                    totalWeight={totalWeight}
                    whatIfWeight={whatIfEnabled && item.advertiserId === highlightedAdvertiserId ? whatIfWeight : null}
                    whatIfId={whatIfEnabled ? highlightedAdvertiserId : null}
                    isHighlighted={item.advertiserId === highlightedAdvertiserId}
                    avgDaily={totalAvgDaily}
                  />
                ))}
                {orderedItems.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    No advertisers configured yet.
                  </div>
                )}
              </div>
            </SortableContext>
          </DndContext>
        </CardContent>
      </Card>

      {/* What-if panel */}
      {highlightedItem && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  What-if: {highlightedItem.name}
                </CardTitle>
                <CardDescription>
                  Adjust weight and see projected share change based on last 7 days of traffic.
                </CardDescription>
              </div>
              <Switch checked={whatIfEnabled} onCheckedChange={setWhatIfEnabled} />
            </div>
          </CardHeader>

          {whatIfEnabled && (
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Weight</span>
                  <span className="font-medium">{whatIfWeight}</span>
                </div>
                <Slider
                  min={1}
                  max={1000}
                  step={1}
                  value={[whatIfWeight]}
                  onValueChange={([v]) => setWhatIfWeight(v)}
                />
              </div>

              {(() => {
                const effectiveTotal =
                  orderedItems
                    .filter(i => i.isActive && i.advertiserActive)
                    .reduce((s, i) => {
                      const w = i.advertiserId === highlightedAdvertiserId ? whatIfWeight : i.weight;
                      return s + w;
                    }, 0);
                const currentPct = totalWeight > 0
                  ? Math.round((highlightedItem.weight / totalWeight) * 100)
                  : 0;
                const whatIfPct = effectiveTotal > 0
                  ? Math.round((whatIfWeight / effectiveTotal) * 100)
                  : 0;
                const diff = whatIfPct - currentPct;
                const projectedDaily = Math.round((whatIfPct / 100) * totalAvgDaily);

                return (
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Current share</p>
                      <p className="text-xl font-bold mt-1">{currentPct}%</p>
                    </div>
                    <div className="rounded-lg border p-3 border-primary bg-primary/5">
                      <p className="text-xs text-muted-foreground">What-if share</p>
                      <p className="text-xl font-bold mt-1 text-primary">{whatIfPct}%</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Projected daily</p>
                      <p className="text-xl font-bold mt-1">
                        {projectedDaily > 0 ? `~${projectedDaily}` : "—"}
                      </p>
                    </div>
                    <div className="col-span-3 text-sm text-center">
                      {diff !== 0 && (
                        <span className={diff > 0 ? "text-green-600" : "text-red-600"}>
                          {diff > 0 ? "+" : ""}{diff}% vs current
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
