import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import BlockIcon from "@mui/icons-material/Block";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import type { MasterDataItem } from "../../api/masterDataApi";
import { useCreateMasterData, useMasterData, useUpdateMasterData } from "../../api/masterDataApi";
import { parseApiError } from "../../api/errorHelpers";

/** "Budget approved" under HOT -> "HOT_BUDGET_APPROVED". The level code prefix keeps codes unique
 * (they're unique per type), so the same wording can be used under different levels. */
function reasonCode(levelCode: string, label: string): string {
  const slug = label
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `${levelCode}_${slug}`;
}

/**
 * The "why is it Hot?" reasons for one interest level, shown inline under that level's row on the
 * Interest Level tab: the existing reasons (rename, retire/restore) and a one-line add box. These
 * are the options offered when adding or editing a lead or visit, and they feed the reasons report.
 */
export function InterestReasonsPanel({ level }: { level: MasterDataItem }) {
  const { data: allReasons } = useMasterData("INTEREST_REASON", true);
  const createMutation = useCreateMasterData("INTEREST_REASON");
  const updateMutation = useUpdateMasterData("INTEREST_REASON");

  const reasons = (allReasons ?? [])
    .filter((r) => r.parentId === level.id)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));

  const [newLabel, setNewLabel] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    const label = newLabel.trim();
    if (!label) return;
    setError(null);
    try {
      await createMutation.mutateAsync({
        code: reasonCode(level.code, label),
        label,
        sortOrder: reasons.reduce((max, r) => Math.max(max, r.sortOrder), 0) + 1,
        parentId: level.id,
      });
      setNewLabel("");
    } catch (err) {
      setError(parseApiError(err).message);
    }
  };

  const save = async (reason: MasterDataItem, patch: Partial<Pick<MasterDataItem, "label" | "active">>) => {
    setError(null);
    try {
      await updateMutation.mutateAsync({
        id: reason.id,
        payload: { label: patch.label ?? reason.label, sortOrder: reason.sortOrder, active: patch.active ?? reason.active },
      });
      setEditingId(null);
    } catch (err) {
      setError(parseApiError(err).message);
    }
  };

  return (
    <Box sx={{ pl: { xs: 1, sm: 6 }, pr: 1, py: 1.5 }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: "0.05em" }}>
        WHY IS IT {level.label.toUpperCase()}? (reasons offered when adding a lead or visit)
      </Typography>

      {error && (
        <Alert severity="error" sx={{ my: 1 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Stack spacing={0.5} sx={{ mt: 1 }}>
        {reasons.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No reasons yet - add the first one below.
          </Typography>
        )}
        {reasons.map((reason) => (
          <Stack key={reason.id} direction="row" spacing={1} sx={{ alignItems: "center", minHeight: 34 }}>
            {editingId === reason.id ? (
              <>
                <TextField
                  size="small"
                  autoFocus
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && editLabel.trim()) void save(reason, { label: editLabel.trim() });
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  sx={{ flexGrow: 1, maxWidth: 360 }}
                  slotProps={{ htmlInput: { maxLength: 255 } }}
                />
                <IconButton
                  size="small"
                  color="primary"
                  disabled={!editLabel.trim() || updateMutation.isPending}
                  onClick={() => save(reason, { label: editLabel.trim() })}
                  aria-label="Save reason"
                >
                  <CheckIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" onClick={() => setEditingId(null)} aria-label="Cancel">
                  <CloseIcon fontSize="small" />
                </IconButton>
              </>
            ) : (
              <>
                <Typography
                  variant="body2"
                  sx={{ minWidth: 0, flexGrow: 1, maxWidth: 360, color: reason.active ? "text.primary" : "text.disabled" }}
                  noWrap
                >
                  {reason.label}
                </Typography>
                {!reason.active && <Chip label="Inactive" size="small" />}
                <Tooltip title="Rename">
                  <IconButton
                    size="small"
                    onClick={() => {
                      setEditingId(reason.id);
                      setEditLabel(reason.label);
                    }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title={reason.active ? "Deactivate" : "Activate"}>
                  <IconButton
                    size="small"
                    disabled={updateMutation.isPending}
                    onClick={() => save(reason, { active: !reason.active })}
                  >
                    {reason.active ? <BlockIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />}
                  </IconButton>
                </Tooltip>
              </>
            )}
          </Stack>
        ))}
      </Stack>

      <Stack direction="row" spacing={1} sx={{ mt: 1.5, alignItems: "center" }}>
        <TextField
          size="small"
          placeholder={`Add a reason for ${level.label}…`}
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void handleAdd();
            }
          }}
          sx={{ flexGrow: 1, maxWidth: 360 }}
          slotProps={{ htmlInput: { maxLength: 255 } }}
        />
        <Button
          size="small"
          variant="outlined"
          startIcon={<AddIcon />}
          disabled={!newLabel.trim() || createMutation.isPending}
          onClick={handleAdd}
        >
          Add
        </Button>
      </Stack>
    </Box>
  );
}
