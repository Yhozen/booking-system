import { addDays as addDaysDateFns, differenceInCalendarDays } from "date-fns";

export const addDays = (value: Date, days: number) =>
  addDaysDateFns(value, days);

export const getCalendarDayOffset = (start: Date, value: Date) =>
  differenceInCalendarDays(value, start);
