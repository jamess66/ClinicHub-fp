"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const appointment_controller_1 = require("./appointment.controller");
const router = express_1.default.Router();
// Doctor routes
router.get("/doctor/appointment", appointment_controller_1.appointmentController.getDoctorAppointment);
router.patch("/doctor/appointment/update", appointment_controller_1.appointmentController.updateDoctorAppointment);
// Patient routes
router.get("/patient/appointment", appointment_controller_1.appointmentController.getPatientAppointment);
router.patch("/patient/appointment/update", appointment_controller_1.appointmentController.updatePatientAppointment);
// Shared route
router.post("/appointment/create", appointment_controller_1.appointmentController.createAppointment);
router.delete("/appointment/cancel", appointment_controller_1.appointmentController.cancelAppointment);
// Get appointment time slot
router.get("/appointment/time-slot", appointment_controller_1.appointmentController.getAppointmentTimeSlot);
exports.default = router;
