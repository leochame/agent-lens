#!/usr/bin/env node
const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const os = require('node:os');
const path = require('node:path');

function readClaudeEnv() {
  const file = path.join(os.homedir(), '.claude', 'settings.json');
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return parsed.env && typeof parsed.env === 'object' ? parsed.env : {};
  } catch {
    return {};
  }
}

function joinUrl(base, suffix) {
  return `${String(base || '').replace(/\/+$/, '')}${suffix}`;
}

function parseJsonMaybe(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractText(body) {
  if (!body || typeof body !== 'object') return '';
  if (typeof body.text === 'string') return body.text;
  if (Array.isArray(body.content)) {
    return body.content
      .map((item) => {
        if (!item || typeof item !== 'object') return '';
        if (typeof item.text === 'string') return item.text;
        if (item.type === 'text' && typeof item.content === 'string') return item.content;
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  if (body.message && typeof body.message === 'object') return extractText(body.message);
  return '';
}

function redactHeaders(headers) {
  return Object.fromEntries(Object.entries(headers).map(([key, value]) => {
    if (/authorization|x-api-key|cookie/i.test(key)) return [key, '<redacted>'];
    return [key, value];
  }));
}

function requestJson(url, { method = 'GET', headers = {}, body, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const client = target.protocol === 'https:' ? https : http;
    const req = client.request({
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (target.protocol === 'https:' ? 443 : 80),
      method,
      path: `${target.pathname}${target.search}`,
      headers,
      timeout: timeoutMs
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve({ statusCode: res.statusCode || 0, headers: res.headers, text, json: parseJsonMaybe(text) });
      });
    });
    req.on('timeout', () => req.destroy(new Error(`request timed out after ${timeoutMs}ms`)));
    req.on('error', reject);
    if (body !== undefined) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

async function main() {
  const claudeEnv = readClaudeEnv();
  const baseUrl = process.env.AGENTLENS_SMOKE_ANTHROPIC_BASE_URL
    || process.env.ANTHROPIC_BASE_URL
    || claudeEnv.ANTHROPIC_BASE_URL
    || 'http://127.0.0.1:5290/anthropic';
  const model = process.env.AGENTLENS_SMOKE_MODEL
    || process.env.ANTHROPIC_MODEL
    || claudeEnv.ANTHROPIC_MODEL
    || 'glm-5.1';
  const token = process.env.AGENTLENS_SMOKE_AUTH_TOKEN
    || process.env.ANTHROPIC_AUTH_TOKEN
    || process.env.ANTHROPIC_API_KEY
    || claudeEnv.ANTHROPIC_AUTH_TOKEN
    || claudeEnv.ANTHROPIC_API_KEY
    || 'any-value';
  const timeoutMs = Number(process.env.AGENTLENS_SMOKE_TIMEOUT_MS || claudeEnv.API_TIMEOUT_MS || process.env.API_TIMEOUT_MS || 120000);
  const messagesUrl = joinUrl(baseUrl, '/v1/messages');
  const adminBase = new URL(baseUrl);
  const adminUrl = `${adminBase.protocol}//${adminBase.host}/__admin/api/config`;
  const requestBody = {
    model,
    max_tokens: 32,
    messages: [{ role: 'user', content: 'Reply with exactly OK.' }]
  };

  console.log(`[smoke] target=${messagesUrl}`);
  console.log(`[smoke] model=${model}`);
  console.log(`[smoke] timeoutMs=${timeoutMs}`);

  try {
    const configResponse = await requestJson(adminUrl, { timeoutMs: Math.min(timeoutMs, 5000) });
    if (configResponse.statusCode === 200 && configResponse.json) {
      const routes = configResponse.json.routing?.routes || [];
      const route = routes.find((item) => item.pathPrefix === '/anthropic');
      console.log('[smoke] live /anthropic route=' + JSON.stringify(route || null));
      if (route?.provider && configResponse.json.providers?.[route.provider]) {
        const provider = configResponse.json.providers[route.provider];
        const authMode = provider.authMode === 'passthrough'
          ? 'passthrough'
          : `${provider.authMode?.type || 'unknown'}:${provider.authMode?.header || ''}`;
        console.log('[smoke] live provider=' + JSON.stringify({ name: route.provider, baseURL: provider.baseURL, authMode }));
      }
    } else {
      console.log(`[smoke] config check skipped: status=${configResponse.statusCode}`);
    }
  } catch (error) {
    console.log(`[smoke] config check failed: ${error && error.message ? error.message : String(error)}`);
  }

  const headers = {
    'content-type': 'application/json',
    'anthropic-version': '2023-06-01',
    'authorization': `Bearer ${token}`
  };

  const startedAt = Date.now();
  let response;
  try {
    response = await requestJson(messagesUrl, { method: 'POST', headers, body: requestBody, timeoutMs });
  } catch (error) {
    console.error('[smoke] FAIL transport_error=' + (error && error.message ? error.message : String(error)));
    process.exit(1);
  }

  const elapsedMs = Date.now() - startedAt;
  console.log(`[smoke] response status=${response.statusCode} elapsedMs=${elapsedMs}`);
  console.log('[smoke] response headers=' + JSON.stringify(redactHeaders(response.headers)));

  if (response.statusCode < 200 || response.statusCode >= 300) {
    console.error('[smoke] FAIL non_2xx body=' + response.text.slice(0, 2000));
    process.exit(1);
  }
  if (!response.json) {
    console.error('[smoke] FAIL non_json body=' + response.text.slice(0, 2000));
    process.exit(1);
  }
  const text = extractText(response.json);
  if (!text.trim()) {
    console.error('[smoke] FAIL empty_message body=' + JSON.stringify(response.json).slice(0, 2000));
    process.exit(1);
  }

  console.log('[smoke] PASS text=' + JSON.stringify(text.slice(0, 500)));
}

main().catch((error) => {
  console.error('[smoke] FAIL unexpected=' + (error && error.stack ? error.stack : String(error)));
  process.exit(1);
});
