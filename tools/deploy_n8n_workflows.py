#!/usr/bin/env python3
"""
deploy_n8n_workflows.py

Builds and deploys all 5 DealerCRM n8n workflows via the n8n REST API.
Reads n8n credentials from agent_1/.mcp.json automatically.

Usage:
    python tools/deploy_n8n_workflows.py

After running, set these in n8n -> Settings -> Variables:
    SUPABASE_URL              https://ntohjufkraavvvarqiyq.supabase.co
    SUPABASE_SERVICE_ROLE_KEY (from .env)
    ANTHROPIC_API_KEY         (from .env)
    TWILIO_ACCOUNT_SID        (from Twilio)
    TWILIO_AUTH_TOKEN         (from Twilio)
    TWILIO_FROM_NUMBER        (E.164 format)
    SALESPERSON_NAME          Sleiman
    SALESPERSON_PHONE         +15146218017
    SALESPERSON_EMAIL         sleiman@styleauto.ca
    DEALERSHIP_NAME           Style Auto
    DEALERSHIP_CITY           Montreal, QC
    DEALERSHIP_HOURS          Mon-Sat 9am-6pm ET

Then set these after noting the webhook URLs printed by this script:
    WF02_WEBHOOK_URL          (webhook URL for workflow 02)
    WF05_WEBHOOK_URL          (webhook URL for workflow 05)
"""

import json
import os
import sys
import uuid
import requests

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
AGENT1_MCP = os.path.join(PROJECT_DIR, "..", "agent_1", ".mcp.json")
SUPABASE_URL = "https://ntohjufkraavvvarqiyq.supabase.co"


def get_n8n_config():
    with open(AGENT1_MCP) as f:
        mcp = json.load(f)
    env = mcp["mcpServers"]["n8n-mcp"]["env"]
    return env["N8N_API_URL"], env["N8N_API_KEY"]


N8N_URL, N8N_KEY = get_n8n_config()


def api(method, path, **kwargs):
    resp = requests.request(
        method,
        f"{N8N_URL}/api/v1{path}",
        headers={"X-N8N-API-KEY": N8N_KEY, "Content-Type": "application/json"},
        **kwargs,
    )
    resp.raise_for_status()
    return resp.json()


# -- Node helpers --------------------------------------------------------------

def nid():
    return str(uuid.uuid4())


def node(name, type_, params, pos, version=1):
    return {
        "parameters": params,
        "id": nid(),
        "name": name,
        "type": type_,
        "typeVersion": version,
        "position": pos,
    }


SB_HDRS = {
    "parameters": [
        {"name": "apikey", "value": "={{ $env.SUPABASE_SERVICE_ROLE_KEY }}"},
        {"name": "Authorization", "value": "=Bearer {{ $env.SUPABASE_SERVICE_ROLE_KEY }}"},
        {"name": "Content-Type", "value": "application/json"},
    ]
}

SB_HDRS_PREFER = {
    "parameters": [
        {"name": "apikey", "value": "={{ $env.SUPABASE_SERVICE_ROLE_KEY }}"},
        {"name": "Authorization", "value": "=Bearer {{ $env.SUPABASE_SERVICE_ROLE_KEY }}"},
        {"name": "Content-Type", "value": "application/json"},
        {"name": "Prefer", "value": "return=representation"},
    ]
}


def webhook(name, path, pos):
    return node(name, "n8n-nodes-base.webhook", {
        "httpMethod": "POST",
        "path": path,
        "responseMode": "lastNode",
        "responseData": "noData",
    }, pos, version=2)


def http_get(name, url, pos):
    return node(name, "n8n-nodes-base.httpRequest", {
        "method": "GET",
        "url": url,
        "sendHeaders": True,
        "headerParameters": SB_HDRS,
        "options": {},
    }, pos, version=4)


def http_post(name, url, json_body, pos, headers=None):
    return node(name, "n8n-nodes-base.httpRequest", {
        "method": "POST",
        "url": url,
        "sendHeaders": True,
        "headerParameters": headers or SB_HDRS_PREFER,
        "sendBody": True,
        "specifyBody": "json",
        "jsonBody": json_body,
        "options": {},
    }, pos, version=4)


