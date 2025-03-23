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
exports.feedbackService = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
class FeedbackService {
    createFeedback(rating, comment) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // bad, moderate, good
                if (!rating || rating < 1 || rating > 3) {
                    return { error: "Invalid rating value (must be 1-3)", status: 400 };
                }
                const feedback = yield prisma.feedback.create({
                    data: {
                        rating,
                        comment: comment,
                    },
                });
                return { data: feedback, status: 201 };
            }
            catch (error) {
                console.error("Error creating feedback:", error);
                return { error: "Error creating feedback", status: 500 };
            }
        });
    }
    getAllFeedback() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const feedbackList = yield prisma.feedback.findMany({
                    orderBy: { createdAt: "desc" },
                });
                return { data: feedbackList, status: 200 };
            }
            catch (error) {
                return { error: "Error fetching feedback", status: 500 };
            }
        });
    }
    getFeedbackByRating(rating) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const feedbackList = yield prisma.feedback.findMany({
                    where: { rating: rating },
                    orderBy: { createdAt: "desc" },
                });
                return { data: feedbackList, status: 200 };
            }
            catch (error) {
                return { error: "Error fetching feedback by rating", status: 500 };
            }
        });
    }
    deleteFeedback(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const existingFeedback = yield prisma.feedback.findUnique({
                    where: { id },
                });
                if (!existingFeedback) {
                    return { error: "Feedback not found", status: 404 };
                }
                yield prisma.feedback.delete({ where: { id } });
                return { message: "Feedback deleted successfully", status: 200 };
            }
            catch (error) {
                console.error("Error deleting feedback:", error);
                return { error: "Error deleting feedback", status: 500 };
            }
        });
    }
}
exports.feedbackService = new FeedbackService();
