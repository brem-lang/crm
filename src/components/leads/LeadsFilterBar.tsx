import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { MultiSelect } from "@/components/ui/multi-select";
import { TablePagination } from "@/components/ui/table-pagination";
import { useCRMSettings } from "@/hooks/useCRMSettings";
import { cn } from "@/lib/utils";
import { differenceInDays } from "date-fns";
import { CalendarIcon, ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { useState } from "react";

type DatePreset =
  | "today"
  | "yesterday"
  | "thisWeek"
  | "lastWeek"
  | "thisMonth"
  | "lastMonth"
  | "all"
  | "custom";

interface LeadsFilterBarProps {
  fromDate: Date;
  toDate: Date;
  onFromDateChange: (date: Date) => void;
  onToDateChange: (date: Date) => void;
  advertiserFilter: string;
  onAdvertiserFilterChange: (value: string) => void;
  countryFilter: string;
  onCountryFilterChange: (value: string) => void;
  affiliateFilter: string;
  onAffiliateFilterChange: (value: string) => void;
  freeSearch: string;
  onFreeSearchChange: (value: string) => void;
  saleStatusFilter: string[];
  onSaleStatusFilterChange: (value: string[]) => void;
  liveLeadStatusFilter?: string;
  onLiveLeadStatusFilterChange?: (value: string) => void;
  advertisers?: { id: string; name: string }[];
  affiliates?: { id: string; name: string }[];
  countries?: string[];
  saleStatuses?: string[];
  children?: React.ReactNode;
  // Pagination props
  currentPage?: number;
  totalPages?: number;
  pageSize?: number;
  pageSizeOptions?: number[];
  totalItems?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  onShowAllDates?: () => void;
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

export function LeadsFilterBar({
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  advertiserFilter,
  onAdvertiserFilterChange,
  countryFilter,
  onCountryFilterChange,
  affiliateFilter,
  onAffiliateFilterChange,
  freeSearch,
  onFreeSearchChange,
  saleStatusFilter,
  onSaleStatusFilterChange,
  liveLeadStatusFilter = "all",
  onLiveLeadStatusFilterChange,
  advertisers = [],
  affiliates = [],
  countries = [],
  saleStatuses = [],
  children,
  // Pagination
  currentPage = 1,
  totalPages = 1,
  pageSize = 25,
  pageSizeOptions = [5, 10, 15, 25, 50, 100, 200],
  totalItems = 0,
  onPageChange,
  onPageSizeChange,
  onShowAllDates,
}: LeadsFilterBarProps) {
  const [datePreset, setDatePreset] = useState<DatePreset>("today");
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
      case "all":
        onShowAllDates?.();
        break;
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

  // Convert sale statuses to options format
  const saleStatusOptions = saleStatuses.map((status) => ({
    value: status,
    label: status,
  }));

  return (
    <div className="space-y-3">
      {/* Date bar — presets left, date range right, single row */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b overflow-x-auto">
        {/* Preset tabs */}
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

        {/* Date range inputs + nav */}
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
      </div>

      {/* Filters Row */}
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
        <SearchableSelect
          value={advertiserFilter}
          onValueChange={onAdvertiserFilterChange}
          options={advertisers.map((adv) => ({
            value: adv.id,
            label: adv.name,
          }))}
          placeholder="All Advertisers"
          searchPlaceholder="Search advertiser..."
          emptyMessage="No advertisers found"
          className="w-full sm:w-[160px]"
        />

        <SearchableSelect
          value={countryFilter}
          onValueChange={onCountryFilterChange}
          options={countries.map((code) => ({ value: code, label: code }))}
          placeholder="All Countries"
          searchPlaceholder="Search country..."
          emptyMessage="No countries found"
          className="w-full sm:w-[140px]"
        />

        <SearchableSelect
          value={affiliateFilter}
          onValueChange={onAffiliateFilterChange}
          options={affiliates.map((aff) => ({
            value: aff.id,
            label: aff.name,
          }))}
          placeholder="All Affiliates"
          searchPlaceholder="Search affiliate..."
          emptyMessage="No affiliates found"
          className="w-full sm:w-[160px]"
        />


        <MultiSelect
          options={saleStatusOptions}
          selected={saleStatusFilter}
          onChange={onSaleStatusFilterChange}
          placeholder="All Sale Status"
          searchPlaceholder="Search status..."
          emptyMessage="No statuses found"
          className="col-span-2 sm:col-span-1 w-full sm:w-[170px]"
          icon={<Filter className="h-3.5 w-3.5 text-muted-foreground" />}
        />

        {onLiveLeadStatusFilterChange && (
          <SearchableSelect
            value={liveLeadStatusFilter}
            onValueChange={onLiveLeadStatusFilterChange}
            options={[
              { value: "green",     label: "🟢 Green" },
              { value: "orange",    label: "🟡 Orange" },
              { value: "light-red", label: "🟠 Light Red" },
              { value: "red",       label: "🔴 Red" },
            ]}
            placeholder="All Live Lead"
            searchPlaceholder="Search..."
            emptyMessage="No results found"
            className="w-full sm:w-[150px]"
          />
        )}

        {children}
      </div>

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
          itemLabel="leads"
          extra={
            <Input
              placeholder="Search ID, email, phone, IP..."
              value={freeSearch}
              onChange={(e) => onFreeSearchChange(e.target.value)}
              className="w-full sm:w-64 h-8 ml-0 sm:ml-2"
            />
          }
        />
      )}
    </div>
  );
}
