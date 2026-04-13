import test from "node:test";
import assert from "node:assert/strict";

import {
  formatShiftWindow,
  hasLeadRepliedSinceAssignment,
  isRepWorking,
  parseTimeInputToMinutes,
  pickRoundRobinRep,
  shouldAutoEngageLead,
  shouldReassignLead,
} from "../src/lib/shiftAssignments.js";

test("parseTimeInputToMinutes parses standard time input", () => {
  assert.equal(parseTimeInputToMinutes("09:00"), 540);
  assert.equal(parseTimeInputToMinutes("17:30"), 1050);
  assert.equal(parseTimeInputToMinutes("invalid"), null);
});

test("formatShiftWindow renders readable ranges", () => {
  assert.equal(formatShiftWindow(540, 1020), "09:00 - 17:00");
});

test("isRepWorking respects configured shifts", () => {
  const rep = {
    active: true,
    shift_start_minutes: 540,
    shift_end_minutes: 1020,
    shift_timezone: "America/Toronto",
  };

  assert.equal(isRepWorking(rep, new Date("2026-04-13T16:00:00.000Z")), true);
  assert.equal(isRepWorking(rep, new Date("2026-04-13T23:30:00.000Z")), false);
});

test("pickRoundRobinRep rotates only across overlapping on-shift reps", () => {
  const reps = [
    { id: "rep-1", name: "Alice", active: true, rr_order: 0, shift_start_minutes: 540, shift_end_minutes: 1020, shift_timezone: "America/Toronto" },
    { id: "rep-2", name: "Bea", active: true, rr_order: 1, shift_start_minutes: 780, shift_end_minutes: 1140, shift_timezone: "America/Toronto" },
    { id: "rep-3", name: "Cara", active: true, rr_order: 2, shift_start_minutes: 1080, shift_end_minutes: 1320, shift_timezone: "America/Toronto" },
  ];

  const overlapTime = new Date("2026-04-13T18:00:00.000Z");
  const firstPick = pickRoundRobinRep(reps, { rrIndex: 0, now: overlapTime });
  const secondPick = pickRoundRobinRep(reps, { rrIndex: firstPick.nextIndex, now: overlapTime });

  assert.equal(firstPick.available.map((rep) => rep.id).join(","), "rep-1,rep-2");
  assert.equal(firstPick.assignedRep.id, "rep-1");
  assert.equal(secondPick.assignedRep.id, "rep-2");
});

test("shouldAutoEngageLead waits four hours for human follow-up", () => {
  const now = new Date("2026-04-13T17:00:00.000Z");
  const lead = {
    assigned_at: "2026-04-13T12:30:00.000Z",
    rep_response_at: null,
    autopilot_active: false,
  };

  assert.equal(shouldAutoEngageLead(lead, now), true);
  assert.equal(shouldAutoEngageLead({ ...lead, autopilot_active: true }, now), false);
  assert.equal(shouldAutoEngageLead({ ...lead, rep_response_at: "2026-04-13T14:00:00.000Z" }, now), false);
});

test("shouldReassignLead waits three days and stops if the lead replied", () => {
  const now = new Date("2026-04-16T17:01:00.000Z");
  const baseLead = {
    assigned_at: "2026-04-13T17:00:00.000Z",
    rep_response_at: null,
    last_reply_at: null,
  };

  assert.equal(shouldReassignLead(baseLead, now), true);
  assert.equal(shouldReassignLead({ ...baseLead, last_reply_at: "2026-04-14T12:00:00.000Z" }, now), false);
  assert.equal(hasLeadRepliedSinceAssignment({ ...baseLead, last_reply_at: "2026-04-14T12:00:00.000Z" }), true);
});