def http_patch(name, url, json_body, pos):
    return node(name, "n8n-nodes-base.httpRequest", {
        "method": "PATCH",
        "url": url,
        "sendHeaders": True,
        "headerParameters": SB_HDRS_PREFER,
        "sendBody": True,
        "specifyBody": "json",
        "jsonBody": json_body,
        "options": {},
    }, pos, version=4)


def code(name, js, pos):
    return node(name, "n8n-nodes-base.code", {"jsCode": js}, pos, version=2)


def if_str(name, left, right, pos):
    return node(name, "n8n-nodes-base.if", {
        "conditions": {
            "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "loose"},
            "conditions": [{
                "id": nid(),
                "leftValue": left,
                "rightValue": right,
                "operator": {"type": "string", "operation": "equals"},
            }],
            "combinator": "and",
        }
    }, pos, version=2)


def schedule(name, minutes, pos):
    return node(name, "n8n-nodes-base.scheduleTrigger", {
        "rule": {"interval": [{"field": "minutes", "minutesInterval": minutes}]}
    }, pos, version=1)


def noop(name, pos):
    return node(name, "n8n-nodes-base.noOp", {}, pos)


def split_batches(name, pos):
    return node(name, "n8n-nodes-base.splitInBatches", {
        "batchSize": 1, "options": {}
    }, pos, version=3)


def respond_ok(name, pos):
    return node(name, "n8n-nodes-base.respondToWebhook", {
        "respondWith": "text", "responseBody": "OK"
    }, pos, version=1)


def twilio_sms(name, to_expr, body_expr, pos):
    return node(name, "n8n-nodes-base.httpRequest", {
        "method": "POST",
        "url": "=https://api.twilio.com/2010-04-01/Accounts/{{ $env.TWILIO_ACCOUNT_SID }}/Messages.json",
        "sendHeaders": True,
        "headerParameters": {"parameters": [
            {"name": "Content-Type", "value": "application/x-www-form-urlencoded"},
        ]},
        "sendBody": True,
        "specifyBody": "form",
        "bodyParameters": {"parameters": [
            {"name": "To",   "value": to_expr},
            {"name": "From", "value": "={{ $env.TWILIO_FROM_NUMBER }}"},
            {"name": "Body", "value": body_expr},
        ]},
        "options": {"response": {"response": {"neverError": True}}},
    }, pos, version=4)


def claude_http(name, json_body_expr, pos):
    return node(name, "n8n-nodes-base.httpRequest", {
        "method": "POST",
        "url": "https://api.anthropic.com/v1/messages",
        "sendHeaders": True,
        "headerParameters": {"parameters": [
            {"name": "x-api-key",          "value": "={{ $env.ANTHROPIC_API_KEY }}"},
            {"name": "anthropic-version",  "value": "2023-06-01"},
            {"name": "Content-Type",       "value": "application/json"},
        ]},
        "sendBody": True,
        "specifyBody": "json",
        "jsonBody": json_body_expr,
        "options": {},
    }, pos, version=4)


def conn(*pairs):
    """Build n8n connections dict. Each pair: (src, dst) or (src, dst, output_idx)."""
    result = {}
    for pair in pairs:
        src, dst = pair[0], pair[1]
        idx = pair[2] if len(pair) > 2 else 0
        result.setdefault(src, {"main": []})
        while len(result[src]["main"]) <= idx:
            result[src]["main"].append([])
        targets = dst if isinstance(dst, list) else [dst]
        for t in targets:
            result[src]["main"][idx].append({"node": t, "type": "main", "index": 0})
    return result


# -- Shared JS snippets --------------------------------------------------------

PARSE_CLAUDE_JS = """
const raw = $input.first().json.content[0].text.trim();
let parsed;
try { parsed = JSON.parse(raw); }
catch(e) {
  parsed = {
    sms_text: "Hi! We'd love to help you find the right vehicle. When's a good time to connect?",
    intent_score: "cold",
    intent_reasoning: "Claude returned invalid JSON — fallback used"
  };
}
return [{ json: { ...($input.first().json._ctx || {}), ...parsed } }];
"""

