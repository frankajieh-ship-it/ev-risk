/** Extract the first numeric value (hours) from a charge time notes string like "~8 hours on L2". */
export function parseChargeTimeHours(notes: string | null | undefined): number | null {
  if (!notes) return null;
  const match = notes.match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}
