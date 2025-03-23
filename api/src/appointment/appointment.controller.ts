import e, { Request, Response } from "express";
import { Status } from "@prisma/client";
import { appointmentService } from "./appointment.service";
import axios from "axios";
import * as dotenv from "dotenv";
dotenv.config();

const sendLineNotification = async (message: string) => {
  try {
    const response = await axios.post(
      "https://api.line.me/v2/bot/message/push",
      {
        to: process.env.LINE_USER_ID,
        messages: [{ type: "text", text: message }],
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.LINE_ACCESS_TOKEN}`,
        },
      }
    );
  } catch (error) {
    console.error("Error sending LINE notification:", error);
  }
};

const validateDateTimeFormat = (dateTime: string): boolean => {
  const dateTimeFormat = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}$/;
  return dateTimeFormat.test(dateTime);
};

class AppointmentController {
  constructor() { }

  async getAppointmentTimeSlot(req: Request, res: Response) {
    try {
      const { date } = req.query;

      if (!date) {
        res.status(400).send({ error: "Date is required" });
        return;
      }

      const result = await appointmentService.getAppointmentTimeSlot(
        date as string
      );

      if (!result) {
        res.status(500).send({ error: "Failed to get appointment timeslot" });
        return;
      }

      if (result.error) {
        res.status(result.status).send({ error: result.error });
      } else {
        res.status(200).send(result.data);
      }
    } catch (error: any) {
      res.status(500).send({
        error:
          "An unexpected error occurred while fetching appointment time slot: " +
          error.message,
      });
    }
  }

  async createAppointment(req: Request, res: Response) {
    try {
      const {
        firstname,
        lastname,
        phone_number,
        symptom,
        appointment_dateTime,
      } = req.body;

      if (
        !firstname ||
        !lastname ||
        !phone_number ||
        !symptom ||
        !appointment_dateTime
      ) {
        res.status(400).send({ error: "Missing required fields", status: 400 });
        return;
      }

      if (!validateDateTimeFormat(appointment_dateTime)) {
        res
          .status(400)
          .send({ error: "Appointment date time is invalid", status: 400 });
        return;
      }

      const result = await appointmentService.createBooking(
        firstname,
        lastname,
        phone_number,
        symptom,
        appointment_dateTime
      );

      if (result.error) {
        res.status(result.status).send({ error: result.error });
      } else {
        res.status(200).send(result.data);
        await sendLineNotification(
          `📅 มีการนัดหมายใหม่!\n👤 ${firstname} ${lastname}\n📞 ${phone_number}\n🩺 อาการ: ${symptom}\n🕒 วันที่: ${appointment_dateTime}`
        );
      }
    } catch (err: any) {
      res.status(500).send({
        error:
          "An unexpected error occurred while creating appointment: " +
          err.message,
        status: 500,
      });
    }
  }

  async getDoctorAppointment(req: Request, res: Response) {
    try {
      const { date, firstname, lastname, status, phone_number, id } = req.query;

      if (!date && !firstname && !lastname && !status && !phone_number && !id) {
        const result = await appointmentService.getDoctorAppointmentAll();

        if (result.error) {
          res.status(result.status).send({ error: result.error });
        } else res.status(200).send(result.data);

        return;
      }

      if (date && isNaN(Date.parse(date as string))) {
        res.status(400).send({ error: "Invalid date format" });
        return;
      }

      if (!date && !firstname && !lastname && !status && !phone_number && !id) {
        res.status(400).send({ error: "Bad request invalid parameter" });
        return;
      }

      const result = await appointmentService.getDoctorAppointmentByParameter(
        date as string,
        firstname as string,
        lastname as string,
        status as string,
        phone_number as string,
        id ? Number(id) : undefined
      );

      if (result.error) {
        res.status(result.status).send({ error: result.error });
      } else res.status(200).send(result.data);
    } catch (err: any) {
      res.status(500).send({
        error:
          "An unexpected error occurred while fetching doctor appointment:" +
          err.message,
      });
    }
  }

  async updateDoctorAppointment(req: Request, res: Response) {
    try {
      const { id, appointment_dateTime, status } = req.body;

      if (!id || !(appointment_dateTime || status)) {
        res.status(400).send({ error: "Missing required fields", status: 400 });
        return;
      }

      if (
        appointment_dateTime &&
        !validateDateTimeFormat(appointment_dateTime)
      ) {
        res
          .status(400)
          .send({ error: "Appointment date time is invalid", status: 400 });
        return;
      }

      if (status && !Object.values(Status).includes(status as Status)) {
        res.status(400).send({ error: "Invalid status", status: 400 });
        return;
      }

      const result = await appointmentService.updateDoctorAppointment(
        id,
        appointment_dateTime,
        status
      );

      if (result.error) {
        res.status(result.status).send({ error: result.error });
      } else {
        res.status(200).send(result.data);
        await sendLineNotification(
          `✅ อัปเดตการนัดหมาย\n📌 ID: ${id}\n🕒 เวลาใหม่: ${appointment_dateTime || "ไม่เปลี่ยนแปลง"
          }\n📌 สถานะ: ${status || "ไม่เปลี่ยนแปลง"}`
        );
      }
    } catch (err: any) {
      res.status(500).send({
        error:
          "An unexpected error occurred while updating appointment: " +
          err.message,
      });
    }
  }

  async cancelDoctorAppointment(req: Request, res: Response) {
    try {
      const result = await appointmentService.cancelAppointment(req.body);
      if (result.error) {
        res.status(result.status).send(result);
      } else res.status(200).send(result);
    } catch (err: any) {
      res.status(500).send({ error: err.message });
    }
  }

  async getPatientAppointment(req: Request, res: Response): Promise<any> {
    try {
      const { phoneNumber, firstname, lastname } = req.query;

      if (!phoneNumber || !firstname || !lastname) {
        res.status(400).send({
          error: "Phone number, firstname, and lastname are required.",
        });
        return;
      }

      const record = await appointmentService.getPatientAppointment(
        phoneNumber as string,
        firstname as string,
        lastname as string
      );

      if (record.error) {
        res.status(record.status).send({ error: record.error });
      } else res.status(200).send(record.data);
    } catch (error) {
      res.status(500).send({ error: "Internal Server Error" });
    }
  }

  async updatePatientAppointment(req: Request, res: Response) {
    try {
      const {
        id,
        appointment_dateTime,
        symptom,
        firstname,
        lastname,
        phone_number,
      } = req.body;

      if (
        !id ||
        !(
          appointment_dateTime ||
          symptom ||
          firstname ||
          lastname ||
          phone_number
        )
      ) {
        res.status(400).send({ error: "Missing required fields", status: 400 });
        return;
      }

      if (
        appointment_dateTime &&
        !validateDateTimeFormat(appointment_dateTime)
      ) {
        res
          .status(400)
          .send({ error: "Appointment date time is invalid", status: 400 });
        return;
      }

      const result = await appointmentService.updatePatientAppointment(
        id,
        firstname,
        lastname,
        phone_number,
        appointment_dateTime,
        symptom
      );

      if (result.error) {
        res.status(result.status).send({ error: result.error });
      } else {
        res.status(200).send(result.data);
        await sendLineNotification(
          `🔄 ผู้ป่วยอัปเดตการนัดหมาย\n📌 ID: ${id}\n👤 ${firstname} ${lastname}\n📞 ${phone_number}\n🕒 เวลาใหม่: ${appointment_dateTime}`
        );
      }
    } catch (err: any) {
      res.status(500).send({
        error:
          "An unexpected error occurred while updating patient appointment controller:" +
          err.message,
      });
    }
  }

  async cancelAppointment(req: Request, res: Response) {
    try {
      const { id, firstname, lastname, phone_number } = req.body;
      const result = await appointmentService.cancelAppointment(req.body);

      if (result.error) {
        res.status(result.status).send({ error: result.error });
      } else {
        res.status(200).send(result.data);
        await sendLineNotification(
          `❌ ยกเลิกการนัดหมาย\n📌 ID: ${id}\n👤 ${firstname} ${lastname}\n📞 ${phone_number}`
        );
      }
    } catch (err: any) {
      res.status(500).send({
        error:
          "An unexpected error occurred while canceling appointment controller:" +
          err.message,
      });
    }
  }
}
export const appointmentController = new AppointmentController();
