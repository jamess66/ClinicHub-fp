"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.appointmentController = void 0;
const client_1 = require("@prisma/client");
const appointment_service_1 = require("./appointment.service");
const axios_1 = __importDefault(require("axios"));
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const sendLineNotification = (message) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const response = yield axios_1.default.post("https://api.line.me/v2/bot/message/push", {
            to: process.env.LINE_USER_ID,
            messages: [{ type: "text", text: message }],
        }, {
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.LINE_ACCESS_TOKEN}`,
            },
        });
    }
    catch (error) {
        console.error("Error sending LINE notification:", error);
    }
});
const validateDateTimeFormat = (dateTime) => {
    const dateTimeFormat = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}$/;
    return dateTimeFormat.test(dateTime);
};
class AppointmentController {
    constructor() { }
    getAppointmentTimeSlot(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { date } = req.query;
                if (!date) {
                    res.status(400).send({ error: "Date is required" });
                    return;
                }
                const result = yield appointment_service_1.appointmentService.getAppointmentTimeSlot(date);
                if (!result) {
                    res.status(500).send({ error: "Failed to get appointment timeslot" });
                    return;
                }
                if (result.error) {
                    res.status(result.status).send({ error: result.error });
                }
                else {
                    res.status(200).send(result.data);
                }
            }
            catch (error) {
                res.status(500).send({
                    error: "An unexpected error occurred while fetching appointment time slot: " +
                        error.message,
                });
            }
        });
    }
    createAppointment(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { firstname, lastname, phone_number, symptom, appointment_dateTime, } = req.body;
                if (!firstname ||
                    !lastname ||
                    !phone_number ||
                    !symptom ||
                    !appointment_dateTime) {
                    res.status(400).send({ error: "Missing required fields", status: 400 });
                    return;
                }
                if (!validateDateTimeFormat(appointment_dateTime)) {
                    res
                        .status(400)
                        .send({ error: "Appointment date time is invalid", status: 400 });
                    return;
                }
                const result = yield appointment_service_1.appointmentService.creteBooking(firstname, lastname, phone_number, symptom, appointment_dateTime);
                if (result.error) {
                    res.status(result.status).send({ error: result.error });
                }
                else {
                    res.status(200).send(result.data);
                    yield sendLineNotification(`📅 มีการนัดหมายใหม่!\n👤 ${firstname} ${lastname}\n📞 ${phone_number}\n🩺 อาการ: ${symptom}\n🕒 วันที่: ${appointment_dateTime}`);
                }
            }
            catch (err) {
                res.status(500).send({
                    error: "An unexpected error occurred while creating appointment: " +
                        err.message,
                    status: 500,
                });
            }
        });
    }
    getDoctorAppointment(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { date, firstname, lastname, status, phone_number, id } = req.query;
                if (!date && !firstname && !lastname && !status && !phone_number && !id) {
                    const result = yield appointment_service_1.appointmentService.getDoctorAppointmentAll();
                    if (result.error) {
                        res.status(result.status).send({ error: result.error });
                    }
                    else
                        res.status(200).send(result.data);
                    return;
                }
                if (date && isNaN(Date.parse(date))) {
                    res.status(400).send({ error: "Invalid date format" });
                    return;
                }
                if (!date && !firstname && !lastname && !status && !phone_number && !id) {
                    res.status(400).send({ error: "Bad request invalid parameter" });
                    return;
                }
                const result = yield appointment_service_1.appointmentService.getDoctorAppointmentByParameter(date, firstname, lastname, status, phone_number, id ? Number(id) : undefined);
                if (result.error) {
                    res.status(result.status).send({ error: result.error });
                }
                else
                    res.status(200).send(result.data);
            }
            catch (err) {
                res.status(500).send({
                    error: "An unexpected error occurred while fetching doctor appointment:" +
                        err.message,
                });
            }
        });
    }
    updateDoctorAppointment(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id, appointment_dateTime, status } = req.body;
                if (!id || !(appointment_dateTime || status)) {
                    res.status(400).send({ error: "Missing required fields", status: 400 });
                    return;
                }
                if (appointment_dateTime &&
                    !validateDateTimeFormat(appointment_dateTime)) {
                    res
                        .status(400)
                        .send({ error: "Appointment date time is invalid", status: 400 });
                    return;
                }
                if (status && !Object.values(client_1.Status).includes(status)) {
                    res.status(400).send({ error: "Invalid status", status: 400 });
                    return;
                }
                const result = yield appointment_service_1.appointmentService.updateDoctorAppointment(id, appointment_dateTime, status);
                if (result.error) {
                    res.status(result.status).send({ error: result.error });
                }
                else {
                    res.status(200).send(result.data);
                    yield sendLineNotification(`✅ อัปเดตการนัดหมาย\n📌 ID: ${id}\n🕒 เวลาใหม่: ${appointment_dateTime || "ไม่เปลี่ยนแปลง"}\n📌 สถานะ: ${status || "ไม่เปลี่ยนแปลง"}`);
                }
            }
            catch (err) {
                res.status(500).send({
                    error: "An unexpected error occurred while updating appointment: " +
                        err.message,
                });
            }
        });
    }
    cancelDoctorAppointment(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield appointment_service_1.appointmentService.cancelAppointment(req.body);
                if (result.error) {
                    res.status(result.status).send(result);
                }
                else
                    res.status(200).send(result);
            }
            catch (err) {
                res.status(500).send({ error: err.message });
            }
        });
    }
    getPatientAppointment(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { phoneNumber, firstname, lastname } = req.query;
                if (!phoneNumber || !firstname || !lastname) {
                    res.status(400).send({
                        error: "Phone number, firstname, and lastname are required.",
                    });
                    return;
                }
                const record = yield appointment_service_1.appointmentService.getPatientAppointment(phoneNumber, firstname, lastname);
                if (record.error) {
                    res.status(record.status).send({ error: record.error });
                }
                else
                    res.status(200).send(record.data);
            }
            catch (error) {
                res.status(500).send({ error: "Internal Server Error" });
            }
        });
    }
    updatePatientAppointment(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id, appointment_dateTime, symptom, firstname, lastname, phone_number, } = req.body;
                if (!id ||
                    !(appointment_dateTime ||
                        symptom ||
                        firstname ||
                        lastname ||
                        phone_number)) {
                    res.status(400).send({ error: "Missing required fields", status: 400 });
                    return;
                }
                if (appointment_dateTime &&
                    !validateDateTimeFormat(appointment_dateTime)) {
                    res
                        .status(400)
                        .send({ error: "Appointment date time is invalid", status: 400 });
                    return;
                }
                const result = yield appointment_service_1.appointmentService.updatePatientAppointment(id, firstname, lastname, phone_number, appointment_dateTime, symptom);
                if (result.error) {
                    res.status(result.status).send({ error: result.error });
                }
                else {
                    res.status(200).send(result.data);
                    yield sendLineNotification(`🔄 ผู้ป่วยอัปเดตการนัดหมาย\n📌 ID: ${id}\n👤 ${firstname} ${lastname}\n📞 ${phone_number}\n🕒 เวลาใหม่: ${appointment_dateTime}`);
                }
            }
            catch (err) {
                res.status(500).send({
                    error: "An unexpected error occurred while updating patient appointment controller:" +
                        err.message,
                });
            }
        });
    }
    cancelAppointment(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id, firstname, lastname, phone_number } = req.body;
                const result = yield appointment_service_1.appointmentService.cancelAppointment(req.body);
                if (result.error) {
                    res.status(result.status).send({ error: result.error });
                }
                else {
                    res.status(200).send(result.data);
                    yield sendLineNotification(`❌ ยกเลิกการนัดหมาย\n📌 ID: ${id}\n👤 ${firstname} ${lastname}\n📞 ${phone_number}`);
                }
            }
            catch (err) {
                res.status(500).send({
                    error: "An unexpected error occurred while canceling appointment controller:" +
                        err.message,
                });
            }
        });
    }
}
exports.appointmentController = new AppointmentController();