SYSTEM_PROMPT_EXPR = (
    "=You are an SMS assistant for {{ $env.DEALERSHIP_NAME }} in {{ $env.DEALERSHIP_CITY }}. "
    "Sales contact: {{ $env.SALESPERSON_NAME }}, {{ $env.SALESPERSON_PHONE }}. "
    "Hours: {{ $env.DEALERSHIP_HOURS }}. "
    "RULES: Keep SMS under 160 chars. Professional but warm. No filler phrases. No em dashes. "
    "Always include a clear next step. Sign with first name on first contact only. "
    "Never lie about inventory. "
    "OUTPUT: JSON only — no other text. "
    "{\"sms_text\":\"...\",\"intent_score\":\"hot|warm|cold\",\"intent_reasoning\":\"...\"} "
    "hot=price/availability/test drive/ready to buy. warm=engaged/comparing/questions. cold=vague/no reply."
)


# -- WF01 — Lead Intake --------------------------------------------------------

def wf01():
    normalize_js = """
const b = $input.first().json.body || $input.first().json;
function e164(raw) {
  if (!raw) return null;
  const d = String(raw).replace(/\\D/g, '');
  if (d.length === 10) return '+1' + d;
  if (d.length === 11 && d[0] === '1') return '+' + d;
  return d.length > 7 ? '+' + d : null;
}
const phone = e164(b.phone || b.Phone || b.phone_number || '');
if (!phone) throw new Error('No valid phone — skipping lead');
return [{ json: {
  first_name: b.first_name || b.firstName || 'Unknown',
  last_name:  b.last_name  || b.lastName  || '',
  phone,
  email:            b.email            || '',
  source:           b.source           || 'website',
  vehicle_interest: b.vehicle_interest || b.vehicle || '',
  stage: 'new', demo_mode: true, sequence_step: 0,
} }];
"""

    check_dup_js = """
const rows = $input.first().json;
const exists = Array.isArray(rows) && rows.length > 0;
return [{ json: { exists: String(exists), existing_id: exists ? rows[0].id : null } }];
"""

    SB = SUPABASE_URL
    nodes = [
        webhook("Webhook",        "lead-intake",  [240, 300]),
        code("Normalize Lead",    normalize_js,   [460, 300]),
        http_get("Check Duplicate",
                 f"{SB}/rest/v1/leads?phone=eq.={{{{$json.phone}}}}&select=id",
                 [680, 300]),
        code("Parse Dup Result",  check_dup_js,   [900, 300]),
        if_str("Duplicate?",
               "={{ $json.exists }}", "true",     [1120, 300]),
        http_patch("Update Existing",
                   f"{SB}/rest/v1/leads?id=eq.={{{{$json.existing_id}}}}",
                   '={{ JSON.stringify({ updated_at: new Date().toISOString() }) }}',
                   [1340, 200]),
        http_post("Create Lead",
                  f"{SB}/rest/v1/leads",
                  """={{ JSON.stringify({
  first_name: $('Normalize Lead').first().json.first_name,
  last_name:  $('Normalize Lead').first().json.last_name,
  phone:      $('Normalize Lead').first().json.phone,
  email:      $('Normalize Lead').first().json.email,
  source:     $('Normalize Lead').first().json.source,
  vehicle_interest: $('Normalize Lead').first().json.vehicle_interest,
  stage: 'new', demo_mode: true, sequence_step: 0
}) }}""",
                  [1340, 400]),
        http_post("Trigger WF02",
                  "={{ $env.WF02_WEBHOOK_URL }}",
                  '={{ JSON.stringify({ lead_id: $json[0].id, trigger_type: "first_contact" }) }}',
                  [1560, 400]),
        respond_ok("Respond OK", [1780, 400]),
    ]

    c = conn(
        ("Webhook",           "Normalize Lead"),
        ("Normalize Lead",    "Check Duplicate"),
        ("Check Duplicate",   "Parse Dup Result"),
        ("Parse Dup Result",  "Duplicate?"),
        ("Duplicate?",        "Update Existing", 0),
        ("Duplicate?",        "Create Lead",     1),
        ("Create Lead",       "Trigger WF02"),
        ("Trigger WF02",      "Respond OK"),
    )
    return {"name": "01 DealerCRM — Lead Intake", "nodes": nodes, "connections": c}


