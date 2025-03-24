import { PrismaClient, Feedback } from "@prisma/client";
import { pipe } from "fp-ts/function";
import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";

// region Types
type FeedbackResult<T> = { status: number; data?: T; error?: string };
type ValidationResult = E.Either<string, boolean>;

// region Constants
const MIN_RATING = 1;
const MAX_RATING = 3;

// region Pure functions
// Pure functions for validation
const isValidRating = (rating: number): ValidationResult =>
  rating >= MIN_RATING && rating <= MAX_RATING
    ? E.right(true)
    : E.left(`Invalid rating value (must be ${MIN_RATING}-${MAX_RATING})`);

// region Database
// Database operations
const prisma = new PrismaClient();

const createFeedbackInDB = (rating: number, comment: string): TE.TaskEither<string, Feedback> =>
  TE.tryCatch(
    () => prisma.feedback.create({ data: { rating, comment } }),
    (err) => `Error creating feedback: ${err}`
  );

const getAllFeedbackFromDB = (): TE.TaskEither<string, Feedback[]> =>
  TE.tryCatch(
    () => prisma.feedback.findMany({ orderBy: { createdAt: "desc" } }),
    (err) => `Error fetching feedback: ${err}`
  );

const getFeedbackByRatingFromDB = (rating: number): TE.TaskEither<string, Feedback[]> =>
  TE.tryCatch(
    () => prisma.feedback.findMany({ where: { rating }, orderBy: { createdAt: "desc" } }),
    (err) => `Error fetching feedback by rating: ${err}`
  );

const deleteFeedbackFromDB = (id: number): TE.TaskEither<string, Feedback> =>
  TE.tryCatch(
    () => prisma.feedback.delete({ where: { id } }),
    (err) => `Error deleting feedback: ${err}`
  );

const findFeedbackById = (id: number): TE.TaskEither<string, Feedback | null> =>
  TE.tryCatch(
    () => prisma.feedback.findUnique({ where: { id } }),
    (err) => `Error finding feedback: ${err}`
  );

// region Utils
// Helper for handling TaskEither results
const handleTaskResult = <T>(task: TE.TaskEither<string, T>): Promise<FeedbackResult<T>> =>
  pipe(
    task,
    TE.match(
      (error: string): FeedbackResult<T> => ({ error, status: 500 }),
      (data: T): FeedbackResult<T> => ({ data, status: 200 })
    )
  )();

// Custom error status mapping
const mapErrorToStatus = (error: string): number => {
  if (error.includes("Invalid rating value")) return 400;
  if (error.includes("Feedback not found")) return 404;
  return 500;
};

// Helper for creating result from Either
const createResultFromEither = <T>(either: E.Either<string, T>): FeedbackResult<T> => {
  if (E.isLeft(either)) {
    return { error: either.left, status: mapErrorToStatus(either.left) };
  } else {
    return { data: either.right, status: 200 };
  }
};

// region Services
// Main service functions
export const feedbackService = {
  createFeedback: async (rating: number, comment: string): Promise<FeedbackResult<Feedback>> => {
    const validation = isValidRating(rating);

    if (E.isLeft(validation)) {
      return createResultFromEither(validation);
    }

    return handleTaskResult(
      pipe(
        createFeedbackInDB(rating, comment),
        TE.map(feedback => feedback),
        TE.mapLeft(error => error)
      )
    );
  },

  getAllFeedback: async (): Promise<FeedbackResult<Feedback[]>> =>
    handleTaskResult(getAllFeedbackFromDB()),

  getFeedbackByRating: async (rating: number): Promise<FeedbackResult<Feedback[]>> => {
    const validation = isValidRating(rating);

    if (E.isLeft(validation)) {
      return createResultFromEither(validation);
    }

    return handleTaskResult(getFeedbackByRatingFromDB(rating));
  },

  deleteFeedback: async (id: number): Promise<FeedbackResult<string>> => {
    const checkExistingFeedback = (): TE.TaskEither<string, Feedback> =>
      pipe(
        findFeedbackById(id),
        TE.chain(feedback =>
          feedback ? TE.right(feedback) : TE.left("Feedback not found")
        )
      );

    const result = await pipe(
      checkExistingFeedback(),
      TE.chain(() => deleteFeedbackFromDB(id)),
      TE.map(() => "Feedback deleted successfully")
    )();

    return pipe(
      result,
      E.match(
        (error): FeedbackResult<string> => ({ error, status: mapErrorToStatus(error) }),
        (data): FeedbackResult<string> => ({ data, status: 200 })
      )
    );
  },
};
