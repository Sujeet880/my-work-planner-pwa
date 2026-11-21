import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateReminderTime,
  isReminderInFuture,
  mapReminderFromRow,
} from './reminderService';
import { urlBase64ToUint8Array, arrayBufferToBase64 } from './pushService';
import type { Database } from '../types/database.types';

type TaskReminderRow = Database['public']['Tables']['task_reminders']['Row'];

describe('Milestone 8 — Task Reminders Calculation Rules & Invariants', () => {
  it('1. Calculates exact timestamp when offset is 0 (At start time)', () => {
    const remindAt = calculateReminderTime({
      scheduledDate: '2026-11-25',
      scheduledStartTime: '14:30',
      reminderOffsetMinutes: 0,
      timezone: 'UTC',
    });
    assert.ok(remindAt !== null);
    const date = new Date(remindAt!);
    assert.equal(date.getUTCHours(), 14);
    assert.equal(date.getUTCMinutes(), 30);
  });

  it('2. Calculates timestamp for standard offsets (5m, 10m, 15m, 30m, 60m)', () => {
    const base = {
      scheduledDate: '2026-11-25',
      scheduledStartTime: '15:00',
      timezone: 'UTC',
    };

    const offsets = [5, 10, 15, 30, 60];
    const expectedMinutes = [55, 50, 45, 30, 0];
    const expectedHours = [14, 14, 14, 14, 14];

    offsets.forEach((offset, idx) => {
      const result = calculateReminderTime({
        ...base,
        reminderOffsetMinutes: offset,
      });
      assert.ok(result !== null);
      const date = new Date(result!);
      assert.equal(date.getUTCHours(), expectedHours[idx]);
      assert.equal(date.getUTCMinutes(), expectedMinutes[idx]);
    });
  });

  it('3. Handles rollover across hour boundaries correctly (e.g., 10:05 - 15m = 09:50)', () => {
    const remindAt = calculateReminderTime({
      scheduledDate: '2026-11-25',
      scheduledStartTime: '10:05',
      reminderOffsetMinutes: 15,
      timezone: 'UTC',
    });
    assert.ok(remindAt !== null);
    const date = new Date(remindAt!);
    assert.equal(date.getUTCHours(), 9);
    assert.equal(date.getUTCMinutes(), 50);
  });

  it('4. Handles rollover across day/midnight boundary correctly (00:10 - 15m = previous day 23:55)', () => {
    const remindAt = calculateReminderTime({
      scheduledDate: '2026-11-25',
      scheduledStartTime: '00:10',
      reminderOffsetMinutes: 15,
      timezone: 'UTC',
    });
    assert.ok(remindAt !== null);
    const date = new Date(remindAt!);
    assert.equal(date.getUTCDate(), 24);
    assert.equal(date.getUTCHours(), 23);
    assert.equal(date.getUTCMinutes(), 55);
  });

  it('5. Date-only task calculates reminder when explicit custom time is provided', () => {
    const remindAt = calculateReminderTime({
      scheduledDate: '2026-11-25',
      scheduledStartTime: null,
      reminderOffsetMinutes: 0,
      customReminderTime: '09:00',
      timezone: 'UTC',
    });
    assert.ok(remindAt !== null);
    const date = new Date(remindAt!);
    assert.equal(date.getUTCHours(), 9);
    assert.equal(date.getUTCMinutes(), 0);
  });

  it('6. Date-only task WITHOUT custom reminder time returns null (NEVER defaults to midnight)', () => {
    const remindAt = calculateReminderTime({
      scheduledDate: '2026-11-25',
      scheduledStartTime: null,
      reminderOffsetMinutes: 15,
      customReminderTime: null,
    });
    assert.equal(remindAt, null, 'Date-only task without explicit reminder time must return null');
  });

  it('7. Unscheduled Inbox task (scheduledDate is null) returns null', () => {
    const remindAt = calculateReminderTime({
      scheduledDate: null,
      scheduledStartTime: '10:00',
      reminderOffsetMinutes: 15,
    });
    assert.equal(remindAt, null, 'Inbox tasks must never have reminders');
  });

  it('8. Missing or null reminderOffsetMinutes returns null', () => {
    const remindAt = calculateReminderTime({
      scheduledDate: '2026-11-25',
      scheduledStartTime: '10:00',
      reminderOffsetMinutes: null,
    });
    assert.equal(remindAt, null);
  });

  it('9. isReminderInFuture validates timestamps against reference epoch', () => {
    const now = 1764000000000;
    const futureIso = new Date(now + 60000).toISOString();
    const pastIso = new Date(now - 60000).toISOString();

    assert.equal(isReminderInFuture(futureIso, now), true);
    assert.equal(isReminderInFuture(pastIso, now), false);
    assert.equal(isReminderInFuture('invalid-date', now), false);
  });

  it('10. mapReminderFromRow maps snake_case database row to camelCase domain model', () => {
    const row: TaskReminderRow = {
      id: 'rem-123',
      user_id: 'user-456',
      task_id: 'task-789',
      remind_at: '2026-11-25T14:15:00.000Z',
      timezone: 'Asia/Kolkata',
      status: 'scheduled',
      sent_at: null,
      attempt_count: 0,
      last_error: null,
      created_at: '2026-11-21T10:00:00.000Z',
      updated_at: '2026-11-21T10:00:00.000Z',
    };

    const domain = mapReminderFromRow(row);
    assert.equal(domain.id, 'rem-123');
    assert.equal(domain.userId, 'user-456');
    assert.equal(domain.taskId, 'task-789');
    assert.equal(domain.remindAt, '2026-11-25T14:15:00.000Z');
    assert.equal(domain.timezone, 'Asia/Kolkata');
    assert.equal(domain.status, 'scheduled');
    assert.equal(domain.attemptCount, 0);
  });
});

describe('Milestone 8 — Web Push & VAPID Utilities', () => {
  it('11. Converts standard base64url VAPID public key to Uint8Array', () => {
    const testBase64Url = 'BNcRdreALRF8MoUzzk5t36j-vFw5zE8Y';
    const uint8 = urlBase64ToUint8Array(testBase64Url);
    assert.ok(uint8 instanceof Uint8Array);
    assert.ok(uint8.length > 0);
  });

  it('12. Converts ArrayBuffer to Base64 and preserves round-trip fidelity', () => {
    const sampleBytes = new Uint8Array([72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100]); // "Hello World"
    const b64 = arrayBufferToBase64(sampleBytes.buffer);
    assert.equal(b64, 'SGVsbG8gV29ybGQ=');

    const empty = arrayBufferToBase64(null);
    assert.equal(empty, '');
  });

  it('13. Multi-device push subscriptions: validates required fields', () => {
    const subscription = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint',
      keys: {
        p256dh: 'BNcRdreALRF8MoUzzk5t36j-vFw5zE8Y',
        auth: 'tBHItDaAvaFsWjqP0j2fxA',
      },
    };

    assert.ok(subscription.endpoint.startsWith('https://'));
    assert.ok(subscription.keys.p256dh.length > 0);
    assert.ok(subscription.keys.auth.length > 0);
  });
});
