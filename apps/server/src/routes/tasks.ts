import { z } from "zod";
import type { FastifyPluginAsync } from "fastify";
import mime from "mime-types";
import { THINKING_LEVELS } from "@nova/shared";
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
  handoffAgentId: z.string().uuid().nullable().optional(),
  executionTargetOverride: z.string().nullable().optional(),
  useGitWorktree: z.boolean().optional(),
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
  body: z.string().optional().default(""),
  thinkingLevel: z.enum(THINKING_LEVELS).nullable().optional(),
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
    return app.services.nova.createTask({
      ...body,
      createdBy: request.authSession?.user.displayName ?? body.createdBy,
    });
  });

  app.patch("/tasks/:taskId", async (request) => {
    const { taskId } = parseOrThrow(paramsSchema, request.params);
    const body = parseOrThrow(patchTaskSchema, request.body);
    return app.services.nova.patchTask(taskId, body);
  });

  app.delete("/tasks/:taskId", async (request, reply) => {
    const { taskId } = parseOrThrow(paramsSchema, request.params);
    await app.services.nova.deleteTask(taskId);
    return reply.code(204).send();
  });

  app.post("/tasks/:taskId/comments", async (request) => {
    const { taskId } = parseOrThrow(paramsSchema, request.params);

    if (request.isMultipart()) {
      const fields: Record<string, string> = {};
      const attachments: Array<{
        fileName: string;
        mimeType: string;
        buffer: Buffer;
      }> = [];

      for await (const part of request.parts()) {
        if (part.type === "file") {
          const buffer = await part.toBuffer();

          attachments.push({
            fileName: part.filename || "attachment",
            mimeType:
              part.mimetype || mime.lookup(part.filename || "") || "application/octet-stream",
            buffer,
          });
          continue;
        }

        fields[part.fieldname] = String(part.value ?? "");
      }

      const body = parseOrThrow(addCommentSchema, {
        authorType: fields.authorType || undefined,
        authorId: fields.authorId === "" ? null : fields.authorId ?? undefined,
        body: fields.body ?? "",
        thinkingLevel: fields.thinkingLevel ?? undefined,
      });

      if (!body.authorType || body.authorType === "user") {
        return app.services.nova.addTaskComment(taskId, {
          ...body,
          authorType: "user",
          authorId: request.authSession?.user.displayName ?? body.authorId ?? null,
          attachments,
        });
      }

      return app.services.nova.addTaskComment(taskId, {
        ...body,
        attachments,
      });
    }

    const body = parseOrThrow(addCommentSchema, request.body);

    if (!body.authorType || body.authorType === "user") {
      return app.services.nova.addTaskComment(taskId, {
        ...body,
        authorType: "user",
        authorId: request.authSession?.user.displayName ?? body.authorId ?? null,
      });
    }

    return app.services.nova.addTaskComment(taskId, body);
  });

  app.get("/tasks/:taskId/comments", async (request) => {
    const { taskId } = parseOrThrow(paramsSchema, request.params);
    return app.services.nova.getTaskComments(taskId);
  });

  app.get(
    "/tasks/:taskId/comments/:commentId/attachments/:attachmentId/content",
    async (request, reply) => {
      const { taskId } = parseOrThrow(paramsSchema, request.params);
      const commentParams = parseOrThrow(
        z.object({
          taskId: z.string().uuid(),
          commentId: z.string().uuid(),
          attachmentId: z.string().uuid(),
        }),
        request.params
      );

      const file = await app.services.nova.getTaskCommentAttachmentContent(
        taskId,
        commentParams.commentId,
        commentParams.attachmentId
      );

      reply.header("Content-Type", file.mimeType);
      reply.header("Content-Disposition", `inline; filename="${file.fileName}"`);
      return reply.send(file.buffer);
    }
  );

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
