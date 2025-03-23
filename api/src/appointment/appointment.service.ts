import { Appointments, PrismaClient, Status, Prisma } from "@prisma/client";
import { calendarService } from "../calendar/calendar.service";
import { pipe, flow } from "fp-ts/function";
import * as O from "fp-ts/Option";
import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import * as A from "fp-ts/Array";

// region Types
// Types
type AppointmentResult<T> = { status: number; data?: T; error?: string }

type GoogleCalendarResult = { eventID: string };

type ValidationResult = E.Either<string, boolean>;

type AppointmentFields = (keyof Appointments)[];

// region Constants
// Constants
const APPOINTMENT_FIELDS: AppointmentFields = [
  "firstname",
  "lastname",
  "phone_number",
  "appointment_dateTime",
  "symptom",
  "appointment_status",
];

const TIME_SLOT_VALIDATORS = [
  (d: Date) => !isNaN(d.getTime()),
  (d: Date) => d > new Date(),
  (d: Date) => d.getMinutes() % 15 === 0,
];

// region Pure functions
// Pure functions for validation
export const isDefined = (value: any): boolean =>
  value !== undefined && value !== null && value !== '';

const validateRequiredFields = (...fields: any[]): ValidationResult =>
  fields.every(isDefined)
    ? E.right(true)
    : E.left("Missing required fields");

const isValidDateFormat = (date: string): boolean =>
  /^(?:\d{4}|\d{4}-\d{2}|\d{4}-\d{2}-\d{2}|\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3})$/.test(date);

const createDateValidator = (required: boolean) => (date: string): ValidationResult =>
  !isDefined(date) && !required
    ? E.right(true)
    : pipe(
      O.fromPredicate(isDefined)(date),
      O.map(d => new Date(d)),
      O.map(d => TIME_SLOT_VALIDATORS.every(pred => pred(d))),
      O.getOrElse(() => false),
      valid => valid ? E.right(true) : E.left("Invalid time slot")
    );

const isFieldChanged = (dbData: Appointments) => (newData: Appointments): boolean =>
  APPOINTMENT_FIELDS.some(field => dbData[field] !== newData[field]);

// Pure functions for data transformation
const formatAppointmentData = (appointment: Appointments) => ({
  id: appointment.id,
  firstname: appointment.firstname,
  lastname: appointment.lastname,
  phone_number: appointment.phone_number,
  symptom: appointment.symptom,
  appointment_dateTime: appointment.appointment_dateTime,
  appointment_status: Status[appointment.appointment_status] as string,
});

const createDateTimeObject = (dateStr: string) => {
  const date = new Date(dateStr);
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
  };
};

// region Database
// Database operations
const prisma = new PrismaClient();

const findAppointmentsByDate = (date: string): TE.TaskEither<string, { appointment_dateTime: string }[]> =>
  TE.tryCatch(
    () => prisma.appointments.findMany({
      select: { appointment_dateTime: true },
      where: {
        appointment_dateTime: { contains: date },
        appointment_status: { not: Status.CANCELED },
      },
      orderBy: { appointment_dateTime: "asc" },
    }),
    err => `Error while fetching appointment time slot: ${err}`
  );

const findAppointmentByTimeSlot = (date: string, id: number): TE.TaskEither<string, boolean> =>
  TE.tryCatch(
    async () => {
      if (!date) return true;

      const checkBooking = await prisma.appointments.findMany({
        where: {
          appointment_dateTime: date,
          NOT: {
            appointment_status: Status.CANCELED,
          },
        },
      });

      return !(checkBooking.length > 0 && checkBooking.some(booking => booking.id != id));
    },
    err => `Error checking existing appointment: ${err}`
  );

const findAppointmentById = (id: number): TE.TaskEither<string, Appointments | null> =>
  TE.tryCatch(
    () => prisma.appointments.findUnique({ where: { id } }),
    err => `Error finding appointment: ${err}`
  );

const findAppointmentByParams = (params: Prisma.AppointmentsWhereInput): TE.TaskEither<string, Appointments[]> =>
  TE.tryCatch(
    () => prisma.appointments.findMany({
      where: params,
      orderBy: { appointment_dateTime: "asc" },
    }),
    err => `Error finding appointments: ${err}`
  );

const createAppointment = (data: Prisma.AppointmentsCreateInput): TE.TaskEither<string, Appointments> =>
  TE.tryCatch(
    () => prisma.appointments.create({ data }),
    err => `Error creating appointment: ${err}`
  );

const updateAppointment = (
  id: number,
  data: Prisma.AppointmentsUpdateInput
): TE.TaskEither<string, Appointments> =>
  TE.tryCatch(
    () => prisma.appointments.update({ where: { id }, data }),
    err => `Error updating appointment: ${err}`
  );

