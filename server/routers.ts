import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";

import { z } from "zod";
import { and, eq, or } from "drizzle-orm";
import { getCalculations, getFluids, getPipeMaterials, insertCalculation, insertFluid, insertPipeMaterial, deleteCalculation } from "./db";
import { head_loss, reynolds, velocity, friction_factor } from "./pipeflowCalculations";
import { hydraulic_design } from "./advancedHydraulics";
import { acknowledgeAlertIncident, assertRole, createHydraulicJob, getAlertIncidents, getAlertRules, getAuditEvents, getHydraulicJob, getNetwork, getNetworks, getTelemetry, ingestTelemetry, recordAudit, upsertAlertRule, upsertNetwork } from "./enterprise";
import { asStreamEvent, publishTelemetryBatch, telemetryStreamHealth } from "./redisTelemetry";
import { publishTelemetry } from "./realtime";

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
    hydraulicDesign: publicProcedure
      .input(z.object({
        pipeDiameter: z.number().positive(),
        pipeLength: z.number().positive(),
        flowRate: z.number().nonnegative(),
        frictionFactor: z.number().nonnegative(),
        fluidDensity: z.number().positive(),
        fittings: z.array(z.object({ name: z.string().min(1), coefficient: z.number().nonnegative() })).default([]),
        staticHead: z.number().nonnegative().default(0),
        pumpEfficiency: z.number().gt(0).lte(1).default(0.75),
        operatingHoursPerYear: z.number().nonnegative().default(0),
        electricityPricePerKwh: z.number().nonnegative().default(0),
      }))
      .mutation(({ input }) => hydraulic_design(input.flowRate, input.pipeDiameter, input.pipeLength, input.frictionFactor, input.fluidDensity, input.fittings, input.staticHead, input.pumpEfficiency, input.operatingHoursPerYear, input.electricityPricePerKwh)),
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

  enterprise: router({
    listNetworks: protectedProcedure.query(({ ctx }) => getNetworks(ctx.user.id)),
    listAlertRules: protectedProcedure.query(({ ctx }) => getAlertRules(ctx.user.id)),
    saveAlertRule: protectedProcedure.input(z.object({
      id: z.string().uuid().optional(), name: z.string().min(1).max(160), metric: z.string().min(1).max(80), source: z.string().min(1).max(160).optional(),
      operator: z.enum(["gt", "gte", "lt", "lte"]), threshold: z.number().finite(), severity: z.enum(["info", "warning", "critical"]), enabled: z.boolean().default(true), cooldownSeconds: z.number().int().min(0).max(86400).default(300),
    })).mutation(({ input, ctx }) => {
      assertRole(ctx.user.role as never, "engineer");
      const rule = upsertAlertRule({ ...input, ownerUserId: ctx.user.id });
      recordAudit(ctx.user.id, "alert-rule.upsert", "alert-rule", rule.id, { metric: rule.metric, severity: rule.severity });
      return rule;
    }),
    listAlertIncidents: protectedProcedure.input(z.object({ limit: z.number().int().positive().max(500).default(100) })).query(({ input, ctx }) => getAlertIncidents(ctx.user.id, input.limit)),
    acknowledgeAlert: protectedProcedure.input(z.object({ id: z.string().uuid() })).mutation(({ input, ctx }) => {
      assertRole(ctx.user.role as never, "engineer");
      const incident = acknowledgeAlertIncident(ctx.user.id, input.id);
      recordAudit(ctx.user.id, "alert.acknowledge", "alert-incident", incident.id);
      return incident;
    }),
    saveNetwork: protectedProcedure.input(z.object({
      id: z.string().uuid().optional(), name: z.string().min(1).max(160),
      nodes: z.array(z.object({ id: z.string().min(1), kind: z.enum(["junction", "reservoir", "tank", "pump"]), label: z.string().min(1), elevationM: z.number().finite() })),
      edges: z.array(z.object({ id: z.string().min(1), from: z.string().min(1), to: z.string().min(1), diameterM: z.number().positive(), lengthM: z.number().positive(), roughnessM: z.number().nonnegative(), flowM3s: z.number().nonnegative(), fittings: z.array(z.object({ name: z.string().min(1), coefficient: z.number().nonnegative() })) })),
    })).mutation(({ input, ctx }) => {
      assertRole(ctx.user.role as never, "engineer");
      const network = upsertNetwork({ ...input, ownerUserId: ctx.user.id });
      recordAudit(ctx.user.id, "network.upsert", "network", network.id, { version: network.version });
      return network;
    }),
    submitHydraulicJob: protectedProcedure.input(z.object({ networkId: z.string().uuid(), fluidDensity: z.number().positive(), frictionFactor: z.number().nonnegative(), pumpEfficiency: z.number().gt(0).lte(1) })).mutation(({ input, ctx }) => {
      assertRole(ctx.user.role as never, "engineer");
      const network = getNetwork(ctx.user.id, input.networkId);
      const job = createHydraulicJob(ctx.user.id, network, input.fluidDensity, input.frictionFactor, input.pumpEfficiency);
      recordAudit(ctx.user.id, "hydraulic-job.submit", "network", network.id, { jobId: job.id });
      return job;
    }),
    getHydraulicJob: protectedProcedure.input(z.object({ id: z.string().uuid() })).query(({ input, ctx }) => getHydraulicJob(ctx.user.id, input.id)),
    ingestTelemetry: protectedProcedure.input(z.object({ points: z.array(z.object({ source: z.string().min(1), metric: z.string().min(1), value: z.number().finite(), unit: z.string().min(1), timestamp: z.string().datetime(), quality: z.enum(["good", "uncertain", "bad"]) })).min(1).max(250) })).mutation(async ({ input, ctx }) => {
      assertRole(ctx.user.role as never, "engineer");
      const count = ingestTelemetry(ctx.user.id, input.points);
      const delivery = await publishTelemetryBatch(input.points.map(point => asStreamEvent(String(ctx.user.id), point)), publishTelemetry);
      recordAudit(ctx.user.id, "telemetry.ingest", "telemetry", "batch", { count, mode: delivery.mode });
      return { accepted: count, delivery };
    }),
    telemetryHealth: protectedProcedure.query(({ ctx }) => {
      assertRole(ctx.user.role as never, "viewer");
      return telemetryStreamHealth();
    }),
    getTelemetry: protectedProcedure.input(z.object({ source: z.string().optional(), limit: z.number().int().positive().max(500).default(100) })).query(({ input, ctx }) => getTelemetry(ctx.user.id, input.source, input.limit)),
    getAudit: protectedProcedure.input(z.object({ limit: z.number().int().positive().max(500).default(100) })).query(({ input, ctx }) => getAuditEvents(ctx.user.id, input.limit)),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
