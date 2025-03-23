"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const feedback_controller_1 = require("./feedback.controller");
const router = express_1.default.Router();
router.get("/", feedback_controller_1.feedbackController.getFeedback);
router.post("/create", feedback_controller_1.feedbackController.createFeedback);
//for dev delete
router.delete("/:id", feedback_controller_1.feedbackController.deleteFeedback);
exports.default = router;
