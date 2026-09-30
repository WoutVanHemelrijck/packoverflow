const MONTHS: Record<string, string> = {
  januari: "january", janvier: "january", februari: "february", "février": "february", fevrier: "february",
  maart: "march", mars: "march", "avril": "april", mei: "may", mai: "may", juni: "june", juin: "june",
  juli: "july", juillet: "july", augustus: "august", "août": "august", aout: "august", septembre: "september",
  oktober: "october", octobre: "october", novembre: "november", december: "december", "décembre": "december",
};
const ENGLISH_MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MARKERS = ["%", "week", "month", "hour", "year", "pro rata", "full", "prorata"];

// Reduces a value to its numbers, month names and unit markers so "€4,000.00" matches "4000 EUR" and "20th of the month" matches "the 20th".
export function valueKey(value: string): string {
  let v = value.toLowerCase().replace(/\/\s*(km|hour|h|month|year)\b/g, "").replace(/(\d)[,.](\d{3})(?!\d)/g, "$1$2").replace(/(\d),(\d)/g, "$1.$2");
  for (const [from, to] of Object.entries(MONTHS)) v = v.replaceAll(from, to);
  const nums = (v.match(/\d+(?:\.\d+)?/g) ?? []).map((n) => String(parseFloat(n)));
  const months = ENGLISH_MONTHS.filter((m) => v.includes(m));
  const markers = MARKERS.filter((m) => v.includes(m)).map((m) => (m === "prorata" ? "pro rata" : m));
  if (markers.includes("month") && months.length) markers.splice(markers.indexOf("month"), 1);
  return [...nums, ...months, ...new Set(markers)].sort().join("|");
}

export const squash = (s: string) => s.toLowerCase().replace(/\s+/g, " ").replace(/[’‘]/g, "'").trim();
