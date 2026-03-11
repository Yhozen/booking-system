import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { createPrismaBookingDb } from "@/server/services/booking/booking-db";
import {
  BOOKING_STATUSES,
  BookingService,
} from "@/server/services/booking/booking-service";

export const bookingRouter = createTRPCRouter({
  create: publicProcedure
    .input(
      z.object({
        providerUserId: z.number().int().positive(),
        serviceId: z.number().int().positive(),
        customerName: z.string().min(1),
        slotStart: z.string().datetime({ offset: true }),
        slotEnd: z.string().datetime({ offset: true }),
        status: z.enum(BOOKING_STATUSES).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const bookingService = new BookingService(createPrismaBookingDb(ctx.db));
      const bookingId = await bookingService.createBooking({
        providerUserId: input.providerUserId,
        serviceId: input.serviceId,
        customerName: input.customerName,
        slotStart: new Date(input.slotStart),
        slotEnd: new Date(input.slotEnd),
        status: input.status,
      });

      return { bookingId };
    }),

  materializeAvailabilityWindows: publicProcedure
    .input(
      z.object({
        startDate: z.string().datetime({ offset: true }),
        endDate: z.string().datetime({ offset: true }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const bookingService = new BookingService(createPrismaBookingDb(ctx.db));

      await bookingService.materializeAvailabilityWindows({
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
      });

      return { ok: true as const };
    }),
});
