import { MenuItem, Pagination, Select, Stack, Typography } from "@mui/material";
import { ROWS_PER_PAGE_OPTIONS } from "../hooks/useRowsPerPage";

interface TablePagerProps {
  /** Zero-based current page. */
  page: number;
  totalPages: number;
  totalElements: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

/**
 * Footer for a paginated table: a "Rows per page" choice, the range being shown ("21–40 of 135")
 * and page buttons. Changing the page size sends the table back to its first page (the caller
 * does that in onPageSizeChange) so the current page can never fall past the end.
 */
export function TablePager({ page, totalPages, totalElements, pageSize, onPageChange, onPageSizeChange }: TablePagerProps) {
  const from = totalElements === 0 ? 0 : page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, totalElements);

  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={1}
      sx={{ justifyContent: "space-between", alignItems: "center", pt: 1.5, flexShrink: 0 }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <Typography variant="caption" color="text.secondary">
          Rows per page
        </Typography>
        <Select
          size="small"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          sx={{ fontSize: "0.75rem", "& .MuiSelect-select": { py: 0.5 } }}
          inputProps={{ "aria-label": "Rows per page" }}
        >
          {ROWS_PER_PAGE_OPTIONS.map((n) => (
            <MenuItem key={n} value={n}>
              {n}
            </MenuItem>
          ))}
        </Select>
        <Typography variant="caption" color="text.secondary">
          {from}–{to} of {totalElements}
        </Typography>
      </Stack>
      {totalPages > 1 && (
        <Pagination size="small" count={totalPages} page={page + 1} onChange={(_, next) => onPageChange(next - 1)} />
      )}
    </Stack>
  );
}