// region Google Calendar
// Calendar operations
const createGoogleCalendarEvent = (
  date: string,
  symptom: string
): TE.TaskEither<string, GoogleCalendarResult> =>
  TE.tryCatch(
    async () => {
      const dateTime = createDateTimeObject(date);
      const response = await calendarService.createEvent({ ...dateTime, description: symptom || "No description" })();
      return pipe(
        response,
        E.fold(
          (error) => { throw new Error(error.error) },
          (data) => ({ eventID: data.eventID || "" })
        )
      )

    },
    err => `Error creating calendar event: ${err}`
  )

const deleteGoogleCalendarEvent = (eventId: string): TE.TaskEither<string, { message?: string | undefined; status?: number | undefined; }> =>
  pipe(
    calendarService.deleteEvent(eventId),
    TE.mapLeft(error => `Error deleting calendar event: ${error.error}`),
    TE.chain(response =>
      response.status === 200 ? TE.right(response) : TE.left(`Error deleting calendar event: ${response.error}`)
    )

  );

// region Utils
// Helper for handling TaskEither results
const handleTaskResult = <T>(task: TE.TaskEither<string, T>): Promise<AppointmentResult<T>> =>
  pipe(
    task,
    TE.match(
      (error: string): AppointmentResult<T> => ({ error, status: 500 }),
      (data: T): AppointmentResult<T> => ({ data, status: 200 })
    )
  )();

// Custom error status mapping
const mapErrorToStatus = (error: string): number => {
  if (error === "Missing required fields" ||
    error === "Invalid time slot" ||
    error === "Validation failed") return 400;
  if (error === "Appointment not found" ||
    error === "No appointments found" ||
    error === "Booking not found") return 404;
  if (error === "No changes" ||
    error === "Booking already canceled") return 304;
  if (error === "Time slot already existing" ||
    error === "Appointment canceled") return 400;
  return 500;
};

// Helper for creating result from Either
const createResultFromEither = <T>(either: E.Either<string, T>): AppointmentResult<T> => {
  if (E.isLeft(either)) {
    return { error: either.left, status: mapErrorToStatus(either.left) };
  } else {
    return { data: either.right, status: 200 };
  }
};

