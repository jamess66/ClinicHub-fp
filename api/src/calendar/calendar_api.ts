import express, { Request, Response, Router } from "express";
import { calendarService } from "./calendar.service";

// const app = express();
// const port = 5001;

// app.use(express.json());
const router: Router = express.Router();

// GET - List Events
router.get("/list-events", async (req: Request, res: Response): Promise<any> => {
  try {
    const events = await calendarService.listEvents()();
    if (events._tag === 'Left') {
      return res.status(500).json({ message: events.left });
    }
    if (events.right.length === 0) {
      return res.status(404).json({ message: "No upcoming events found." });
    }

    const formattedEvents = events.right.map((event) => {
      const startTime = new Date(
        event.start?.dateTime || event.start?.date || ""
      );

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
  } catch (error) {
    const err = error as Error;
    res
      .status(500)
      .json({ error: "Error fetching events", message: err.message });
  }
});

export default router;