# -- WF02 — AI SMS Engine ------------------------------------------------------

def wf02():
    SB = SUPABASE_URL

    build_prompt_js = """
const input   = $input.first().json;
const lead    = $('Get Lead').first().json[0];
const inv_raw = $('Get Inventory').first().json;

const inventoryText = Array.isArray(inv_raw)
  ? inv_raw.filter(v => v.status === 'available')
      .map(v => `${v.year} ${v.make} ${v.model} ${v.trim || ''} — ${v.color || ''} — ${v.mileage ? v.mileage.toLocaleString()+' km' : 'New'} — $${Number(v.price||0).toLocaleString()}`)
      .join('\\n')
  : 'No inventory data';

const instructions = {
  first_contact:    'First message. Briefly introduce yourself, reference vehicle interest if provided, ask one qualifying question. Sign with first name.',
  follow_up_day3:   'No reply in 3 days. Short friendly check-in. One question. Under 100 chars if possible.',
  follow_up_day7:   'No reply in 7 days. Try a different angle — ask about timing or budget, not the specific vehicle.',
  follow_up_day14:  'Two weeks no reply. Last real attempt. Keep it human and low-pressure.',
  follow_up_day30:  'Final follow-up. Acknowledge time passed. Leave the door open.',
  inbound_reply:    'Lead just replied. Respond naturally to what they said. Classify intent based on their message.',
};

const trigger = input.trigger_type || 'first_contact';
const userMsg = `LEAD: ${lead.first_name} ${lead.last_name} | Source: ${lead.source} | Vehicle: ${lead.vehicle_interest || 'not specified'} | Trigger: ${trigger}\\n\\nINVENTORY:\\n${inventoryText}\\n\\nINSTRUCTION: ${instructions[trigger] || instructions.first_contact}`;

return [{ json: {
  _ctx: { lead_id: lead.id, trigger_type: trigger, demo_mode: lead.demo_mode, phone: lead.phone, sequence_step: lead.sequence_step || 0 },
  userMsg, inventoryText, lead,
} }];
"""

    parse_and_enrich_js = """
const raw = $input.first().json.content[0].text.trim();
let parsed;
try { parsed = JSON.parse(raw); }
catch(e) {
  parsed = { sms_text: "Hi! We'd love to help you find the right vehicle. When's a good time to connect?", intent_score: "cold", intent_reasoning: "fallback" };
}
const ctx = $('Build Prompt').first().json._ctx;
const step = ctx.sequence_step || 0;
const days = [3, 4, 7, 16, null];
const nextDays = days[step] ?? null;
const nextFollowUp = nextDays ? new Date(Date.now() + nextDays*86400000).toISOString() : null;
const sms = ctx.demo_mode ? '[DEMO] ' + parsed.sms_text : parsed.sms_text;
return [{ json: {
  ...ctx,
  sms_text: sms,
  raw_sms: parsed.sms_text,
  intent_score: parsed.intent_score || 'cold',
  intent_reasoning: parsed.intent_reasoning || '',
  next_follow_up: nextFollowUp,
  next_step: step + 1,
  now: new Date().toISOString(),
} }];
"""

    nodes = [
        webhook("Webhook", "ai-sms-engine", [240, 300]),
        http_get("Get Lead",
                 f"{SB}/rest/v1/leads?id=eq.={{{{$json.lead_id}}}}&select=*",
                 [460, 200]),
        http_get("Get Inventory",
                 f"{SB}/rest/v1/inventory?status=eq.available&select=*",
                 [460, 400]),
        code("Build Prompt", build_prompt_js, [680, 300]),
        claude_http("Call Claude",
                    f"""={{ JSON.stringify({{
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 256,
  system: '{SYSTEM_PROMPT_EXPR[1:]}',
  messages: [{{ role: 'user', content: $json.userMsg }}]
}}) }}""",
                    [900, 300]),
        code("Parse & Enrich", parse_and_enrich_js, [1120, 300]),
        if_str("Demo Mode?", "={{ String($json.demo_mode) }}", "true", [1340, 300]),
        twilio_sms("Send SMS",
                   "={{ $json.phone }}",
                   "={{ $json.sms_text }}",
                   [1560, 400]),
        http_post("Log SMS",
                  f"{SB}/rest/v1/sms_log",
                  """={{ JSON.stringify({
  lead_id:      $json.lead_id,
  direction:    'outbound',
  body:         $json.sms_text,
  intent_score: $json.intent_score,
  demo:         $json.demo_mode,
  trigger_type: $json.trigger_type
}) }}""",
                  [1780, 300]),
        http_patch("Update Lead",
                   f"{SB}/rest/v1/leads?id=eq.={{{{$('Parse & Enrich').first().json.lead_id}}}}",
                   """={{ JSON.stringify({
  intent_score:   $('Parse & Enrich').first().json.intent_score,
  stage:          $('Parse & Enrich').first().json.intent_score === 'hot' ? 'hot' : undefined,
  sequence_step:  $('Parse & Enrich').first().json.next_step,
  next_follow_up: $('Parse & Enrich').first().json.next_follow_up,
  last_sms_at:    $('Parse & Enrich').first().json.now,
}) }}""",
                   [2000, 300]),
        if_str("Is Hot?", "={{ $('Parse & Enrich').first().json.intent_score }}", "hot", [2220, 300]),
        http_post("Alert Hot Lead",
                  "={{ $env.WF05_WEBHOOK_URL }}",
                  '={{ JSON.stringify({ lead_id: $("Parse & Enrich").first().json.lead_id }) }}',
                  [2440, 200]),
    ]

    c = conn(
        ("Webhook",        "Get Lead"),
        ("Webhook",        "Get Inventory"),
        ("Get Lead",       "Build Prompt"),
        ("Get Inventory",  "Build Prompt"),
        ("Build Prompt",   "Call Claude"),
        ("Call Claude",    "Parse & Enrich"),
        ("Parse & Enrich", "Demo Mode?"),
        ("Demo Mode?",     "Log SMS",   0),    # true: skip Twilio
        ("Demo Mode?",     "Send SMS",  1),    # false: send real
        ("Send SMS",       "Log SMS"),
        ("Log SMS",        "Update Lead"),
        ("Update Lead",    "Is Hot?"),
        ("Is Hot?",        "Alert Hot Lead", 0),
    )
    return {"name": "02 DealerCRM — AI SMS Engine", "nodes": nodes, "connections": c}


