import { PrismaClient, Feedback } from "@prisma/client";
import { pipe } from "fp-ts/function";
import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";

const prisma = new PrismaClient();

// region Types
type FeedbackResult<T> = { status: number; data?: T; error?: string };
type ValidationResult = E.Either<string, boolean>;

// region Pure functions
const validateRating = (rating: number): ValidationResult =>
  rating >= 1 && rating <= 3
    ? E.right(true)
    : E.left("Invalid rating value (must be 1-3)");

const mapErrorToStatus = (error: string): number => {
  if (error === "Invalid rating value (must be 1-3)") return 400;
  if (error === "Feedback not found") return 404;
  return 500;
};

const handleTaskResult = <T>(task: TE.TaskEither<string, T>): Promise<FeedbackResult<T>> =>
  pipe(
    task,
    TE.match(
      (error: string): FeedbackResult<T> => ({ error, status: mapErrorToStatus(error) }),
      (data: T): FeedbackResult<T> => ({ data, status: 200 })
    )
  )();

// region Database operations
const createFeedbackInDB = (rating: number, comment: string): TE.TaskEither<string, Feedback> =>
  TE.tryCatch(
    () =>
      prisma.feedback.create({
        data: {
          rating,
          comment,
        },
      }),
    (err) => `Error creating feedback: ${err}`
  );

const getAllFeedbackFromDB = (): TE.TaskEither<string, Feedback[]> =>
  TE.tryCatch(
    () =>
      prisma.feedback.findMany({
        orderBy: { createdAt: "desc" },
      }),
    (err) => `Error fetching feedback: ${err}`
  );

const getFeedbackByRatingFromDB = (rating: number): TE.TaskEither<string, Feedback[]> =>
  TE.tryCatch(
    () =>
      prisma.feedback.findMany({
        where: { rating: rating },
        orderBy: { createdAt: "desc" },
      }),
    (err) => `Error fetching feedback by rating: ${err}`
  );

const deleteFeedbackFromDB = (id: number): TE.TaskEither<string, void> =>
  pipe(
    TE.tryCatch(
      () =>
        prisma.feedback.delete({
          where: { id },
        }),
      (err) => `Error deleting feedback: ${err}`
    ),
    TE.map(() => undefined)
  );

const findFeedbackById = (id: number): TE.TaskEither<string, Feedback | null> =>
  TE.tryCatch(
    () => prisma.feedback.findUnique({ where: { id } }),
    err => `Error finding feedback: ${err}`
  );

// region Service
export const feedbackService = {
  createFeedback: (rating: number, comment: string): Promise<FeedbackResult<Feedback>> =>
    pipe(
      rating,
      validateRating,
      TE.fromEither,
      TE.chain(() => createFeedbackInDB(rating, comment)),
      TE.mapLeft(error => error),
      TE.map(data => data),
      handleTaskResult
    ),

  getAllFeedback: (): Promise<FeedbackResult<Feedback[]>> =>
    handleTaskResult(getAllFeedbackFromDB()),

  getFeedbackByRating: (rating: number): Promise<FeedbackResult<Feedback[]>> =>
    handleTaskResult(getFeedbackByRatingFromDB(rating)),

  deleteFeedback: async (id: number): Promise<FeedbackResult<void>> => {
    const result = await pipe(
      findFeedbackById(id),
      TE.chain(feedback =>
        feedback ? TE.right(feedback) : TE.left("Feedback not found")
      ),
      TE.chain(() => deleteFeedbackFromDB(id))
    )();

    return pipe(
      result,
      E.fold(
        (error) => ({ error, status: mapErrorToStatus(error) }),
        (data) => ({ data, status: 200, error: "" })
      )
    );
  },
};
