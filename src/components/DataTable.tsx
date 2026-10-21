import type { ReactNode } from "react";
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";

export interface DataColumn<T> {
  label: string;
  align?: "left" | "right" | "center";
  render: (row: T) => ReactNode;
  /** Fixed width, e.g. 90 or "20%". */
  width?: number | string;
}

interface DataTableProps<T> {
  columns: DataColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyText?: string;
}

/** Compact report table in the dashboard's style: small uppercase column labels, tight rows,
 * frozen header (the theme makes every table's header sticky and opaque), optional row click. */
export function DataTable<T>({ columns, rows, rowKey, onRowClick, emptyText = "No data yet." }: DataTableProps<T>) {
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            {columns.map((col) => (
              <TableCell
                key={col.label}
                align={col.align}
                sx={{
                  width: col.width,
                  whiteSpace: "nowrap",
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  color: "text.secondary",
                }}
              >
                {col.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={columns.length} align="center">
                <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                  {emptyText}
                </Typography>
              </TableCell>
            </TableRow>
          )}
          {rows.map((row) => (
            <TableRow
              key={rowKey(row)}
              hover
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              sx={onRowClick ? { cursor: "pointer" } : undefined}
            >
              {columns.map((col) => (
                <TableCell key={col.label} align={col.align}>
                  {col.render(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