# -- WF03 — Inbound SMS Handler ------------------------------------------------

def wf03():
    SB = SUPABASE_URL

    parse_twilio_js = """
const b = $input.first().json.body || $input.first().json;
const msg = (b.Body || b.body || '').trim();
const optOut = ['STOP','UNSUBSCRIBE','QUIT','CANCEL','END'].includes(msg.toUpperCase());
return [{ json: { from_phone: b.From || b.from, message_body: msg, is_opt_out: String(optOut) } }];
"""

    build_inbound_js = """
const data    = $('Parse Twilio').first().json;
const lead    = $('Find Lead').first().json[0];
const history = $('Get History').first().json;
const hist_txt = Array.isArray(history)
  ? history.map(m => `${m.direction === 'outbound' ? 'AI' : 'CUSTOMER'}: ${m.body}`).join('\\n')
  : '';
const userMsg = `LEAD: ${lead.first_name} ${lead.last_name} | Vehicle: ${lead.vehicle_interest || 'not specified'}\\nRecent messages:\\n${hist_txt}\\nCustomer just said: ${data.message_body}\\nInstruction: Respond naturally. Classify intent.`;
return [{ json: { lead, lead_id: lead.id, demo_mode: lead.demo_mode, from_phone: data.from_phone, message_body: data.message_body, userMsg } }];
"""

    parse_inbound_js = """
const raw = $input.first().json.content[0].text.trim();
let parsed;
try { parsed = JSON.parse(raw); }
catch(e) { parsed = { sms_text: "Thanks! I'll get back to you shortly.", intent_score: 'cold', intent_reasoning: 'fallback' }; }

const ctx = $('Build Inbound Prompt').first().json;
const score = parsed.intent_score || 'cold';
const stageMap = { hot: 'hot', warm: 'warm', cold: 'needs_reply' };
const newStage = stageMap[score] || 'needs_reply';
const nextFU = score === 'cold' ? new Date(Date.now() + 3*86400000).toISOString() : null;
const reply = ctx.demo_mode ? '[DEMO] ' + parsed.sms_text : parsed.sms_text;
return [{ json: {
  ...ctx,
  intent_score: score,
  new_stage: newStage,
  next_follow_up: nextFU,
  sms_reply: reply,
  raw_reply: parsed.sms_text,
} }];
"""

    nodes = [
        webhook("Twilio Webhook", "inbound-sms", [240, 300]),
        code("Parse Twilio", parse_twilio_js, [460, 300]),
        http_get("Find Lead",
                 f"{SB}/rest/v1/leads?phone=eq.={{{{$json.from_phone}}}}&select=*",
                 [680, 300]),
        if_str("Opt-out?", "={{ $('Parse Twilio').first().json.is_opt_out }}", "true", [900, 300]),
        http_patch("Mark Opted Out",
                   f"{SB}/rest/v1/leads?phone=eq.={{{{$('Parse Twilio').first().json.from_phone}}}}",
                   '={{ JSON.stringify({ opted_out: true, stage: "unsubscribed", next_follow_up: null }) }}',
                   [1120, 200]),
        http_post("Log Inbound",
                  f"{SB}/rest/v1/sms_log",
                  """={{ JSON.stringify({
  lead_id:   $('Find Lead').first().json[0].id,
  direction: 'inbound',
  body:      $('Parse Twilio').first().json.message_body,
  demo:      $('Find Lead').first().json[0].demo_mode
}) }}""",
                  [1120, 400]),
        http_patch("Update Last Reply",
                   f"{SB}/rest/v1/leads?id=eq.={{{{$('Find Lead').first().json[0].id}}}}",
                   '={{ JSON.stringify({ last_reply_at: new Date().toISOString() }) }}',
                   [1340, 400]),
        http_get("Get History",
                 f"{SB}/rest/v1/sms_log?lead_id=eq.={{{{$('Find Lead').first().json[0].id}}}}&order=sent_at.desc&limit=3&select=direction,body",
                 [1560, 400]),
        code("Build Inbound Prompt", build_inbound_js, [1780, 400]),
        claude_http("Claude — Inbound",
                    """={{ JSON.stringify({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 256,
  system: 'SMS assistant for ' + $env.DEALERSHIP_NAME + '. Be natural. JSON only: {sms_text,intent_score,intent_reasoning}. hot=ready to buy/test drive, warm=engaged, cold=vague.',
  messages: [{ role: 'user', content: $json.userMsg }]
}) }}""",
                    [2000, 400]),
        code("Parse Inbound Response", parse_inbound_js, [2220, 400]),
        http_patch("Update Lead Stage",
                   f"{SB}/rest/v1/leads?id=eq.={{{{$json.lead_id}}}}",
                   """={{ JSON.stringify({
  stage:          $json.new_stage,
  intent_score:   $json.intent_score,
  next_follow_up: $json.next_follow_up,
  last_reply_at:  new Date().toISOString()
}) }}""",
                   [2440, 400]),
        if_str("Is Hot?", "={{ $json.intent_score }}", "hot", [2660, 400]),
        http_post("Alert Hot Lead",
                  "={{ $env.WF05_WEBHOOK_URL }}",
                  '={{ JSON.stringify({ lead_id: $json.lead_id }) }}',
                  [2880, 300]),
        if_str("Send Real SMS?", "={{ String($json.demo_mode) }}", "false", [2660, 550]),
        twilio_sms("Twilio — Reply",
                   "={{ $json.from_phone }}",
                   "={{ $json.sms_reply }}",
                   [2880, 550]),
        http_post("Log Outbound Reply",
                  f"{SB}/rest/v1/sms_log",
                  """={{ JSON.stringify({
  lead_id:      $('Parse Inbound Response').first().json.lead_id,
  direction:    'outbound',
  body:         $('Parse Inbound Response').first().json.sms_reply,
  intent_score: $('Parse Inbound Response').first().json.intent_score,
  demo:         $('Parse Inbound Response').first().json.demo_mode,
  trigger_type: 'inbound_reply'
}) }}""",
                  [3100, 500]),
    ]

    c = conn(
        ("Twilio Webhook",       "Parse Twilio"),
        ("Parse Twilio",         "Find Lead"),
        ("Find Lead",            "Opt-out?"),
        ("Opt-out?",             "Mark Opted Out",   0),
        ("Opt-out?",             "Log Inbound",      1),
        ("Log Inbound",          "Update Last Reply"),
        ("Update Last Reply",    "Get History"),
        ("Get History",          "Build Inbound Prompt"),
        ("Build Inbound Prompt", "Claude — Inbound"),
        ("Claude — Inbound",     "Parse Inbound Response"),
        ("Parse Inbound Response", "Update Lead Stage"),
        ("Update Lead Stage",    "Is Hot?"),
        ("Update Lead Stage",    "Send Real SMS?"),
        ("Is Hot?",              "Alert Hot Lead",   0),
        ("Send Real SMS?",       "Twilio — Reply",   0),
        ("Twilio — Reply",       "Log Outbound Reply"),
        ("Send Real SMS?",       "Log Outbound Reply", 1),
    )
    return {"name": "03 DealerCRM — Inbound SMS Handler", "nodes": nodes, "connections": c}


