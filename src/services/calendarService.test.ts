// src/services/calendarService.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatCalendarEvent } from './calendarService';
import type { Task } from '../types/models';
import {
  createOAuthState,
  decryptToken,
  encryptToken,
  verifyOAuthState,
} from '../../supabase/functions/_shared/crypto.ts';

describe('Milestone 7 — Calendar Event Creation & Mapping Rules', () => {
  it('Case A: Date-only task creates an all-day event with exclusive next-day end', () => {
    const task = {
      title: 'Submit Tax Documents',
      description: 'Prepare Q4 receipts and declarations',
      scheduledDate: '2026-11-24',
      scheduledStartTime: null,
      plannedDurationMinutes: null,
    };

    const event = formatCalendarEvent(task, 'Asia/Kolkata', 60);
    assert.ok(event !== null, 'Event should be created');
    assert.equal(event.summary, 'Submit Tax Documents');
    assert.equal(event.description, 'Prepare Q4 receipts and declarations');
    assert.equal(event.start.date, '2026-11-24');
    // Exclusive next calendar day
    assert.equal(event.end.date, '2026-11-25');
    assert.equal(event.start.dateTime, undefined);
    assert.equal(event.end.dateTime, undefined);
  });

  it('Case A: Month boundary rollover for all-day event end date', () => {
    const task = {
      title: 'End of Month Review',
      scheduledDate: '2026-11-30', // Last day of November
      scheduledStartTime: null,
    };

    const event = formatCalendarEvent(task, 'Asia/Kolkata');
    assert.ok(event !== null);
    assert.equal(event.start.date, '2026-11-30');
    // Rolls over to December 1
    assert.equal(event.end.date, '2026-12-01');
  });

  it('Case B & C: Task with date, start time, and planned duration creates timed event', () => {
    const task = {
      title: 'Finalize Login Flow',
      description: 'Review Supabase Magic Link and session storage',
      scheduledDate: '2026-11-24',
      scheduledStartTime: '10:00',
      plannedDurationMinutes: 90, // 90 minutes
    };

    const event = formatCalendarEvent(task, 'Asia/Kolkata', 60);
    assert.ok(event !== null);
    assert.equal(event.summary, 'Finalize Login Flow');
    assert.equal(event.start.dateTime, '2026-11-24T10:00:00');
    assert.equal(event.start.timeZone, 'Asia/Kolkata');
    // 10:00 + 90m = 11:30
    assert.equal(event.end.dateTime, '2026-11-24T11:30:00');
    assert.equal(event.end.timeZone, 'Asia/Kolkata');
    assert.equal(event.start.date, undefined);
  });

  it('Case B & D: Task with date and start time but no planned duration uses default duration (60m)', () => {
    const task = {
      title: 'Quick Team Standup',
      scheduledDate: '2026-11-24',
      scheduledStartTime: '14:15',
      plannedDurationMinutes: null,
    };

    const event = formatCalendarEvent(task, 'Asia/Kolkata', 60);
    assert.ok(event !== null);
    assert.equal(event.start.dateTime, '2026-11-24T14:15:00');
    // 14:15 + 60m default = 15:15
    assert.equal(event.end.dateTime, '2026-11-24T15:15:00');
    assert.equal(event.end.timeZone, 'Asia/Kolkata');
  });

  it('Case D: Respects customized user default duration (e.g. 45 minutes)', () => {
    const task = {
      title: 'Client Consulting Call',
      scheduledDate: '2026-11-24',
      scheduledStartTime: '16:00',
      plannedDurationMinutes: null,
    };

    // User configured 45m default
    const event = formatCalendarEvent(task, 'Asia/Kolkata', 45);
    assert.ok(event !== null);
    assert.equal(event.start.dateTime, '2026-11-24T16:00:00');
    // 16:00 + 45m = 16:45
    assert.equal(event.end.dateTime, '2026-11-24T16:45:00');
  });

  it('Timed event spanning past midnight rolls over day correctly', () => {
    const task = {
      title: 'Late Night Deployment',
      scheduledDate: '2026-11-24',
      scheduledStartTime: '23:30',
      plannedDurationMinutes: 60, // 30m before midnight + 30m after
    };

    const event = formatCalendarEvent(task, 'Asia/Kolkata', 60);
    assert.ok(event !== null);
    assert.equal(event.start.dateTime, '2026-11-24T23:30:00');
    // Ends at 00:30 on November 25
    assert.equal(event.end.dateTime, '2026-11-25T00:30:00');
  });

  it('Case E: Unscheduled Inbox tasks (scheduledDate is null) never create calendar events', () => {
    const inboxTask = {
      title: 'Idea for new feature',
      description: 'Backlog note',
      scheduledDate: null,
      scheduledStartTime: null,
      plannedDurationMinutes: 30,
    };

    const event = formatCalendarEvent(inboxTask, 'Asia/Kolkata', 60);
    assert.equal(event, null, 'Unscheduled Inbox tasks must return null');
  });
});

