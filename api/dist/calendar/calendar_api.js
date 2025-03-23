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
const express_1 = __importDefault(require("express"));
const calendar_service_1 = require("./calendar.service");
// const app = express();
// const port = 5001;
// app.use(express.json());
const router = express_1.default.Router();
// GET - List Events
router.get("/list-events", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const events = yield calendar_service_1.calendarService.listEvents();
        if (events.length === 0) {
            return res.status(404).json({ message: "No upcoming events found." });
        }
        const formattedEvents = events.map((event) => {
            var _a, _b;
            const startTime = new Date(((_a = event.start) === null || _a === void 0 ? void 0 : _a.dateTime) || ((_b = event.start) === null || _b === void 0 ? void 0 : _b.date) || "");
            const formattedDate = startTime.toLocaleDateString("en-GB", {
                weekday: "long",
                day: "2-digit",
                month: "long",
                year: "numeric",
                timeZone: "Asia/Bangkok",
            });
            const formattedStartTime = startTime.toLocaleString("en-GB", {
                timeZone: "Asia/Bangkok",
                hour12: false,
                hour: "2-digit",
                minute: "2-digit",
            });
            return {
                summary: event.summary,
                eventId: event.id,
                startTime: `${formattedDate} at ${formattedStartTime}`,
                description: event.description || "- No description -",
            };
        });
        res.status(200).json({ events: formattedEvents });
    }
    catch (error) {
        const err = error;
        res
            .status(500)
            .json({ error: "Error fetching events", message: err.message });
    }
}));
// Don't allow to create event or delete event in outside of the server
// POST - Create Event
// router.post("/create-event", async (req: Request, res: Response): Promise<any> => {
//   try {
//     const { year, month, day, hour, minute, description } = req.body;
//     if (!year || !month || !day || !hour || !minute) {
//       return res.status(400).json({
//         message: "Please provide complete date and time information.",
//       });
//     }
//     if (new Date(year, month - 1, day, hour, minute).getMinutes() % 15 !== 0) {
//       return res
//         .status(400)
//         .json({ message: "Time must be in multiples of 15 minutes." });
//     }
//     const eventId = await calendarService.createEvent({
//       year,
//       month,
//       day,
//       hour,
//       minute,
//       description,
//     });
//     res.status(200).json({ message: "Event created successfully.", eventId });
//   } catch (error) {
//     const err = error as Error;
//     res
//       .status(500)
//       .json({ error: "Error creating event", message: err.message });
//   }
// });
// // DELETE - Delete Event
// router.delete(
//   "/delete-event",
//   async (req: Request, res: Response): Promise<any> => {
//     try {
//       const { eventId } = req.body;
//       if (!eventId) {
//         return res
//           .status(400)
//           .json({ message: "Please provide the event ID to delete." });
//       }
//       await calendarService.deleteEvent(eventId);
//       res.status(200).json({ message: "Event deleted successfully." });
//     } catch (error) {
//       const err = error as Error;
//       res
//         .status(500)
//         .json({ error: "Error deleting event", message: err.message });
//     }
//   }
// );
exports.default = router;