# -- WF04 — Sequence Scheduler -------------------------------------------------

def wf04():
    SB = SUPABASE_URL

    map_step_js = """
const lead = $input.first().json;
const step = lead.sequence_step || 0;
const triggerMap = {0:'first_contact',1:'follow_up_day3',2:'follow_up_day7',3:'follow_up_day14',4:'follow_up_day30'};
return [{ json: {
  lead_id:         lead.id,
  trigger_type:    triggerMap[step] || 'follow_up_day30',
  is_sequence_end: String(step >= 4),
} }];
"""

    nodes = [
        schedule("Every 15 Min", 15, [240, 300]),
        http_get("Get Due Leads",
                 f"{SB}/rest/v1/leads?next_follow_up=lte.{{{{new Date().toISOString()}}}}&opted_out=eq.false&stage=not.in.(hot,closed,unsubscribed,lost)&select=id,first_name,last_name,phone,sequence_step,stage",
                 [460, 300]),
        split_batches("Each Lead", [680, 300]),
        code("Map Step", map_step_js, [900, 300]),
        if_str("Sequence Done?", "={{ $json.is_sequence_end }}", "true", [1120, 300]),
        http_patch("Close Lead",
                   f"{SB}/rest/v1/leads?id=eq.={{{{$json.lead_id}}}}",
                   '={{ JSON.stringify({ stage: "closed", next_follow_up: null }) }}',
                   [1340, 200]),
        http_post("Trigger WF02",
                  "={{ $env.WF02_WEBHOOK_URL }}",
                  '={{ JSON.stringify({ lead_id: $json.lead_id, trigger_type: $json.trigger_type }) }}',
                  [1340, 400]),
    ]

    c = conn(
        ("Every 15 Min", "Get Due Leads"),
        ("Get Due Leads", "Each Lead"),
        ("Each Lead",     "Map Step"),
        ("Map Step",      "Sequence Done?"),
        ("Sequence Done?", "Close Lead",    0),
        ("Sequence Done?", "Trigger WF02",  1),
    )
    return {"name": "04 DealerCRM — Sequence Scheduler", "nodes": nodes, "connections": c}


