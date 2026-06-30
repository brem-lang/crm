import { useState, useEffect, useRef } from "react";
import { useCRMSettings } from "./useCRMSettings";

/**
 * Initializes page size from the CRM default and syncs it once when the DB
 * value loads (in case the query was still pending at mount time).
 * After the user manually changes the size, the DB default is no longer applied.
 */
export function usePageSizeState(): [number, (size: number) => void] {
  const { defaultPageSize } = useCRMSettings();
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const userOverridden = useRef(false);

  useEffect(() => {
    if (!userOverridden.current) {
      setPageSize(defaultPageSize);
    }
  }, [defaultPageSize]);

  const handleSet = (size: number) => {
    userOverridden.current = true;
    setPageSize(size);
  };

  return [pageSize, handleSet];
}
