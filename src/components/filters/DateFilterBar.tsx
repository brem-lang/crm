import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { differenceInDays } from "date-fns";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCRMSettings } from "@/hooks/useCRMSettings";
import { TablePagination } from "@/components/ui/table-pagination";

type DatePreset = "today" | "yesterday" | "thisWeek" | "lastWeek" | "thisMonth" | "lastMonth" | "all" | "custom";

interface DateFilterBarProps {
  fromDate: Date;
  toDate: Date;
  onFromDateChange: (date: Date) => void;
  onToDateChange: (date: Date) => void;
  onShowAllChange?: (showAll: boolean) => void;
  children?: React.ReactNode;
  // Pagination props
  currentPage?: number;
  totalPages?: number;
  pageSize?: number;
  pageSizeOptions?: number[];
  totalItems?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  itemLabel?: string;
}

const datePresets: { key: DatePreset; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "thisWeek", label: "This Week" },
  { key: "lastWeek", label: "Last Week" },
  { key: "thisMonth", label: "This Month" },
  { key: "lastMonth", label: "Last Month" },
  { key: "all", label: "All" },
  { key: "custom", label: "Custom" },
];

export function DateFilterBar({
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  onShowAllChange,
  children,
  // Pagination
  currentPage = 1,
  totalPages = 1,
  pageSize = 25,
  pageSizeOptions = [5, 10, 15, 25, 50, 100, 200],
  totalItems = 0,
  onPageChange,
  onPageSizeChange,
  itemLabel = "items",
}: DateFilterBarProps) {
  const [datePreset, setDatePreset] = useState<DatePreset>("thisMonth");
  const { 
    formatDate,
    getNow,
    getStartOfDay,
    getEndOfDay,
    getStartOfWeek,
    getEndOfWeek,
    getStartOfMonth,
    getEndOfMonth,
    tzSubDays,
    tzSubWeeks,
    tzSubMonths,
  } = useCRMSettings();

  const handlePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    if (preset === "all") {
      onShowAllChange?.(true);
      return;
    }
    onShowAllChange?.(false);
    const now = getNow();

    switch (preset) {
      case "today":
        onFromDateChange(getStartOfDay(now));
        onToDateChange(getEndOfDay(now));
        break;
      case "yesterday": {
        const yesterday = tzSubDays(now, 1);
        onFromDateChange(getStartOfDay(yesterday));
        onToDateChange(getEndOfDay(yesterday));
        break;
      }
      case "thisWeek":
        onFromDateChange(getStartOfWeek(now));
        onToDateChange(getEndOfWeek(now));
        break;
      case "lastWeek": {
        const lastWeek = tzSubWeeks(now, 1);
        onFromDateChange(getStartOfWeek(lastWeek));
        onToDateChange(getEndOfWeek(lastWeek));
        break;
      }
      case "thisMonth":
        onFromDateChange(getStartOfMonth(now));
        onToDateChange(getEndOfMonth(now));
        break;
      case "lastMonth": {
        const lastMonth = tzSubMonths(now, 1);
        onFromDateChange(getStartOfMonth(lastMonth));
        onToDateChange(getEndOfMonth(lastMonth));
        break;
      }
    }
  };

  const shiftDates = (direction: "prev" | "next") => {
    const days = differenceInDays(toDate, fromDate) + 1;
    if (direction === "prev") {
      onFromDateChange(tzSubDays(fromDate, days));
      onToDateChange(tzSubDays(toDate, days));
    } else {
      onFromDateChange(tzSubDays(fromDate, -days));
      onToDateChange(tzSubDays(toDate, -days));
    }
    setDatePreset("custom");
  };

  const daysDiff = differenceInDays(toDate, fromDate) + 1;

  return (
    <div className="space-y-3">
      {/* Date bar — presets left, date range right, single row */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b overflow-x-auto">
        <div className="flex gap-1 shrink-0">
          {datePresets.map((preset) => (
            <button
              key={preset.key}
              onClick={() => handlePresetChange(preset.key)}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-none border-b-2 transition-colors whitespace-nowrap",
                datePreset === preset.key
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {datePreset !== "all" && (
          <div className="flex items-center gap-2 shrink-0 ml-auto">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
                  <CalendarIcon className="h-3 w-3" />
                  From: {formatDate(fromDate, "yyyy-MM-dd HH:mm:ss")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={fromDate}
                  onSelect={(date) => {
                    if (date) {
                      onFromDateChange(getStartOfDay(date));
                      setDatePreset("custom");
                      onShowAllChange?.(false);
                    }
                  }}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
                  <CalendarIcon className="h-3 w-3" />
                  To: {formatDate(toDate, "yyyy-MM-dd HH:mm:ss")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={toDate}
                  onSelect={(date) => {
                    if (date) {
                      onToDateChange(getEndOfDay(date));
                      setDatePreset("custom");
                      onShowAllChange?.(false);
                    }
                  }}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>

            <div className="flex items-center gap-0.5">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => shiftDates("prev")}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs text-muted-foreground min-w-[28px] text-center">{daysDiff}d</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => shiftDates("next")}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Optional additional filters row */}
      {children && (
        <div className="flex flex-wrap items-center gap-2">
          {children}
        </div>
      )}

      {/* Pagination Row */}
      {onPageChange && onPageSizeChange && (
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          pageSizeOptions={pageSizeOptions}
          totalItems={totalItems}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          itemLabel={itemLabel}
        />
      )}
    </div>
  );
}