# -- WF05 — Hot Lead Alert -----------------------------------------------------

def wf05():
    SB = SUPABASE_URL

    build_alert_js = """
const lead = $('Get Lead').first().json[0];
const sms = `HOT LEAD: ${lead.first_name} ${lead.last_name} (${lead.phone}) — interested in ${lead.vehicle_interest || 'a vehicle'}. Reply now!`;
return [{ json: {
  lead, lead_id: lead.id,
  already_alerted: String(lead.salesperson_alerted || false),
  sms_alert: sms,
} }];
"""

    nodes = [
        webhook("Hot Lead Webhook", "hot-lead-alert", [240, 300]),
        http_get("Get Lead",
                 f"{SB}/rest/v1/leads?id=eq.={{{{$json.lead_id}}}}&select=*",
                 [460, 300]),
        code("Build Alert", build_alert_js, [680, 300]),
        if_str("Already Alerted?", "={{ $json.already_alerted }}", "true", [900, 300]),
        noop("Stop — Already Alerted", [1120, 200]),
        twilio_sms("SMS to Salesperson",
                   "={{ $env.SALESPERSON_PHONE }}",
                   "={{ $json.sms_alert }}",
                   [1120, 400]),
        http_patch("Mark Alerted",
                   f"{SB}/rest/v1/leads?id=eq.={{{{$json.lead_id}}}}",
                   '={{ JSON.stringify({ salesperson_alerted: true, stage: "hot" }) }}',
                   [1340, 400]),
    ]

    c = conn(
        ("Hot Lead Webhook",    "Get Lead"),
        ("Get Lead",           "Build Alert"),
        ("Build Alert",        "Already Alerted?"),
        ("Already Alerted?",   "Stop — Already Alerted", 0),
        ("Already Alerted?",   "SMS to Salesperson",     1),
        ("SMS to Salesperson", "Mark Alerted"),
    )
    return {"name": "05 DealerCRM — Hot Lead Alert", "nodes": nodes, "connections": c}


