import type { ReactNode } from "react";
import { Box } from "@mui/material";

/**
 * Page shell for list pages: on desktop it fills the space under the top bar exactly, so the page
 * itself never scrolls and only the table does (the table's header stays put while its rows
 * scroll). Toolbar, filters and the pager keep their natural height around it. Below the desktop
 * breakpoint it is a plain block and the layout's own scroll area takes over, because phones show
 * these lists as cards, not a table.
 */
export function PageFill({ children, nested = false }: { children: ReactNode; nested?: boolean }) {
  return (
    <Box
      sx={(theme) => ({
        [theme.breakpoints.up("md")]: {
          // A page fills its scroll area; a block nested inside a page's own fill chain takes
          // whatever room is left instead.
          ...(nested ? { flex: "1 1 0" } : { height: "100%" }),
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          "& > .MuiTableContainer-root": { flex: "1 1 0", minHeight: 0, overflow: "auto" },
        },
      })}
    >
      {children}
    </Box>
  );
}
