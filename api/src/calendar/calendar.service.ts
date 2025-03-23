import { google, calendar_v3 } from "googleapis";
import dotenv from "dotenv";
import { pipe } from "fp-ts/function";
import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import { isDefined } from "../appointment/appointment.service";

dotenv.config();

const oAuth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);

oAuth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  scope:
    "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events",
});

const calendar = google.calendar({ version: "v3", auth: oAuth2Client });

// region Types
type CalendarResult<T> = {
  eventID?: string | undefined; status: number; data?: T; error?: string
};
type GoogleCalendarEvent = calendar_v3.Schema$Event;
type GoogleCalendarEventResponse = calendar_v3.Schema$Event | null | undefined;
type GoogleCalendarFreeBusyResponse = calendar_v3.Schema$FreeBusyResponse;
type ValidationResult = E.Either<string, boolean>;

// region Pure functions
const validateTimeSlot = (eventStartTime: Date): ValidationResult =>
  eventStartTime.getMinutes() % 15 === 0
    ? E.right(true)
    : E.left("Please select a time that is a multiple of 15 minutes.");

const createDateTimeObject = (date: Date) => {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
  };
};

const mapErrorToStatus = (error: string): number => {
  if (error === "Time slot is busy." || error === "Please select a time that is a multiple of 15 minutes.") return 400;
  if (error === "Event ID is required") return 400;
  if (error === "Failed to delete event") return 500;
  return 500;
};

const handleTaskResult = <T>(task: TE.TaskEither<string, T>): Promise<CalendarResult<T>> =>
  pipe(
    task,
    TE.match(
      (error: string): CalendarResult<T> => ({ error, status: mapErrorToStatus(error) }),
      (data: T): CalendarResult<T> => ({ data, status: 200 })
    )
  )();

// region Google Calendar operations
const listEventsFromGoogleCalendar = (): TE.TaskEither<string, GoogleCalendarEvent[]> =>
  TE.tryCatch(
    async () => {
      const now = new Date();
      const response = await calendar.events.list({
        calendarId: "primary",
        timeMin: now.toISOString(),
        timeMax: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ahead
        singleEvents: true,
        orderBy: "startTime",
      });
      return response.data.items || [];
    },
    (err) => `Error listing events: ${err}`
  );

const createEventInGoogleCalendar = (
  calendarEvent: GoogleCalendarEvent
): TE.TaskEither<string, string> =>
  TE.tryCatch(
    async () => {
      const response = await calendar.events.insert({
        calendarId: "primary",
        requestBody: calendarEvent,
      });
      if (!response.data.id) {
        throw new Error("Event created, but no event ID returned.");
      }
      return response.data.id;
    },
    (err) => `Error creating event: ${err}`
  );

const deleteEventFromGoogleCalendar = (eventId: string): TE.TaskEither<string, void> =>
  pipe(
    TE.tryCatch(
      () =>
        calendar.events.delete({
          calendarId: "primary",
          eventId,
        }),
      (err) => `Error deleting event: ${err}`
    ),
    TE.map(() => undefined)
  );

const checkFreeBusy = (
  eventStartTime: Date,
  eventEndTime: Date
): TE.TaskEither<string, boolean> =>
  TE.tryCatch(
    async () => {
      const freeBusy = await calendar.freebusy.query({
        requestBody: {
          timeMin: eventStartTime.toISOString(),
          timeMax: eventEndTime.toISOString(),
          timeZone: "GMT+07:00",
          items: [{ id: "primary" }],
        },
      });
      const busyTimes = freeBusy?.data?.calendars?.primary?.busy || [];
      return busyTimes.length === 0;
    },
    (err) => `Error checking free/busy status: ${err}`
  );

// region Service
export const calendarService = {
  listEvents: (): Promise<CalendarResult<GoogleCalendarEvent[]>> =>
    handleTaskResult(listEventsFromGoogleCalendar()),

  createEvent: async (eventDetails: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    description?: string;
  }): Promise<CalendarResult<string>> => {
    const { year, month, day, hour, minute, description } = eventDetails;
    const eventStartTime = new Date(Date.UTC(year, month - 1, day, hour - 7, minute));
    const eventEndTime = new Date(eventStartTime.getTime() + 15 * 60000);

    const calendarEvent: GoogleCalendarEvent = {
      summary: `Patient - ${hour}:${minute.toString().padStart(2, "0")}`,
      location: "Mongkol Clinic",
      description: description || "- No description -",
      colorId: "1",
      start: {
        dateTime: eventStartTime.toISOString(),
        timeZone: "GMT+07:00",
      },
      end: {
        dateTime: eventEndTime.toISOString(),
        timeZone: "GMT+07:00",
      },
    };

    const result = await pipe(
      eventStartTime,
      validateTimeSlot,
      TE.fromEither,
      TE.chain(() => checkFreeBusy(eventStartTime, eventEndTime)),
      TE.chain((isFree) => (isFree ? TE.right(calendarEvent) : TE.left("Time slot is busy."))),
      TE.chain(createEventInGoogleCalendar)
    )();

    return pipe(
      result,
      E.fold(
        (error) => ({ error, status: mapErrorToStatus(error) }),
        (data) => ({ data, status: 200, error: "" })
      )
    );
  },

  deleteEvent: async (eventId: string): Promise<CalendarResult<void>> => {
    if (!isDefined(eventId)) {
      return { error: "Event ID is required", status: 400 };
    }
    return handleTaskResult(deleteEventFromGoogleCalendar(eventId));
  },
};
