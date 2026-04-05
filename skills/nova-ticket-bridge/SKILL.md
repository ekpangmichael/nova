# Nova Ticket Bridge

Use this skill when you are working a Nova task that includes:
- `.apm/runs/<runId>/TASK.md`
- `.apm/runs/<runId>/NOVA_RUNTIME.json`

## Read First
- Open the `TASK.md` file for the active run and follow it exactly.
- Open `NOVA_RUNTIME.json` for the active run. It contains the Nova base URL, task id, run id, agent id, and a scoped bearer token.
- If `TASK.md` provides a task branch, stay on that branch for this task and all follow-up runs. Do not create a different branch unless the operator explicitly asks.

## Ticket Communication Rules
- Use the ticket comment thread only for operator-facing communication: questions, blockers, approval requests, and the final completed handoff.
- Do not use the ticket thread as a running diary. Keep internal progress, narration, and step-by-step thinking inside the runtime stream and execution log.
- Format operator-facing ticket updates in Markdown. Prefer short sections, bullet lists, fenced code blocks for snippets, and inline code for file paths or commands.
- If `TASK.md` includes follow-up comments from the operator, treat the newest one as the active request for the current run.
- If the operator asks for confirmation before a change or leaves a design decision open, use the `needs_input` checkpoint only for state tracking. In operator-facing text, ask the question directly in plain language.
- Never mention internal workflow terms like `needs_input`, checkpoint, Nova comments, runs, sessions, bridge calls, or pausing in the ticket thread.
- Bad: "I'll post a `needs_input` checkpoint and ask the exact color question."
- Good: "What color scheme would you like me to use for the landing page?"
- If you need to post a structured update, call the Nova bridge directly with the bearer token from `NOVA_RUNTIME.json`.
- Operator comments on the ticket are forwarded back into this same task session while the run is active.
- Do not emit a completion summary in chat when you are waiting on operator input. Only produce the final summary when the requested work is actually complete.
- When the work is complete, include the task branch name and branch link if available, then ask the operator whether you should open a pull request from that branch.
- If the operator explicitly asks you to create a pull request, create it from the current task branch and share the PR URL in the ticket handoff.

## Endpoints
- `POST /api/agent-runtime/tasks/<taskId>/comments`
- `POST /api/agent-runtime/tasks/<taskId>/checkpoints`
- `POST /api/agent-runtime/tasks/<taskId>/artifacts`

## Comment Payload
```json
{ "body": "Short agent update for the operator." }
```

## Checkpoint Payload
```json
{ "state": "working", "summary": "Implemented the API route", "details": "Need one more DB migration." }
```

Allowed states:
- `working`
- `blocked`
- `needs_input`

## Artifact Payload
```json
{ "kind": "modified", "path": "/absolute/or/relative/path", "label": "Server patch", "summary": "Fastify route + tests" }
```

Artifact paths must stay under the task execution target or the staged run directory.

## Auth
Use:
```text
Authorization: Bearer <token from NOVA_RUNTIME.json>
```
