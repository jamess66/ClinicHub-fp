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
Object.defineProperty(exports, "__esModule", { value: true });
exports.feedbackController = void 0;
const feedback_service_1 = require("./feedback.service");
class FeedbackController {
    constructor() { }
    createFeedback(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { rating, comment } = req.body;
                if (!rating || !comment) {
                    return res.status(400).send({ error: "Missing required fields" });
                }
                const result = yield feedback_service_1.feedbackService.createFeedback(rating, comment);
                return res.status(result.status).send(result);
            }
            catch (error) {
                return res.status(500).send({ error: "Internal server error" });
            }
        });
    }
    getFeedback(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { rating } = req.query;
                if (!rating) {
                    const result = yield feedback_service_1.feedbackService.getAllFeedback();
                    if (result.error) {
                        return res.status(result.status).send({ error: result.error });
                    }
                    return res.status(200).send(result.data);
                }
                const ratingFilter = parseInt(rating, 10);
                if (isNaN(ratingFilter) || ratingFilter < 1 || ratingFilter > 3) {
                    return res
                        .status(400)
                        .send({ error: "Invalid rating value (must be 1-3)" });
                }
                const result = yield feedback_service_1.feedbackService.getFeedbackByRating(ratingFilter);
                if (result.error) {
                    return res.status(result.status).send({ error: result.error });
                }
                return res.status(200).send(result.data);
            }
            catch (error) {
                return res.status(500).send({
                    error: "An unexpected error occurred while fetching feedback: " +
                        error.message,
                });
            }
        });
    }
    deleteFeedback(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                if (!id) {
                    return res.status(400).json({ error: "Feedback ID is required" });
                }
                const feedbackId = parseInt(id, 10);
                if (isNaN(feedbackId)) {
                    return res.status(400).json({ error: "Invalid feedback ID" });
                }
                const result = yield feedback_service_1.feedbackService.deleteFeedback(feedbackId);
                return res.status(result.status).json(result);
            }
            catch (error) {
                return res.status(500).json({ error: "Internal server error" });
            }
        });
    }
}
exports.feedbackController = new FeedbackController();
