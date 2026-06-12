import * as React from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export interface MultiSelectOption {
  value: string;
  label: string;
  badgeLabel?: string; // short label shown in badge; defaults to value
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  icon?: React.ReactNode;
  showBadges?: boolean;
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyMessage = "No results found.",
  className,
  icon,
  showBadges = false,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const handleRemoveBadge = (e: React.MouseEvent, value: string) => {
    e.stopPropagation();
    onChange(selected.filter((v) => v !== value));
  };

  const displayText = React.useMemo(() => {
    if (selected.length === 0) return placeholder;
    if (selected.length === 1) {
      const option = options.find((o) => o.value === selected[0]);
      return option?.label || selected[0];
    }
    return `${selected.length} selected`;
  }, [selected, options, placeholder]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "justify-between font-normal",
            showBadges && selected.length >= 1 ? "h-auto min-h-9 py-1.5" : "h-9",
            className
          )}
        >
          {showBadges && selected.length >= 1 ? (
            <div className="flex flex-wrap gap-1.5 flex-1 mr-2">
              {selected.map((val) => {
                const opt = options.find((o) => o.value === val);
                const display = opt?.badgeLabel ?? val;
                return (
                <Badge
                  key={val}
                  variant="secondary"
                  className="h-5 px-1.5 text-xs rounded-sm font-mono max-w-[100px] truncate"
                >
                  {display}
                  <span
                    className="ml-1 cursor-pointer hover:text-destructive"
                    onClick={(e) => handleRemoveBadge(e, val)}
                  >
                    <X className="h-2.5 w-2.5 inline" />
                  </span>
                </Badge>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center gap-2 truncate">
              {icon}
              <span className="truncate">{displayText}</span>
            </div>
          )}
          <div className="flex items-center gap-1 ml-2 shrink-0">
            {selected.length > 0 && (
              <Badge
                variant="secondary"
                className="h-5 px-1.5 text-xs rounded-sm cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                onClick={handleClear}
              >
                <X className="h-3 w-3" />
              </Badge>
            )}
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0 bg-popover" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => handleSelect(option.value)}
                >
                  <div
                    className={cn(
                      "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                      selected.includes(option.value)
                        ? "bg-primary text-primary-foreground"
                        : "opacity-50 [&_svg]:invisible"
                    )}
                  >
                    <Check className="h-3 w-3" />
                  </div>
                  <span>{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
