/** Small formatting helpers shared by the system/settings admin screens. */

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat("en-IN").format(value);
}

export function humanize(value: string): string {
  return value.replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

/** Laravel returns an empty JSON array for empty PHP arrays; normalise to a record. */
export function asRecord<T>(value: Record<string, T> | T[] | null | undefined): Record<string, T> {
  if (!value || Array.isArray(value)) return {};
  return value;
}
