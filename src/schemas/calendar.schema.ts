import z from "zod";

const dateOnly = z.iso.date("Use the YYYY-MM-DD date format");
const isoInstant = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid date and time");

const isValidTimeZone = (timeZone: string) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone });
    return true;
  } catch {
    return false;
  }
};

export const calendarEventSchema = z
  .object({
    summary: z.string().trim().min(1, "Title is required").max(300, "Title is too long"),
    description: z.string().max(8000, "Description is too long").optional(),
    colorId: z.string().regex(/^(1[01]|[1-9])$/, "Invalid color").optional(),
    timeZone: z.string().max(64).refine(isValidTimeZone, "Unknown time zone").optional(),
    allDay: z.boolean().optional(),
    startDateTime: z.string().optional(),
    endDateTime: z.string().optional(),
    startDate: dateOnly.optional(),
    endDate: dateOnly.optional(),
  })
  .superRefine((event, ctx) => {
    if (event.allDay) {
      if (!event.startDate || !event.endDate) {
        ctx.addIssue({ code: "custom", message: "Start and end dates are required" });
      } else if (event.endDate < event.startDate) {
        ctx.addIssue({ code: "custom", message: "End date can't be before the start date" });
      }
      return;
    }

    const start = event.startDateTime ? Date.parse(event.startDateTime) : NaN;
    const end = event.endDateTime ? Date.parse(event.endDateTime) : NaN;

    if (Number.isNaN(start) || Number.isNaN(end)) {
      ctx.addIssue({ code: "custom", message: "Start and end date and time are required" });
    } else if (end <= start) {
      ctx.addIssue({ code: "custom", message: "The event must end after it starts" });
    }
  });

// не больше ~13 месяцев за один запрос
const MAX_RANGE_MS = 400 * 24 * 60 * 60 * 1000;

export const calendarRangeQuerySchema = z
  .object({
    timeMin: isoInstant.optional(),
    timeMax: isoInstant.optional(),
  })
  .refine(
    (range) =>
      !range.timeMin ||
      !range.timeMax ||
      (Date.parse(range.timeMax) > Date.parse(range.timeMin) &&
        Date.parse(range.timeMax) - Date.parse(range.timeMin) <= MAX_RANGE_MS),
    "Invalid date range",
  );
