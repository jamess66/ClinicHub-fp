import express, { Request, Response, Router } from "express";
import { calendarService } from "./calendar.service";

const router: Router = express.Router();

// GET - List Events
router.get("/list-events", async (req: Request, res: Response): Promise<any> => {
  try {
    const result = await calendarService.listEvents();

    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    if (!result.data || result.data.length === 0) {
      return res.status(404).json({ message: "No upcoming events found." });
    }

    const formattedEvents = result.data.map((event) => {
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
