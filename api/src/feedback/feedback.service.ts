import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

class FeedbackService {
  async createFeedback(rating: number, comment: string) {
    try {
      // bad, moderate, good
      if (!rating || rating < 1 || rating > 3) {
        return { error: "Invalid rating value (must be 1-3)", status: 400 };
      }

      const feedback = await prisma.feedback.create({
        data: {
          rating,
          comment: comment,
        },
      });

      return { data: feedback, status: 201 };
    } catch (error) {
      console.error("Error creating feedback:", error);
      return { error: "Error creating feedback", status: 500 };
    }
  }

  async getAllFeedback() {
    try {
      const feedbackList = await prisma.feedback.findMany({
        orderBy: { createdAt: "desc" },
      });
      return { data: feedbackList, status: 200 };
    } catch (error) {
      return { error: "Error fetching feedback", status: 500 };
    }
  }

  async getFeedbackByRating(rating: number) {
    try {
      const feedbackList = await prisma.feedback.findMany({
        where: { rating: rating },
        orderBy: { createdAt: "desc" },
      });

      return { data: feedbackList, status: 200 };
    } catch (error) {
      return { error: "Error fetching feedback by rating", status: 500 };
    }
  }

  async deleteFeedback(id: number) {
    try {
      const existingFeedback = await prisma.feedback.findUnique({
        where: { id },
      });
      if (!existingFeedback) {
        return { error: "Feedback not found", status: 404 };
      }

      await prisma.feedback.delete({ where: { id } });
      return { message: "Feedback deleted successfully", status: 200 };
    } catch (error) {
      console.error("Error deleting feedback:", error);
      return { error: "Error deleting feedback", status: 500 };
    }
  }
}

export const feedbackService = new FeedbackService();
