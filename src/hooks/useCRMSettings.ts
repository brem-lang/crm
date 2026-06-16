import { useCallback } from "react";
import { format, toZonedTime, fromZonedTime } from "date-fns-tz";
import {
  startOfDay as dateFnsStartOfDay,
  endOfDay as dateFnsEndOfDay,
  startOfWeek as dateFnsStartOfWeek,
  endOfWeek as dateFnsEndOfWeek,
  startOfMonth as dateFnsStartOfMonth,
  endOfMonth as dateFnsEndOfMonth,
  subDays as dateFnsSubDays,
  subWeeks as dateFnsSubWeeks,
  subMonths as dateFnsSubMonths,
} from "date-fns";
import { useSystemSettings, SYSTEM_SETTINGS_DEFAULTS } from "./useSystemSettings";

export const SETTINGS_STORAGE_KEY = "crm-settings";

export interface CRMSettings {
  defaultPageSize: number;
  showLeadId: boolean;
  compactMode: boolean;
  autoRefreshInterval: number;
  dateFormat: string;
  timezone: string;
  crmName: string;
}

export const DEFAULT_SETTINGS: CRMSettings = {
  defaultPageSize: SYSTEM_SETTINGS_DEFAULTS.default_page_size,
  showLeadId: SYSTEM_SETTINGS_DEFAULTS.show_lead_id,
  compactMode: SYSTEM_SETTINGS_DEFAULTS.compact_mode,
  autoRefreshInterval: SYSTEM_SETTINGS_DEFAULTS.auto_refresh_interval,
  dateFormat: SYSTEM_SETTINGS_DEFAULTS.date_format,
  timezone: SYSTEM_SETTINGS_DEFAULTS.timezone,
  crmName: SYSTEM_SETTINGS_DEFAULTS.crm_name,
};

export function useCRMSettings() {
  const { data: dbSettings } = useSystemSettings();

  // Merge DB values over defaults — DB is authoritative when available
  const settings: CRMSettings = {
    defaultPageSize: dbSettings?.default_page_size ?? DEFAULT_SETTINGS.defaultPageSize,
    showLeadId: dbSettings?.show_lead_id ?? DEFAULT_SETTINGS.showLeadId,
    compactMode: dbSettings?.compact_mode ?? DEFAULT_SETTINGS.compactMode,
    autoRefreshInterval: dbSettings?.auto_refresh_interval ?? DEFAULT_SETTINGS.autoRefreshInterval,
    dateFormat: dbSettings?.date_format ?? DEFAULT_SETTINGS.dateFormat,
    timezone: dbSettings?.timezone ?? DEFAULT_SETTINGS.timezone,
    crmName: dbSettings?.crm_name ?? DEFAULT_SETTINGS.crmName,
  };

  // Format a date using the configured format and timezone
  const formatDate = useCallback(
    (date: Date | string, customFormat?: string) => {
      const dateObj = typeof date === "string" ? new Date(date) : date;
      const zonedDate = toZonedTime(dateObj, settings.timezone);
      return format(zonedDate, customFormat || settings.dateFormat, {
        timeZone: settings.timezone,
      });
    },
    [settings.dateFormat, settings.timezone]
  );

  // Format date only (no time)
  const formatDateOnly = useCallback(
    (date: Date | string) => {
      const dateObj = typeof date === "string" ? new Date(date) : date;
      const zonedDate = toZonedTime(dateObj, settings.timezone);
      return format(zonedDate, "MMM d, yyyy", { timeZone: settings.timezone });
    },
    [settings.timezone]
  );

  // ======== TIMEZONE-AWARE DATE HELPERS ========
  // These functions calculate date boundaries based on the configured timezone

  // Get current time in configured timezone
  const getNow = useCallback(() => {
    return new Date();
  }, []);

  // Get start of day in configured timezone
  const getStartOfDay = useCallback(
    (date: Date) => {
      // Convert to zoned time to see what day it is in configured timezone
      const zonedDate = toZonedTime(date, settings.timezone);
      // Get start of that day in the zoned time
      const startOfDayZoned = dateFnsStartOfDay(zonedDate);
      // Convert back to UTC
      return fromZonedTime(startOfDayZoned, settings.timezone);
    },
    [settings.timezone]
  );

  // Get end of day in configured timezone
  const getEndOfDay = useCallback(
    (date: Date) => {
      const zonedDate = toZonedTime(date, settings.timezone);
      const endOfDayZoned = dateFnsEndOfDay(zonedDate);
      return fromZonedTime(endOfDayZoned, settings.timezone);
    },
    [settings.timezone]
  );

  // Get start of week in configured timezone (Monday as first day)
  const getStartOfWeek = useCallback(
    (date: Date) => {
      const zonedDate = toZonedTime(date, settings.timezone);
      const startOfWeekZoned = dateFnsStartOfWeek(zonedDate, { weekStartsOn: 1 });
      return fromZonedTime(startOfWeekZoned, settings.timezone);
    },
    [settings.timezone]
  );

  // Get end of week in configured timezone (Sunday as last day)
  const getEndOfWeek = useCallback(
    (date: Date) => {
      const zonedDate = toZonedTime(date, settings.timezone);
      const endOfWeekZoned = dateFnsEndOfWeek(zonedDate, { weekStartsOn: 1 });
      return fromZonedTime(endOfWeekZoned, settings.timezone);
    },
    [settings.timezone]
  );

  // Get start of month in configured timezone
  const getStartOfMonth = useCallback(
    (date: Date) => {
      const zonedDate = toZonedTime(date, settings.timezone);
      const startOfMonthZoned = dateFnsStartOfMonth(zonedDate);
      return fromZonedTime(startOfMonthZoned, settings.timezone);
    },
    [settings.timezone]
  );

  // Get end of month in configured timezone
  const getEndOfMonth = useCallback(
    (date: Date) => {
      const zonedDate = toZonedTime(date, settings.timezone);
      const endOfMonthZoned = dateFnsEndOfMonth(zonedDate);
      return fromZonedTime(endOfMonthZoned, settings.timezone);
    },
    [settings.timezone]
  );

  // Subtract days while respecting timezone
  const tzSubDays = useCallback(
    (date: Date, days: number) => {
      const zonedDate = toZonedTime(date, settings.timezone);
      const result = dateFnsSubDays(zonedDate, days);
      return fromZonedTime(result, settings.timezone);
    },
    [settings.timezone]
  );

  // Subtract weeks while respecting timezone
  const tzSubWeeks = useCallback(
    (date: Date, weeks: number) => {
      const zonedDate = toZonedTime(date, settings.timezone);
      const result = dateFnsSubWeeks(zonedDate, weeks);
      return fromZonedTime(result, settings.timezone);
    },
    [settings.timezone]
  );

  // Subtract months while respecting timezone
  const tzSubMonths = useCallback(
    (date: Date, months: number) => {
      const zonedDate = toZonedTime(date, settings.timezone);
      const result = dateFnsSubMonths(zonedDate, months);
      return fromZonedTime(result, settings.timezone);
    },
    [settings.timezone]
  );

  return {
    settings,
    formatDate,
    formatDateOnly,
    defaultPageSize: settings.defaultPageSize,
    showLeadId: settings.showLeadId,
    compactMode: settings.compactMode,
    autoRefreshInterval: settings.autoRefreshInterval,
    dateFormat: settings.dateFormat,
    timezone: settings.timezone,
    crmName: settings.crmName,
    // Timezone-aware date helpers
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
  };
}

