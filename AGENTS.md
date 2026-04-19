# AGENTS Rules

## Proxy And Archive Rules

- Response capture is intentionally unlimited when request archiving is enabled.
- Do not treat `archiveRequests=true` with `maxCaptureBytes=0` as a bug by default.
- If this behavior changes in code review or refactors, preserve the product decision unless the requirement itself is changed explicitly.

## Admin Log Viewer Product Requirements

- The admin module is primarily a request/response log viewer for OpenAI and Anthropic traffic, and the UI should optimize for human-readable inspection.
- Request and response records must remain one-to-one by `requestId`; any UI aggregation must preserve that pairing.
- The request-side primary view must focus on `body.text` from the archived request payload.
- When `body.text` is JSON or JSON-encoded text, the frontend should recursively parse it for display only.
- Request display logic must not mutate, normalize, redact, or rewrite the archived request content.
- The response-side primary view must focus on the response text content that users actually care about.
- For SSE responses, the frontend may aggregate stream chunks into a single response object for display only.
- Except for SSE aggregation needed for display, response rendering must not mutate, normalize, redact, or rewrite archived response content.
- Log archiving must preserve the original request/response payloads without modification.
- `archiveRequests` is a product toggle controlled from the frontend admin UI.
- Toggling `archiveRequests` controls whether raw request/response payloads are archived; it must not silently redefine the product requirement that logs are viewable in admin.
- When `archiveRequests` is disabled, raw request/response payloads must not be archived, retained locally as detail payloads, or reconstructed later from summary logs.
- The admin frontend must display only records that have archived request/response detail available; if a record is not archived, it should not appear as a viewable detail item.
- The routing module must allow configuring upstream URL and API key/secret for both OpenAI and Anthropic style routes.
- After optional archive capture, forwarding must remain transparent; the proxy must not do extra post-archive processing on the request before forwarding.
- If implementation and product intent diverge, preserve raw archive fidelity first, then build display-specific transforms strictly in the frontend layer.
