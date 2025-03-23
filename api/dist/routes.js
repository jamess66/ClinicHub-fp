"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const swagger_route_1 = __importDefault(require("./swagger/swagger.route"));
const appointment_route_1 = __importDefault(require("./appointment/appointment.route"));
const calendar_api_1 = __importDefault(require("./calendar/calendar_api"));
const feedback_route_1 = __importDefault(require("./feedback/feedback.route"));
const registerRoutes = (app) => {
    app.use("/", appointment_route_1.default);
    app.use("/docs", swagger_route_1.default);
    app.use("/calendar", calendar_api_1.default);
    app.use("/feedback", feedback_route_1.default);
};
exports.default = registerRoutes;
