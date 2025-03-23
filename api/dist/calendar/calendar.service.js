"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.calendarService = void 0;
const googleapis_1 = require("googleapis");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const oAuth2Client = new googleapis_1.google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
oAuth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    scope: "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events",
});
const calendar = googleapis_1.google.calendar({ version: "v3", auth: oAuth2Client });
class CalendarService {
    listEvents() {
        return __awaiter(this, void 0, void 0, function* () {
            const now = new Date();
            const response = yield calendar.events.list({
                calendarId: "primary",
                timeMin: now.toISOString(),
                timeMax: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ahead
                singleEvents: true,
                orderBy: "startTime",
            });
            return response.data.items || [];
        });
    }
    createEvent(eventDetails) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const { year, month, day, hour, minute, description } = eventDetails;
            // Create date in GMT+7 by subtracting 7 hours from UTC
            const eventStartTime = new Date(Date.UTC(year, month - 1, day, hour - 7, minute));
            if (eventStartTime.getMinutes() % 15 !== 0) {
                return {
                    error: "Please select a time that is a multiple of 15 minutes.",
                    status: 400,
                };
            }
            const eventEndTime = new Date(eventStartTime.getTime() + 15 * 60000 // Adjust for 15 minutes duration
            );
            const calendarEvent = {
                summary: `Patient - ${hour}:${minute.toString().padStart(2, "0")}`,
                location: "Mongkol Clinic",
                description: description || "- No description -",
                colorId: "1",
                start: {
                    dateTime: eventStartTime.toISOString(),
                    timeZone: "GMT+07:00" // Using GMT+07:00 format
                },
                end: {
                    dateTime: eventEndTime.toISOString(),
                    timeZone: "GMT+07:00" // Using GMT+07:00 format
                },
            };
            // Check for free/busy status
            const freeBusy = yield calendar.freebusy.query({
                requestBody: {
                    timeMin: eventStartTime.toISOString(),
                    timeMax: eventEndTime.toISOString(),
                    timeZone: "GMT+07:00", // Using GMT+07:00 format
                    items: [{ id: "primary" }],
                },
            });
            const busyTimes = ((_c = (_b = (_a = freeBusy === null || freeBusy === void 0 ? void 0 : freeBusy.data) === null || _a === void 0 ? void 0 : _a.calendars) === null || _b === void 0 ? void 0 : _b.primary) === null || _c === void 0 ? void 0 : _c.busy) || [];
            if (busyTimes.length > 0) {
                return { error: "Time slot is busy.", status: 400 };
            }
            // Create the event
            const response = yield calendar.events.insert({
                calendarId: "primary",
                requestBody: calendarEvent,
            });
            if (!response.data.id) {
                return { error: "Event created, but no event ID returned.", status: 400 };
            }
            return { eventID: response.data.id, status: 200 };
        });
    }
    deleteEvent(eventId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!eventId) {
                return { error: "Event ID is required", status: 400 };
            }
            try {
                yield calendar.events.delete({
                    calendarId: "primary",
                    eventId,
                });
                return { message: "Event deleted successfully", status: 200 };
            }
            catch (error) {
                return { error: "Failed to delete event", status: 500 };
            }
        });
    }
}
exports.calendarService = new CalendarService();
