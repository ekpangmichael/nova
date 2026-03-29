import { z } from "zod";
import type { FastifyPluginAsync } from "fastify";
import mime from "mime-types";
import { badRequest } from "../lib/errors.js";
import { parseOrThrow } from "../lib/http.js";

const createTaskSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  status: z
    .enum([
      "backlog",
      "todo",
      "in_progress",
      "in_review",
      "done",
      "failed",
      "blocked",
      "paused",
      "canceled",
    ])
    .optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).optional(),
  assignedAgentId: z.string().uuid(),
  executionTargetOverride: z.string().nullable().optional(),
  dueAt: z.string().nullable().optional(),
  estimatedMinutes: z.number().int().positive().nullable().optional(),
  labels: z.array(z.string()).optional(),
  createdBy: z.string().optional(),
});

const patchTaskSchema = createTaskSchema
  .omit({
    projectId: true,
  })
  .partial();

const addCommentSchema = z.object({
  authorType: z.enum(["user", "agent", "system"]).optional(),
  authorId: z.string().nullable().optional(),
  body: z.string().min(1),
});

const paramsSchema = z.object({
  taskId: z.string().uuid(),
});

export const taskRoutes: FastifyPluginAsync = async (app) => {
  app.get("/tasks/:taskId", async (request) => {
    const { taskId } = parseOrThrow(paramsSchema, request.params);
    return app.services.nova.getTask(taskId);
  });

  app.post("/tasks", async (request) => {
    const body = parseOrThrow(createTaskSchema, request.body);
    return app.services.nova.createTask(body);
  });

  app.patch("/tasks/:taskId", async (request) => {
    const { taskId } = parseOrThrow(paramsSchema, request.params);
    const body = parseOrThrow(patchTaskSchema, request.body);
    return app.services.nova.patchTask(taskId, body);
  });

  app.post("/tasks/:taskId/comments", async (request) => {
    const { taskId } = parseOrThrow(paramsSchema, request.params);
    const body = parseOrThrow(addCommentSchema, request.body);
    return app.services.nova.addTaskComment(taskId, body);
  });

  app.get("/tasks/:taskId/comments", async (request) => {
    const { taskId } = parseOrThrow(paramsSchema, request.params);
    return app.services.nova.getTaskComments(taskId);
  });

  app.post("/tasks/:taskId/attachments", async (request) => {
    const { taskId } = parseOrThrow(paramsSchema, request.params);
    const file = await request.file();

    if (!file) {
      throw badRequest("Expected a multipart upload with a file field.");
    }

    const buffer = await file.toBuffer();

    return app.services.nova.saveTaskAttachment({
      taskId,
      fileName: file.filename,
      mimeType:
        file.mimetype || mime.lookup(file.filename) || "application/octet-stream",
      buffer,
    });
  });

  app.post("/tasks/:taskId/start", async (request) => {
    const { taskId } = parseOrThrow(paramsSchema, request.params);
    return app.services.nova.startTask(taskId);
  });

  app.post("/tasks/:taskId/stop", async (request) => {
    const { taskId } = parseOrThrow(paramsSchema, request.params);
    return app.services.nova.stopTask(taskId);
  });

  app.get("/tasks/:taskId/runs", async (request) => {
    const { taskId } = parseOrThrow(paramsSchema, request.params);
    return app.services.nova.getTaskRuns(taskId);
  });
};
