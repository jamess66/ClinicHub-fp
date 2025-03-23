import { google, calendar_v3 } from "googleapis";
import dotenv from "dotenv";
import { Either, left, right, fold } from "fp-ts/Either";
import { TaskEither, tryCatch, chainW, map, left as taskLeft, right as taskRight } from "fp-ts/TaskEither";
import { pipe } from "fp-ts/function";
import * as O from "fp-ts/Option";
import * as A from "fp-ts/Array";

dotenv.config();

// Types
type EventDetails = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  description?: string;
};

type EventResponse = {
  eventID?: string;
  error?: string;
  status: number;
};

// Initialize Google OAuth2 client
const oAuth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);

oAuth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  scope: "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events",
});

const calendar = google.calendar({ version: "v3", auth: oAuth2Client });

// Helper functions
const formatError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

// Calendar service functions
const listEvents = (): TaskEither<string, any[]> =>
  pipe(
    tryCatch(
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
      (error) => `Failed to list events: ${formatError(error)}`
    )
  );

const validateEventTime = (eventDetails: EventDetails): Either<EventResponse, EventDetails> => {
  const { minute } = eventDetails;

  if (minute % 15 !== 0) {
    return left({
      error: "Please select a time that is a multiple of 15 minutes.",
      status: 400,
    });
  }

  return right(eventDetails);
};

const createEventDateTime = (eventDetails: EventDetails): {
  eventStartTime: Date;
  eventEndTime: Date;
} => {
  const { year, month, day, hour, minute } = eventDetails;
  // Create date in GMT+7 by subtracting 7 hours from UTC
  const eventStartTime = new Date(Date.UTC(year, month - 1, day, hour - 7, minute));
  const eventEndTime = new Date(eventStartTime.getTime() + 15 * 60000); // 15 minutes duration

  return { eventStartTime, eventEndTime };
};

const buildCalendarEvent = (eventDetails: EventDetails, times: {
  eventStartTime: Date;
  eventEndTime: Date;
}): calendar_v3.Schema$Event => {
  const { hour, minute, description } = eventDetails;
  const { eventStartTime, eventEndTime } = times;

  return {
    summary: `Patient - ${hour}:${minute.toString().padStart(2, "0")}`,
    location: "Mongkol Clinic",
    description: description || "- No description -",
    colorId: "1",
    start: {
      dateTime: eventStartTime.toISOString(),
      timeZone: "GMT+07:00"
    },
    end: {
      dateTime: eventEndTime.toISOString(),
      timeZone: "GMT+07:00"
    },
  };
};

const checkTimeSlotAvailability = (times: {
  eventStartTime: Date;
  eventEndTime: Date;
}): TaskEither<EventResponse, {
  eventStartTime: Date;
  eventEndTime: Date;
}> => {
  const { eventStartTime, eventEndTime } = times;

  return tryCatch(
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

      if (busyTimes.length > 0) {
        throw new Error("Time slot is busy");
      }

      return times;
    },
    (error): EventResponse => ({
      error: error instanceof Error ? error.message : "Time slot is busy.",
      status: 400
    })
  );
};

const insertCalendarEvent = (eventInfo: {
  event: calendar_v3.Schema$Event;
  times: { eventStartTime: Date; eventEndTime: Date; }
}): TaskEither<EventResponse, EventResponse> => {
  const { event } = eventInfo;

  return tryCatch(
    async () => {
      const response = await calendar.events.insert({
        calendarId: "primary",
        requestBody: event,
      });

      if (!response.data.id) {
        throw new Error("Event created, but no event ID returned.");
      }

      return {
        eventID: response.data.id,
        status: 200
      };
    },
    (error): EventResponse => ({
      error: `Failed to create event: ${formatError(error)}`,
      status: 500
    })
  );
};

const createEvent = (eventDetails: EventDetails): TaskEither<EventResponse, EventResponse> =>
  pipe(
    validateEventTime(eventDetails),
    fold(
      (error: EventResponse) => taskLeft(error),
      (validDetails: EventDetails) => {
        const times = createEventDateTime(validDetails);
        const event = buildCalendarEvent(validDetails, times);

        return pipe(
          checkTimeSlotAvailability(times),
          chainW(() => insertCalendarEvent({ event, times }))
        );
      }
    )
  );

const deleteEvent = (eventId: string): TaskEither<EventResponse, EventResponse> => {
  if (!eventId) {
    return taskLeft({
      error: "Event ID is required",
      status: 400
    });
  }

  return tryCatch(
    async () => {
      await calendar.events.delete({
        calendarId: "primary",
        eventId,
      });
      return {
        message: "Event deleted successfully",
        status: 200
      };
    },
    (error): EventResponse => ({
      error: `Failed to delete event: ${formatError(error)}`,
      status: 500
    })
  );
};

// Export service functions
export const calendarService = {
  listEvents,
  createEvent,
  deleteEvent
};