describe('Milestone 7 — Synchronization Business Logic & Invariants', () => {
  it('Task completion does NOT alter calendar event title or structure (Rule 7)', () => {
    const taskBeforeCompletion: Task = {
      id: 'task-100',
      userId: 'user-1',
      projectId: null,
      title: 'Deploy Production Release',
      description: 'Run deployment checklist',
      priority: 'high',
      status: 'todo',
      scheduledDate: '2026-11-24',
      scheduledStartTime: '11:00',
      plannedDurationMinutes: 60,
      reminderOffsetMinutes: null,
      syncToGoogleCalendar: true,
      calendarSyncStatus: 'synced',
      completedAt: null,
      isArchived: false,
      createdAt: '',
      updatedAt: '',
    };

    const eventBefore = formatCalendarEvent(taskBeforeCompletion, 'Asia/Kolkata');

    const taskAfterCompletion: Task = {
      ...taskBeforeCompletion,
      status: 'completed',
      completedAt: '2026-11-24T11:45:00.000Z',
    };

    const eventAfter = formatCalendarEvent(taskAfterCompletion, 'Asia/Kolkata');

    // Calendar event is identical — completing task does not modify remote calendar event
    assert.deepEqual(eventBefore, eventAfter);
    assert.equal(eventAfter?.summary, 'Deploy Production Release');
  });

  it('Rescheduling a task updates the event start and end without creating duplicates', () => {
    const originalTask = {
      title: 'Sprint Planning',
      scheduledDate: '2026-11-24',
      scheduledStartTime: '10:00',
      plannedDurationMinutes: 60,
    };

    const rescheduledTask = {
      ...originalTask,
      scheduledDate: '2026-11-25', // Moved to next day
      scheduledStartTime: '14:00', // Moved to afternoon
    };

    const updatedEvent = formatCalendarEvent(rescheduledTask, 'Asia/Kolkata');
    assert.ok(updatedEvent !== null);
    assert.equal(updatedEvent.start.dateTime, '2026-11-25T14:00:00');
    assert.equal(updatedEvent.end.dateTime, '2026-11-25T15:00:00');
  });

  it('Moving a task to Inbox returns null, triggering remote event deletion', () => {
    const scheduledTask = {
      title: 'Write Documentation',
      scheduledDate: '2026-11-24',
      scheduledStartTime: '15:00',
    };
    assert.ok(formatCalendarEvent(scheduledTask) !== null);

    const movedToInbox = {
      ...scheduledTask,
      scheduledDate: null,
      scheduledStartTime: null,
    };
    assert.equal(formatCalendarEvent(movedToInbox), null);
  });
});

describe('Milestone 7 — OAuth State Validation & Token Encryption (crypto.ts)', () => {
  const testKey = 'ca517919b70483ae2d2e38bd5d83482d6f007bac130339bd526f54f239839e35';

  it('Encrypts and decrypts sensitive refresh tokens with AES-GCM 256-bit round-trip fidelity', async () => {
    const originalToken = '1//04ABCDEF123456789-SampleGoogleRefreshTokenValue-XYZ';
    const encrypted = await encryptToken(originalToken, testKey);

    assert.ok(encrypted.length > 20);
    assert.notEqual(encrypted, originalToken);

    // Decrypts cleanly
    const decrypted = await decryptToken(encrypted, testKey);
    assert.equal(decrypted, originalToken);
  });

  it('Different encryptions of the same token produce distinct ciphertexts due to random IVs', async () => {
    const token = '1//04ABCDEF123456789';
    const enc1 = await encryptToken(token, testKey);
    const enc2 = await encryptToken(token, testKey);
    assert.notEqual(enc1, enc2, 'Random IV ensures non-deterministic ciphertexts');

    // Both decrypt to the identical original token
    assert.equal(await decryptToken(enc1, testKey), token);
    assert.equal(await decryptToken(enc2, testKey), token);
  });

  it('Tampered ciphertext fails decryption cleanly', async () => {
    const token = '1//04ABCDEF123456789';
    const enc = await encryptToken(token, testKey);
    // Tamper with the base64 string
    const tampered = enc.slice(0, -4) + 'AAAA';
    await assert.rejects(async () => {
      await decryptToken(tampered, testKey);
    });
  });

  it('Creates signed OAuth state token tied to authenticated user ID and verifies within TTL', async () => {
    const userId = '11111111-2222-3333-4444-555555555555';
    const state = await createOAuthState(userId, testKey);

    assert.ok(state.length > 20);
    const verified = await verifyOAuthState(state, testKey);
    assert.ok(verified !== null);
    assert.equal(verified?.userId, userId);
  });

  it('Rejects expired or tampered OAuth state tokens', async () => {
    // Tampered state string
    const invalid = await verifyOAuthState('not-a-valid-base64-state', testKey);
    assert.equal(invalid, null);

    // State with expired timestamp (> 15 minutes)
    const expiredPayload = JSON.stringify({
      userId: 'user-expired',
      nonce: 'nonce-1',
      timestamp: Date.now() - 1000000, // 16.6 minutes ago
    });
    const expiredState = await encryptToken(expiredPayload, testKey);
    const result = await verifyOAuthState(expiredState, testKey);
    assert.equal(result, null, 'Expired state must be rejected');
  });
});
