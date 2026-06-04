import { addDays, format, isAfter, parseISO } from "date-fns";

export function toDateInputValue(value?: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

export function formatTaiwanDate(value?: string | null) {
  if (!value) return "-";
  return format(parseISO(value), "yyyy/MM/dd");
}

export function dueDateFromNow() {
  return addDays(new Date(), 30).toISOString();
}

export function isOverdue(dueAt: string, returnedAt?: string | null) {
  return !returnedAt && isAfter(new Date(), parseISO(dueAt));
}
