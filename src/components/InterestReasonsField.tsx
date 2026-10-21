import { useEffect, useMemo } from "react";
import { Autocomplete, TextField } from "@mui/material";
import { useMasterData } from "../api/masterDataApi";

interface InterestReasonsFieldProps {
  /** The selected interest level (INTEREST_LEVEL master id); nothing is shown without one. */
  interestLevelId: string | null;
  /** Selected INTEREST_REASON ids. */
  value: string[];
  onChange: (ids: string[]) => void;
}

/**
 * "Why is it Hot?" - a multi-select of the admin-defined reasons for the chosen interest level
 * (Masters > Interest Reason). Renders nothing until a level is chosen and that level has
 * reasons. Selecting a different level drops reasons that belonged to the old one, so a lead can
 * never carry a reason for a level it no longer has.
 */
export function InterestReasonsField({ interestLevelId, value, onChange }: InterestReasonsFieldProps) {
  // Includes inactive rows so a reason an admin has since retired still shows on records that
  // already carry it; only active ones are offered as new choices.
  const { data: reasons } = useMasterData("INTEREST_REASON", true);
  const { data: levels } = useMasterData("INTEREST_LEVEL", true);

  const levelReasons = useMemo(
    () => (reasons ?? []).filter((r) => r.parentId === interestLevelId),
    [reasons, interestLevelId],
  );
  const options = useMemo(
    () => levelReasons.filter((r) => r.active || value.includes(r.id)),
    [levelReasons, value],
  );
  const levelLabel = (levels ?? []).find((l) => l.id === interestLevelId)?.label;

  // Drop any selected reason that doesn't belong to the current level (level was changed).
  useEffect(() => {
    if (!reasons) return;
    const valid = value.filter((id) => levelReasons.some((r) => r.id === id));
    if (valid.length !== value.length) onChange(valid);
  }, [reasons, levelReasons, value, onChange]);

  if (!interestLevelId || options.length === 0) return null;

  return (
    <Autocomplete
      multiple
      disableCloseOnSelect
      options={options}
      getOptionLabel={(option) => option.label}
      isOptionEqualToValue={(option, selected) => option.id === selected.id}
      value={options.filter((o) => value.includes(o.id))}
      onChange={(_, selected) => onChange(selected.map((s) => s.id))}
      slotProps={{ chip: { size: "small" } }}
      renderInput={(params) => (
        <TextField {...params} label={levelLabel ? `Why is it ${levelLabel}?` : "Reasons"} placeholder="Select reasons" />
      )}
    />
  );
}
