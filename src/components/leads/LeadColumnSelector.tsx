import { DndContext, closestCenter, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Settings2, GripVertical } from "lucide-react";

export interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
}

interface LeadColumnSelectorProps {
  columns: ColumnConfig[];
  onToggle: (columnId: string) => void;
  onReorder: (newColumns: ColumnConfig[]) => void;
  isSuperAdmin: boolean;
}

interface SortableColumnItemProps {
  col: ColumnConfig;
  onToggle: (id: string) => void;
  isSuperAdmin: boolean;
}

function SortableColumnItem({ col, onToggle, isSuperAdmin }: SortableColumnItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: col.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded px-1 py-1 hover:bg-muted/50"
    >
      {isSuperAdmin && (
        <span
          {...attributes}
          {...listeners}
          className="cursor-grab text-muted-foreground hover:text-foreground touch-none"
          title="Drag to reorder"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </span>
      )}
      <Checkbox
        id={col.id}
        checked={col.visible}
        onCheckedChange={() => onToggle(col.id)}
      />
      <label htmlFor={col.id} className="text-sm cursor-pointer flex-1 select-none">
        {col.label}
      </label>
    </div>
  );
}

export function LeadColumnSelector({ columns, onToggle, onReorder, isSuperAdmin }: LeadColumnSelectorProps) {
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = columns.findIndex(c => c.id === active.id);
    const newIndex = columns.findIndex(c => c.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      onReorder(arrayMove(columns, oldIndex, newIndex));
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="h-4 w-4 mr-2" />
          Columns
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Toggle Columns</span>
          {isSuperAdmin && (
            <span className="text-xs text-muted-foreground font-normal">Drag to reorder for everyone</span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-64 overflow-y-auto p-1">
          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={columns.map(c => c.id)} strategy={verticalListSortingStrategy}>
              {columns.map((col) => (
                <SortableColumnItem
                  key={col.id}
                  col={col}
                  onToggle={onToggle}
                  isSuperAdmin={isSuperAdmin}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
