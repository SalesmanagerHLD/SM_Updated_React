import { useCallback, useState } from "react";

export const ROWS_PER_PAGE_OPTIONS = [10, 20, 50, 100] as const;
const STORAGE_KEY = "rowsPerPage";
const DEFAULT_ROWS = 20;

function read(): number {
  try {
    const stored = Number(window.localStorage.getItem(STORAGE_KEY));
    return (ROWS_PER_PAGE_OPTIONS as readonly number[]).includes(stored) ? stored : DEFAULT_ROWS;
  } catch {
    return DEFAULT_ROWS;
  }
}

/** How many rows a list page shows. One choice shared by every list and remembered between visits
 * (it falls back to 20 if browser storage isn't available). */
export function useRowsPerPage(): [number, (rows: number) => void] {
  const [rows, setRows] = useState<number>(read);
  const update = useCallback((next: number) => {
    setRows(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // Storage unavailable (private window, blocked) - the choice just won't be remembered.
    }
  }, []);
  return [rows, update];
}