# -- Deploy --------------------------------------------------------------------

SETTINGS = {
    "executionOrder": "v1",
    "saveManualExecutions": True,
    "callerPolicy": "workflowsFromSameOwner",
}


def deploy(wf_def):
    payload = {"name": wf_def["name"], "nodes": wf_def["nodes"], "connections": wf_def["connections"], "settings": SETTINGS}
    existing = api("GET", "/workflows?limit=250").get("data", [])
    match = next((w for w in existing if w["name"] == wf_def["name"]), None)
    if match:
        api("DELETE", f"/workflows/{match['id']}")
        print(f"  Replaced: {wf_def['name']}")
    result = api("POST", "/workflows", json=payload)
    print(f"  Created: {wf_def['name']} (id={result['id']})")
    return result


def main():
    print(f"Connecting to n8n at {N8N_URL}...\n")

    workflows = [wf01(), wf02(), wf03(), wf04(), wf05()]
    created = []
    for wf in workflows:
        try:
            created.append(deploy(wf))
        except Exception as e:
            print(f"  FAILED: {wf['name']} — {e}")
            sys.exit(1)

    print("\n-- Webhook URLs ------------------------------------------")
    for wf in created:
        for n in wf.get("nodes", []):
            if n["type"] == "n8n-nodes-base.webhook":
                path = n["parameters"].get("path", "")
                print(f"  {wf['name']}")
                print(f"    Test URL:       {N8N_URL}/webhook-test/{path}")
                print(f"    Production URL: {N8N_URL}/webhook/{path}")

    print("\n-- Next steps --------------------------------------------")
    print("1. Set all env vars in n8n -> Settings -> Variables (see script header)")
    print("2. Copy WF02 production URL -> set as WF02_WEBHOOK_URL in n8n vars")
    print("3. Copy WF05 production URL -> set as WF05_WEBHOOK_URL in n8n vars")
    print("4. Point Twilio inbound webhook -> WF03 production URL")
    print("5. Activate in order: 05 -> 04 -> 03 -> 02 -> 01")
    print("6. Test: python tools/simulate_lead.py")


if __name__ == "__main__":
    main()
