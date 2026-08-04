import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";

import { z } from "zod";
import { and, eq, or } from "drizzle-orm";
import { getCalculations, getFluids, getPipeMaterials, insertCalculation, insertFluid, insertPipeMaterial, deleteCalculation } from "./db";
import { head_loss, reynolds, velocity, friction_factor } from "./pipeflowCalculations";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  pipeflow: router({
    getFluids: publicProcedure
      .query(async ({ ctx }) => {
        return getFluids(ctx.user?.id || null);
      }),
    addFluid: protectedProcedure
      .input(z.object({
        name: z.string(),
        density: z.number(),
        kinematicViscosity: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        await insertFluid({ ...input, userId: ctx.user.id });
        return { success: true };
      }),
    getPipeMaterials: publicProcedure
      .query(async ({ ctx }) => {
        return getPipeMaterials(ctx.user?.id || null);
      }),
    addPipeMaterial: protectedProcedure
      .input(z.object({
        name: z.string(),
        roughness: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        await insertPipeMaterial({ ...input, userId: ctx.user.id });
        return { success: true };
      }),
    calculateDarcyWeisbach: publicProcedure
      .input(z.object({
        pipeDiameter: z.number(),
        pipeLength: z.number(),
        flowRate: z.number(),
        fluidKinematicViscosity: z.number(),
        pipeRoughness: z.number(),
      }))
      .mutation(({ input }) => {
        const vel = velocity(input.flowRate, input.pipeDiameter);
        const re = reynolds(vel, input.pipeDiameter, input.fluidKinematicViscosity);
        const f = friction_factor(re, input.pipeRoughness / input.pipeDiameter);
        const h_loss = head_loss(input.pipeLength, input.pipeDiameter, vel, f);
        return {
          velocity: vel,
          reynoldsNumber: re,
          frictionFactor: f,
          headLoss: h_loss,
        };
      }),
    getCalculations: protectedProcedure
      .query(async ({ ctx }) => {
        return getCalculations(ctx.user.id);
      }),
    saveCalculation: protectedProcedure
      .input(z.object({
        name: z.string(),
        inputs: z.object({
          pipeDiameter: z.number(),
          pipeLength: z.number(),
          flowRate: z.number(),
          fluidKinematicViscosity: z.number(),
          pipeRoughness: z.number(),
        }),
        results: z.object({
          velocity: z.number(),
          reynoldsNumber: z.number(),
          frictionFactor: z.number(),
          headLoss: z.number(),
        }),
      }))
      .mutation(async ({ input, ctx }) => {
        await insertCalculation({ ...input, userId: ctx.user.id });
        return { success: true };
      }),
    deleteCalculation: protectedProcedure
      .input(z.object({
        id: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        await deleteCalculation(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
