import { useSystemSettings } from "./useSystemSettings";

export function useRestrictedCountries() {
  const { data } = useSystemSettings();
  const restricted: string[] = data?.restricted_countries ?? [];

  return {
    restrictedCountries: restricted,
    isRestricted: (code: string) => restricted.includes(code),
    filterCountries: <T extends { code: string }>(list: T[]): T[] =>
      restricted.length === 0 ? list : list.filter(c => !restricted.includes(c.code)),
  };
}
