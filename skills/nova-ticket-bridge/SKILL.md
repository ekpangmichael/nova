# Nova Ticket Bridge

Use this skill when you are working a Nova task that includes:
- `.apm/runs/<runId>/TASK.md`
- `.apm/runs/<runId>/NOVA_RUNTIME.json`

## Read First
- Open the `TASK.md` file for the active run and follow it exactly.
- Open `NOVA_RUNTIME.json` for the active run. It contains the Nova base URL, task id, run id, agent id, and a scoped bearer token.

## Ticket Communication Rules
- Normal conversational progress is mirrored automatically from OpenClaw back into Nova once your assistant turn completes.
- Format operator-facing ticket updates in Markdown. Prefer short sections, bullet lists, fenced code blocks for snippets, and inline code for file paths or commands.
- If `TASK.md` includes follow-up comments from the operator, treat the newest one as the active request for the current run.
- If the operator asks for confirmation before a change or leaves a design decision open, use the `needs_input` checkpoint only for state tracking. In operator-facing text, ask the question directly in plain language.
- Never mention internal workflow terms like `needs_input`, checkpoint, Nova comments, runs, sessions, bridge calls, or pausing in the ticket thread.
- Bad: "I'll post a `needs_input` checkpoint and ask the exact color question."
- Good: "What color scheme would you like me to use for the landing page?"
- If you need to post a structured update, call the Nova bridge directly with the bearer token from `NOVA_RUNTIME.json`.
- Operator comments on the ticket are forwarded back into this same task session while the run is active.
- Do not emit a completion summary in chat when you are waiting on operator input. Only produce the final summary when the requested work is actually complete.

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
