# Anonymous Install Telemetry

Nova sends a very small, anonymous ping to the maintainer's collector so we can see how many people are running Nova. It is enabled by default, contains nothing personal, and can be turned off with one env var.

## What gets sent

One `POST` request per startup, and one per 24 hours while the server stays up:

```json
{
  "event": "startup",
  "instanceId": "550e8400-e29b-41d4-a716-446655440000",
  "version": "0.1.0",
  "platform": "darwin",
  "arch": "arm64",
  "nodeVersion": "v24.14.0",
  "hostHash": "3fa9c2d7b1a0",
  "timestamp": "2026-04-19T15:30:00.000Z"
}
```

Field by field:

| Field | What it is |
|---|---|
| `event` | `"startup"` or `"heartbeat"` |
| `instanceId` | Random UUID generated once and saved to `${NOVA_APP_DATA_DIR}/instance-id`. Not derived from anything identifying. |
| `version` | Nova version from `apps/server/package.json` |
| `platform` | `darwin`, `linux`, or `win32` |
| `arch` | `arm64`, `x64`, etc. |
| `nodeVersion` | The Node runtime version Nova is running on |
| `hostHash` | Short SHA-256 prefix of `hostname::instanceId`. Lets the collector deduplicate containers that share a host without revealing the hostname itself. Not reversible. |
| `timestamp` | ISO 8601 |

## What does **not** get sent

* No project names, task names, or descriptions
* No file paths
* No user names, emails, or session data
* No IP address (the collector sees the request IP, but Nova does not include it in the payload)
* No runtime configurations or API keys
* Nothing about what agents are doing

## Opting out

Set `NOVA_TELEMETRY=0` in your `.env.local` (or pass it as an env var) and restart Nova. That's it, no further action needed.

## Redirecting to your own collector

If you run a fork of Nova or want pings to go to your own endpoint instead of the default one, set:

```bash
NOVA_TELEMETRY_ENDPOINT=https://your-collector.example.com/nova-install
```

This overrides the default for the install it's set on. The request is fire-and-forget with a 5 second timeout. Nova never blocks startup on it and never surfaces telemetry errors to users.

## Running a collector

You just need something that accepts a `POST` with a JSON body. A few free options:

### Cloudflare Worker (simplest)

```js
// wrangler.toml creates a Worker bound to a KV namespace named INSTALLS
export default {
  async fetch(request, env) {
    if (request.method !== "POST") return new Response("ok");
    const body = await request.json();
    const key = `${body.instanceId}:${new Date().toISOString().slice(0, 10)}`;
    await env.INSTALLS.put(key, JSON.stringify({
      version: body.version,
      platform: body.platform,
      arch: body.arch,
      event: body.event,
      ts: body.timestamp,
    }));
    return new Response("ok");
  }
};
```

Free tier is generous (100k writes/day). Unique `instanceId` values per day give you a clean install + active-user count without user tracking.

### PostHog

PostHog's free tier accepts events directly. Use a capture endpoint like `https://app.posthog.com/capture/` and wrap the payload in PostHog's expected shape. Self-hosted PostHog works the same way.

### Vercel serverless function

A 10-line Next.js/Vercel route handler writing to Vercel KV or a Postgres table works too. Same shape as the Worker.

## Counting active installs

Because `instanceId` is stable per install, you can derive:

* **Total installs ever**: distinct `instanceId` values seen
* **Active installs (last 30 days)**: distinct `instanceId` values with a ping in the last 30 days
* **Version breakdown**: count of each `version` among active installs
* **Platform split**: count of each `platform` among active installs

`hostHash` is the dedupe key for container churn (ephemeral containers generate new instance IDs; `hostHash` collapses those back to one logical host).
