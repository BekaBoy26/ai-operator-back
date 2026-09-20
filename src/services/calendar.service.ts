import { google } from "googleapis";
import { withGoogle } from "./google.service";

export interface ICalendarRange {
  timeMin: string;
  timeMax: string;
}

export interface ICalendarEventInput {
  summary: string;
  description?: string | undefined;
  colorId?: string | undefined;
  timeZone?: string | undefined;
  allDay?: boolean | undefined;
  startDateTime?: string | undefined;
  endDateTime?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
}

const EVENT_FIELDS =
  "id,summary,description,start,end,colorId,htmlLink,status,recurringEventId";
const MAX_PAGES = 8;

// в Google конец событий "на весь день" эксклюзивный (+1 день)
const addDays = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

// по умолчанию — текущий месяц
export const currentMonthRange = (): ICalendarRange => {
  const now = new Date();
  return {
    timeMin: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
    timeMax: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString(),
  };
};

export const getCalendarEvents = (userId: number, range?: Partial<ICalendarRange>) =>
  withGoogle(userId, async (auth) => {
    const calendar = google.calendar({ version: "v3", auth });
    const { timeMin, timeMax } = { ...currentMonthRange(), ...range };
    const events = [];
    let pageToken: string | undefined;

    // диапазон месяца, все страницы: раньше брали 100 событий от 1-го числа
    for (let page = 0; page < MAX_PAGES; page++) {
      const result = await calendar.events.list({
        calendarId: "primary",
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: "startTime",
        maxResults: 250,
        fields: `nextPageToken,items(${EVENT_FIELDS})`,
        ...(pageToken ? { pageToken } : {}),
      });

      events.push(...(result.data.items ?? []));
      pageToken = result.data.nextPageToken ?? undefined;
      if (!pageToken) break;
    }

    return events.filter((event) => event.status !== "cancelled");
  });

const toRequestBody = (event: ICalendarEventInput, isPatch: boolean) => {
  const tz = event.timeZone || "UTC";

  const when = event.allDay
    ? {
        start: { date: event.startDate!, ...(isPatch ? { dateTime: null } : {}) },
        end: { date: addDays(event.endDate!, 1), ...(isPatch ? { dateTime: null } : {}) },
      }
    : {
        start: { dateTime: event.startDateTime!, timeZone: tz, ...(isPatch ? { date: null } : {}) },
        end: { dateTime: event.endDateTime!, timeZone: tz, ...(isPatch ? { date: null } : {}) },
      };

  return {
    summary: event.summary,
    // при обновлении пустое описание очищает его, при создании — просто не отправляем
    ...(isPatch ? { description: event.description ?? "" } : event.description ? { description: event.description } : {}),
    ...(event.colorId ? { colorId: event.colorId } : {}),
    ...when,
  };
};

export const createCalendarEvent = (userId: number, event: ICalendarEventInput) =>
  withGoogle(userId, async (auth) => {
    const calendar = google.calendar({ version: "v3", auth });
    const result = await calendar.events.insert({
      calendarId: "primary",
      requestBody: toRequestBody(event, false),
    });
    return result.data;
  });

export const updateCalendarEvent = (
  userId: number,
  eventId: string,
  event: ICalendarEventInput,
) =>
  withGoogle(userId, async (auth) => {
    const calendar = google.calendar({ version: "v3", auth });
    const result = await calendar.events.patch({
      calendarId: "primary",
      eventId,
      requestBody: toRequestBody(event, true),
    });
    return result.data;
  });

export const deleteCalendarEvent = (userId: number, eventId: string) =>
  withGoogle(userId, async (auth) => {
    const calendar = google.calendar({ version: "v3", auth });
    await calendar.events.delete({ calendarId: "primary", eventId });
    return { deleted: true, eventId };
  });
