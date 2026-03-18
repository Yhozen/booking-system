import { addMinutes } from "date-fns";
import { TRPCError } from "@trpc/server";
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

  getFormOptions: publicProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.$queryRawUnsafe<
      {
        provider_user_id: string;
        provider_name: string;
        service_id: string;
        service_name: string;
        duration_minutes: number;
      }[]
    >(
      `select
         u.id::text as provider_user_id,
         u.display_name as provider_name,
         s.id::text as service_id,
         s.name as service_name,
         s.duration_minutes
       from users u
       join services s
         on s.provider_user_id = u.id
       where s.is_active = true
       order by u.display_name, s.name`,
    );

    const providerMap = new Map<
      number,
      {
        providerUserId: number;
        providerName: string;
        services: {
          serviceId: number;
          serviceName: string;
          durationMinutes: number;
        }[];
      }
    >();

    for (const row of rows) {
      const providerUserId = Number(row.provider_user_id);
      const serviceId = Number(row.service_id);

      if (!Number.isFinite(providerUserId) || !Number.isFinite(serviceId)) {
        continue;
      }

      const existingProvider = providerMap.get(providerUserId);
      if (existingProvider) {
        existingProvider.services.push({
          serviceId,
          serviceName: row.service_name,
          durationMinutes: row.duration_minutes,
        });
        continue;
      }

      providerMap.set(providerUserId, {
        providerUserId,
        providerName: row.provider_name,
        services: [
          {
            serviceId,
            serviceName: row.service_name,
            durationMinutes: row.duration_minutes,
          },
        ],
      });
    }

    return Array.from(providerMap.values());
  }),

  createFromUi: publicProcedure
    .input(
      z.object({
        providerUserId: z.number().int().positive(),
        serviceId: z.number().int().positive(),
        customerName: z.string().min(1),
        slotStart: z.string().datetime({ offset: true }),
        status: z.enum(BOOKING_STATUSES).optional(),
        ensureAvailabilityWindow: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const slotStart = new Date(input.slotStart);

      if (Number.isNaN(slotStart.getTime())) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "slotStart must be a valid datetime",
        });
      }

      const service = await ctx.db.$queryRawUnsafe<{ duration_minutes: number }[]>(
        `select duration_minutes
         from services
         where id = $1::bigint
           and provider_user_id = $2::bigint
           and is_active = true`,
        input.serviceId,
        input.providerUserId,
      );

      const durationMinutes = service[0]?.duration_minutes;
      if (!durationMinutes) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Selected service was not found for provider",
        });
      }

      const slotEnd = addMinutes(slotStart, durationMinutes);

      if (input.ensureAvailabilityWindow) {
        await ctx.db.$executeRawUnsafe(
          `insert into availability_windows (
             provider_user_id,
             service_id,
             slot,
             source
           )
           select
             $1::bigint,
             $2::bigint,
             tstzrange($3::timestamptz, $4::timestamptz, '[)'),
             'manual'
           where not exists (
             select 1
             from availability_windows aw
             where aw.provider_user_id = $1::bigint
               and (aw.service_id is null or aw.service_id = $2::bigint)
               and aw.slot @> tstzrange($3::timestamptz, $4::timestamptz, '[)')
           )`,
          input.providerUserId,
          input.serviceId,
          slotStart,
          slotEnd,
        );
      }

      const bookingService = new BookingService(createPrismaBookingDb(ctx.db));
      const bookingId = await bookingService.createBooking({
        providerUserId: input.providerUserId,
        serviceId: input.serviceId,
        customerName: input.customerName,
        slotStart,
        slotEnd,
        status: input.status,
      });

      return {
        bookingId,
        slotEnd: slotEnd.toISOString(),
      };
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
