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

  getWeek: publicProcedure
    .input(
      z.object({
        startDate: z.string().datetime({ offset: true }),
        endDate: z.string().datetime({ offset: true }),
      }),
    )
    .query(async ({ ctx, input }) => {
      const startDate = new Date(input.startDate);
      const endDate = new Date(input.endDate);

      const rows = await ctx.db.$queryRawUnsafe<
        {
          id: string;
          provider_user_id: string;
          provider_name: string;
          service_id: string;
          service_name: string;
          customer_name: string;
          status: string;
          slot_start: Date;
          slot_end: Date;
        }[]
      >(
        `select
           b.id::text as id,
           b.provider_user_id::text as provider_user_id,
           u.display_name as provider_name,
           b.service_id::text as service_id,
           s.name as service_name,
           b.customer_name,
           b.status,
           lower(b.slot) as slot_start,
           upper(b.slot) as slot_end
         from bookings b
         join users u on u.id = b.provider_user_id
         join services s
           on s.id = b.service_id
          and s.provider_user_id = b.provider_user_id
         where b.slot && tstzrange($1::timestamptz, $2::timestamptz, '[)')
         order by lower(b.slot), b.provider_user_id, b.id`,
        startDate,
        endDate,
      );

      return rows.map((row) => ({
        id: row.id,
        providerUserId: row.provider_user_id,
        providerName: row.provider_name,
        serviceId: row.service_id,
        serviceName: row.service_name,
        customerName: row.customer_name,
        status: row.status,
        slotStart: row.slot_start.toISOString(),
        slotEnd: row.slot_end.toISOString(),
      }));
    }),
});