// region Services
// Main service functions
export const appointmentService = {
  // region getAppointmentTimeSlot
  getAppointmentTimeSlot: (date: string): Promise<AppointmentResult<{ appointment_dateTime: string }[]>> =>
    pipe(
      date,
      O.fromPredicate(d => isDefined(d) && isValidDateFormat(d)),
      O.fold(
        () => Promise.resolve({ error: "Invalid date", data: undefined, status: 400 }),
        validDate => handleTaskResult(findAppointmentsByDate(validDate))
      )
    ),

  // region createBooking
  createBooking: async (
    firstname: string,
    lastname: string,
    phone_number: string,
    symptom: string,
    appointment_dateTime: string
  ): Promise<AppointmentResult<any>> => {
    // Validation using composition
    const validateInput = flow(
      (): ValidationResult => validateRequiredFields(firstname, lastname, phone_number, symptom, appointment_dateTime),
      E.chain(() => createDateValidator(true)(appointment_dateTime))
    );

    const checkTimeSlot = (): TE.TaskEither<string, boolean> =>
      findAppointmentByTimeSlot(appointment_dateTime, -1);

    const createCalendarEntry = (): TE.TaskEither<string, { eventID: string }> =>
      createGoogleCalendarEvent(appointment_dateTime, symptom);

    const insertBooking = (eventID: string): TE.TaskEither<string, Appointments> =>
      createAppointment({
        eventId: eventID,
        firstname,
        lastname,
        phone_number,
        symptom,
        appointment_dateTime,
        appointment_status: Status.PENDING,
      });

    const result = await pipe(
      validateInput(),
      E.chain(() => E.right(undefined)),
      TE.fromEither,
      TE.chain(() => checkTimeSlot()),
      TE.chain(available =>
        available ? TE.right(undefined) : TE.left("Time slot already existing")
      ),
      TE.chain(() => createCalendarEntry()),
      TE.chain(({ eventID }) =>
        eventID ? insertBooking(eventID) : TE.left("Failed to create calendar event")
      ),
      TE.map(formatAppointmentData)
    )();

    return pipe(
      result,
      E.fold(
        error => ({ error, status: mapErrorToStatus(error) }),
        data => ({ data, status: 200, error: '' })
      )
    );
  },

  // region getDoctorAppointments
  getDoctorAppointmentAll: async (): Promise<AppointmentResult<any[]>> => {
    const getAppointments = TE.tryCatch(
      () => prisma.appointments.findMany({
        orderBy: { appointment_dateTime: "asc" },
      }),
      err => `Error fetching appointments: ${err}`
    );

    return handleTaskResult(
      pipe(
        getAppointments,
        TE.map(A.map(formatAppointmentData))
      )
    );
  },

  getDoctorAppointmentByParameter: async (
    date: string,
    firstname: string,
    lastname: string,
    status: string,
    phone_number: string,
    id?: number
  ): Promise<AppointmentResult<Appointments[]>> => {
    const buildWhereClause = (): Prisma.AppointmentsWhereInput => {
      const status_prisma = status
        ? Status[status.toUpperCase() as keyof typeof Status]
        : undefined;

      return {
        ...(date && { appointment_dateTime: { contains: date } }),
        ...(firstname && { firstname: { contains: firstname } }),
        ...(lastname && { lastname: { contains: lastname } }),
        ...(phone_number && { phone_number: { contains: phone_number } }),
        ...(id && { id: { equals: id } }),
        ...(status_prisma && { appointment_status: status_prisma }),
      };
    };

    return handleTaskResult(findAppointmentByParams(buildWhereClause()));
  },

  // region updateBooking
  updateDoctorAppointment: async (
    id: number,
    appointment_dateTime: string,
    status: string
  ): Promise<AppointmentResult<Appointments>> => {
    // Validation using composition
    const validateInput = flow(
      (): ValidationResult => validateRequiredFields(id, appointment_dateTime, status),
      E.chain(() => createDateValidator(false)(appointment_dateTime)),
      E.chain(() =>
        status && Status[status as keyof typeof Status] !== undefined
          ? E.right(true)
          : E.left("Invalid status")
      )
    );

    const getExistingAppointment = (): TE.TaskEither<string, Appointments> =>
      pipe(
        findAppointmentById(id),
        TE.chain(appointment =>
          appointment ? TE.right(appointment) : TE.left("Appointment not found")
        )
      );

    const checkTimeSlotAvailability = (): TE.TaskEither<string, boolean> =>
      appointment_dateTime
        ? findAppointmentByTimeSlot(appointment_dateTime, id)
        : TE.right(true);

    const processAppointmentUpdate = (existingBooking: Appointments) => {
      const newStatus = status ? Status[status as keyof typeof Status] : existingBooking.appointment_status;
      const newDateTime = appointment_dateTime || existingBooking.appointment_dateTime;

      const newData: Appointments = {
        ...existingBooking,
        appointment_dateTime: newDateTime,
        appointment_status: newStatus,
      };

      if (!isFieldChanged(existingBooking)(newData)) {
        return TE.left("No changes");
      }

      return pipe(
        createGoogleCalendarEvent(newDateTime, existingBooking.symptom),
        TE.chain(eventID => eventID ? TE.right(eventID) : TE.left("Failed to create calendar event")),
        TE.chain(({ eventID }) =>
          existingBooking.eventId
            ? pipe(
              deleteGoogleCalendarEvent(existingBooking.eventId),
              TE.map(() => eventID)
            )
            : TE.right(eventID)
        ),
        TE.chain(eventID =>
          updateAppointment(id, {
            appointment_dateTime: appointment_dateTime || undefined,
            appointment_status: status ? Status[status as keyof typeof Status] : undefined,
            eventId: eventID,
          })
        )
      );
    };

    const result = await pipe(
      validateInput(),
      TE.fromEither,
      TE.chain(() => getExistingAppointment()),
      TE.chain(existingBooking =>
        pipe(
          checkTimeSlotAvailability(),
          TE.chain(isAvailable =>
            isAvailable
              ? TE.right(existingBooking)
              : TE.left("Time slot already existing")
          )
        )
      ),
      TE.chain(processAppointmentUpdate)
    )();

    return pipe(
      result,
      E.match(
        (error): AppointmentResult<Appointments> => ({ error, status: mapErrorToStatus(error) }),
        (data): AppointmentResult<Appointments> => ({ data, status: 200 })
      )
    );
  },

  // region getPatientAppointments
  getPatientAppointment: async (
    phone_number: string,
    firstname: string,
    lastname: string
  ): Promise<AppointmentResult<Appointments[]>> => {
    const validation = validateRequiredFields(phone_number, firstname, lastname);

    if (E.isLeft(validation)) {
      return createResultFromEither(validation);
    }

    const result = await pipe(
      findAppointmentByParams({ phone_number, firstname, lastname }),
      TE.chain(appointments =>
        appointments.length > 0
          ? TE.right(appointments)
          : TE.left("No appointments found")
      )
    )();

    return pipe(
      result,
      E.match(
        (error): AppointmentResult<Appointments[]> => ({ error, status: mapErrorToStatus(error) }),
        (data): AppointmentResult<Appointments[]> => ({ data, status: 200 })
      )
    );
  },

  // region updatePatient
  updatePatientAppointment: async (
    id: number,
    firstname: string,
    lastname: string,
    phone_number: string,
    appointment_dateTime: string,
    symptom: string
  ): Promise<AppointmentResult<Appointments>> => {
    const hasUpdates = [firstname, lastname, phone_number, appointment_dateTime, symptom]
      .some(isDefined);

    const validateInput = flow(
      (): ValidationResult => id && hasUpdates
        ? E.right(true)
        : E.left("Missing required fields"),
      E.chain(() => appointment_dateTime
        ? createDateValidator(false)(appointment_dateTime)
        : E.right(true)
      )
    );

    const getExistingAppointment = (): TE.TaskEither<string, Appointments> =>
      pipe(
        findAppointmentById(id),
        TE.chain(appointment =>
          appointment
            ? TE.right(appointment)
            : TE.left("Appointment not found")
        ),
        TE.chain(appointment =>
          appointment.appointment_status === Status.CANCELED
            ? TE.left("Appointment canceled")
            : TE.right(appointment)
        )
      );

    const processAppointmentUpdate = (existingBooking: Appointments) => {
      const newData: Appointments = {
        ...existingBooking,
        firstname: firstname || existingBooking.firstname,
        lastname: lastname || existingBooking.lastname,
        phone_number: phone_number || existingBooking.phone_number,
        appointment_dateTime: appointment_dateTime || existingBooking.appointment_dateTime,
        symptom: symptom || existingBooking.symptom,
      };

      if (!isFieldChanged(existingBooking)(newData)) {
        return TE.left("No changes");
      }

      return pipe(
        createGoogleCalendarEvent(newData.appointment_dateTime, newData.symptom),
        TE.chain(eventID => eventID ? TE.right(eventID) : TE.left("Failed to create calendar event")),
        TE.chain(({ eventID }) =>
          existingBooking.eventId
            ? pipe(
              deleteGoogleCalendarEvent(existingBooking.eventId),
              TE.map(() => eventID)
            )
            : TE.right(eventID)
        ),
        TE.chain(eventID =>
          updateAppointment(id, {
            ...newData,
            eventId: eventID,
          })
        )
      );
    };

    const result = await pipe(
      validateInput(),
      TE.fromEither,
      TE.chain(() => getExistingAppointment()),
      TE.chain(existingBooking =>
        appointment_dateTime
          ? pipe(
            findAppointmentByTimeSlot(appointment_dateTime, id),
            TE.chain(isAvailable =>
              isAvailable
                ? TE.right(existingBooking)
                : TE.left("Time slot already existing")
            )
          )
          : TE.right(existingBooking)
      ),
      TE.chain(processAppointmentUpdate)
    )();

    return pipe(
      result,
      E.match(
        (error): AppointmentResult<Appointments> => ({ error, status: mapErrorToStatus(error) }),
        (data): AppointmentResult<Appointments> => ({ data, status: 200 })
      )
    );
  },

  // region cancelPatient
  cancelAppointment: async (data: {
    id: number;
    firstname: string;
    lastname: string;
    phone_number: string;
  }): Promise<AppointmentResult<any>> => {
    const validation = validateRequiredFields(
      data.id,
      data.firstname,
      data.lastname,
      data.phone_number
    );

    if (E.isLeft(validation)) {
      return createResultFromEither(validation);
    }

    const findBooking = (): TE.TaskEither<string, Appointments> =>
      pipe(
        findAppointmentByParams({
          id: data.id,
          firstname: data.firstname,
          lastname: data.lastname,
          phone_number: data.phone_number,
        }),
        TE.chain(bookings =>
          bookings.length > 0
            ? TE.right(bookings[0])
            : TE.left("Booking not found")
        ),
        TE.chain(booking =>
          booking.appointment_status === Status.CANCELED
            ? TE.left("Booking already canceled")
            : TE.right(booking)
        )
      );

    const result = await pipe(
      findBooking(),
      TE.chain(booking =>
        booking.eventId
          ? pipe(
            deleteGoogleCalendarEvent(booking.eventId),
            TE.map(() => booking)
          )
          : TE.right(booking)
      ),
      TE.chain(booking =>
        updateAppointment(booking.id, { appointment_status: Status.CANCELED })
      ),
      TE.map(formatAppointmentData)
    )();

    return pipe(
      result,
      E.match(
        (error): AppointmentResult<Appointments> => ({ error, status: mapErrorToStatus(error) }),
        (data): AppointmentResult<Appointments> => ({ data: data as Appointments, status: 200 })
      )
    );
  },
};
