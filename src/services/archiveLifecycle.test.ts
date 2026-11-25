import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { taskService } from './taskService';
import { getLocalDateISO, isFutureCalendarBlock } from '../lib/timeMath';

interface MockDbState {
  tasks: Array<{
    id: string;
    user_id: string;
    project_id: string | null;
    title: string;
    description: string | null;
    priority: string;
    status: string;
    scheduled_date: string | null;
    scheduled_end_date?: string | null;
    scheduled_start_time: string | null;
    daily_planned_minutes?: number | null;
    include_weekends?: boolean;
    planned_duration_minutes: number | null;
    reminder_offset_minutes: number | null;
    sync_to_google_calendar: boolean;
    calendar_sync_status: string;
    completed_at?: string | null;
    is_archived: boolean;
    created_at: string;
    updated_at: string;
  }>;
  blocks: Array<{
    id: string;
    user_id: string;
    task_id: string;
    block_date: string;
    start_time: string;
    end_time: string;
    duration_minutes: number;
    status: string;
    created_at: string;
    updated_at: string;
  }>;
  failOnBlockDelete?: boolean;
  failOnBlockInsert?: boolean;
  failOnBlockFetch?: boolean;
  failOnTaskUpdate?: boolean;
}

function createMockSupabase(state: MockDbState) {
  return {
    from(table: string) {
      if (table === 'task_calendar_blocks') {
        return {
          delete() {
            const filters: Record<string, any> = {};
            let gteFilter: { field: string; val: string } | null = null;
            let inFilter: { field: string; vals: any[] } | null = null;
            const chain = {
              eq(field: string, val: any) {
                filters[field] = val;
                return chain;
              },
              gte(field: string, val: string) {
                gteFilter = { field, val };
                return chain;
              },
              in(field: string, vals: any[]) {
                inFilter = { field, vals };
                return chain;
              },
              then(resolve: (value: { error: { message: string } | null }) => void) {
                if (state.failOnBlockDelete) {
                  return Promise.resolve(resolve({ error: { message: 'Database delete constraint violation' } }));
                }
                state.blocks = state.blocks.filter((b) => {
                  let match = true;
                  for (const [k, v] of Object.entries(filters)) {
                    if ((b as any)[k] !== v) match = false;
                  }
                  if (gteFilter && (b as any)[gteFilter.field] < gteFilter.val) {
                    match = false;
                  }
                  if (inFilter && !inFilter.vals.includes((b as any)[inFilter.field])) {
                    match = false;
                  }
                  return !match; // keep non-matching
                });
                return Promise.resolve(resolve({ error: null }));
              },
            };
            return chain;
          },
          select(_fields: string) {
            const filters: Record<string, any> = {};
            const chain = {
              eq(field: string, val: any) {
                filters[field] = val;
                return chain;
              },
              then(resolve: (value: { data: any[] | null; error: { message: string } | null }) => void) {
                if (state.failOnBlockFetch) {
                  return Promise.resolve(resolve({ data: null, error: { message: 'Connection timeout on block select' } }));
                }
                const matched = state.blocks.filter((b) => {
                  for (const [k, v] of Object.entries(filters)) {
                    if ((b as any)[k] !== v) return false;
                  }
                  return true;
                });
                return Promise.resolve(resolve({ data: matched.map((b) => ({ ...b })), error: null }));
              },
            };
            return chain;
          },
          insert(rows: any[]) {
            return {
              then(resolve: (value: { error: { message: string } | null }) => void) {
                if (state.failOnBlockInsert) {
                  return Promise.resolve(resolve({ error: { message: 'Database insert failure' } }));
                }
                for (const row of rows) {
                  state.blocks.push({
                    id: row.id || `block-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    created_at: row.created_at || new Date().toISOString(),
                    updated_at: row.updated_at || new Date().toISOString(),
                    ...row,
                  });
                }
                return Promise.resolve(resolve({ error: null }));
              },
            };
          },
        };
      }

      if (table === 'tasks') {
        return {
          select(_fields: string) {
            const filters: Record<string, any> = {};
            const neqFilters: Record<string, any> = {};
            const chain = {
              eq(field: string, val: any) {
                filters[field] = val;
                return chain;
              },
              neq(field: string, val: any) {
                neqFilters[field] = val;
                return chain;
              },
              single() {
                const found = state.tasks.find((t) => {
                  for (const [k, v] of Object.entries(filters)) {
                    if ((t as any)[k] !== v) return false;
                  }
                  for (const [k, v] of Object.entries(neqFilters)) {
                    if ((t as any)[k] === v) return false;
                  }
                  return true;
                });
                return Promise.resolve({
                  data: found ? { ...found } : null,
                  error: found ? null : { message: 'Task not found' },
                });
              },
              then(resolve: (value: { data: any[] | null; error: { message: string } | null }) => void) {
                const matched = state.tasks.filter((t) => {
                  for (const [k, v] of Object.entries(filters)) {
                    if ((t as any)[k] !== v) return false;
                  }
                  for (const [k, v] of Object.entries(neqFilters)) {
                    if ((t as any)[k] === v) return false;
                  }
                  return true;
                });
                return Promise.resolve(resolve({ data: matched.map((t) => ({ ...t })), error: null }));
              },
            };
            return chain;
          },
          update(updates: any) {
            const filters: Record<string, any> = {};
            const chain = {
              eq(field: string, val: any) {
                filters[field] = val;
                return chain;
              },
              then(resolve: (value: { error: { message: string } | null }) => void) {
                if (state.failOnTaskUpdate) {
                  return Promise.resolve(resolve({ error: { message: 'Failed to update task record' } }));
                }
                for (const t of state.tasks) {
                  let match = true;
                  for (const [k, v] of Object.entries(filters)) {
                    if ((t as any)[k] !== v) match = false;
                  }
                  if (match) {
                    Object.assign(t, updates);
                  }
                }
                return Promise.resolve(resolve({ error: null }));
              },
            };
            return chain;
          },
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  };
}

describe('Task Archive Lifecycle & Calendar Consistency Suite', () => {
  // Use deterministic morning reference timestamp (08:00 Asia/Kolkata) for date-based tests
  const refNow = new Date('2026-11-25T08:00:00+05:30');
  const tz = 'Asia/Kolkata';
  const today = '2026-11-25';
  const tomorrow = '2026-11-26';
  const dayAfterTomorrow = '2026-11-27';
  const yesterday = '2026-11-24';

  it('Scenario 1: Archiving an active scheduled task removes future blocks and marks task archived', async () => {
    const db: MockDbState = {
      tasks: [
        {
          id: 'tsk-001',
          user_id: 'usr-1',
          project_id: 'prj-1',
          title: 'Deploy microservices',
          description: null,
          priority: 'high',
          status: 'in_progress',
          scheduled_date: today,
          scheduled_end_date: dayAfterTomorrow,
          scheduled_start_time: '10:00',
          daily_planned_minutes: 120,
          include_weekends: true,
          planned_duration_minutes: 360,
          reminder_offset_minutes: 15,
          sync_to_google_calendar: false,
          calendar_sync_status: 'not_synced',
          is_archived: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      blocks: [
        {
          id: 'blk-1',
          user_id: 'usr-1',
          task_id: 'tsk-001',
          block_date: today,
          start_time: '10:00',
          end_time: '12:00',
          duration_minutes: 120,
          status: 'scheduled',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'blk-2',
          user_id: 'usr-1',
          task_id: 'tsk-001',
          block_date: tomorrow,
          start_time: '10:00',
          end_time: '12:00',
          duration_minutes: 120,
          status: 'scheduled',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'blk-3',
          user_id: 'usr-1',
          task_id: 'tsk-001',
          block_date: dayAfterTomorrow,
          start_time: '10:00',
          end_time: '12:00',
          duration_minutes: 120,
          status: 'scheduled',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    };

    const mock = createMockSupabase(db);
    const result = await taskService.archiveTask('usr-1', 'tsk-001', true, {
      timezone: tz,
      now: refNow,
      clientOverride: mock,
    });

    assert.equal(result.success, true);
    assert.equal(result.error, null);
    assert.equal(db.tasks[0].is_archived, true);
    // All 3 scheduled blocks start after 08:00 today, so they should all be deleted
    assert.equal(db.blocks.length, 0);
  });

  it('Scenario 2: Archiving a completed task with historical records preserves completed/past blocks and completion timestamp', async () => {
    const completedAt = '2026-11-25T07:30:00.000Z';
    const db: MockDbState = {
      tasks: [
        {
          id: 'tsk-002',
          user_id: 'usr-1',
          project_id: 'prj-1',
          title: 'Finalize brand identity',
          description: null,
          priority: 'medium',
          status: 'completed',
          scheduled_date: yesterday,
          scheduled_end_date: tomorrow,
          scheduled_start_time: '09:00',
          daily_planned_minutes: 60,
          include_weekends: true,
          planned_duration_minutes: 180,
          reminder_offset_minutes: null,
          sync_to_google_calendar: false,
          calendar_sync_status: 'not_synced',
          completed_at: completedAt,
          is_archived: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      blocks: [
        {
          id: 'blk-past',
          user_id: 'usr-1',
          task_id: 'tsk-002',
          block_date: yesterday,
          start_time: '09:00',
          end_time: '10:00',
          duration_minutes: 60,
          status: 'scheduled',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'blk-completed-today',
          user_id: 'usr-1',
          task_id: 'tsk-002',
          block_date: today,
          start_time: '09:00',
          end_time: '10:00',
          duration_minutes: 60,
          status: 'completed',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'blk-future-scheduled',
          user_id: 'usr-1',
          task_id: 'tsk-002',
          block_date: tomorrow,
          start_time: '09:00',
          end_time: '10:00',
          duration_minutes: 60,
          status: 'scheduled',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    };

    const mock = createMockSupabase(db);
    const result = await taskService.archiveTask('usr-1', 'tsk-002', true, {
      timezone: tz,
      now: refNow,
      clientOverride: mock,
    });

    assert.equal(result.success, true);
    assert.equal(db.tasks[0].is_archived, true);
    assert.equal(db.tasks[0].status, 'completed');
    assert.equal(db.tasks[0].completed_at, completedAt);

    const remainingIds = db.blocks.map((b) => b.id);
    assert.ok(remainingIds.includes('blk-past'), 'Historical past block must not be deleted');
    assert.ok(remainingIds.includes('blk-completed-today'), 'Completed block must not be deleted');
    assert.ok(!remainingIds.includes('blk-future-scheduled'), 'Future scheduled block must be removed');
    assert.equal(db.blocks.length, 2);
  });

  it('Scenario 2B: Same-day blocks distinguish past vs future start_time in user local timezone', async () => {
    const afternoonNow = new Date('2026-11-25T14:00:00+05:30');
    const db: MockDbState = {
      tasks: [
        {
          id: 'tsk-tz',
          user_id: 'usr-1',
          project_id: 'prj-1',
          title: 'Timezone boundary check',
          description: null,
          priority: 'medium',
          status: 'in_progress',
          scheduled_date: today,
          scheduled_end_date: tomorrow,
          scheduled_start_time: '09:00',
          daily_planned_minutes: 60,
          include_weekends: true,
          planned_duration_minutes: 120,
          reminder_offset_minutes: null,
          sync_to_google_calendar: false,
          calendar_sync_status: 'not_synced',
          is_archived: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      blocks: [
        {
          id: 'blk-today-morning',
          user_id: 'usr-1',
          task_id: 'tsk-tz',
          block_date: today,
          start_time: '09:00', // Already in past relative to 14:00
          end_time: '10:00',
          duration_minutes: 60,
          status: 'scheduled',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'blk-today-evening',
          user_id: 'usr-1',
          task_id: 'tsk-tz',
          block_date: today,
          start_time: '16:30', // Future relative to 14:00
          end_time: '17:30',
          duration_minutes: 60,
          status: 'scheduled',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'blk-tomorrow',
          user_id: 'usr-1',
          task_id: 'tsk-tz',
          block_date: tomorrow,
          start_time: '09:00',
          end_time: '10:00',
          duration_minutes: 60,
          status: 'scheduled',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    };

    assert.equal(isFutureCalendarBlock(db.blocks[0], afternoonNow, tz), false);
    assert.equal(isFutureCalendarBlock(db.blocks[1], afternoonNow, tz), true);
    assert.equal(isFutureCalendarBlock(db.blocks[2], afternoonNow, tz), true);

    const mock = createMockSupabase(db);
    const res = await taskService.archiveTask('usr-1', 'tsk-tz', true, {
      timezone: tz,
      now: afternoonNow,
      clientOverride: mock,
    });

    assert.equal(res.success, true);
    assert.equal(db.blocks.length, 1);
    assert.equal(db.blocks[0].id, 'blk-today-morning');
  });

  it('Scenario 3: Restoring an active task regenerates only valid future blocks', async () => {
    const afternoonNow = new Date('2026-11-25T15:00:00+05:30');
    const db: MockDbState = {
      tasks: [
        {
          id: 'tsk-003',
          user_id: 'usr-1',
          project_id: 'prj-1',
          title: 'API Authentication Flow',
          description: null,
          priority: 'high',
          status: 'in_progress',
          scheduled_date: yesterday, // Historical day should not be recreated
          scheduled_end_date: tomorrow,
          scheduled_start_time: '14:00', // 14:00 today is already past at 15:00 -> only tomorrow restored!
          daily_planned_minutes: 120,
          include_weekends: true,
          planned_duration_minutes: 360,
          reminder_offset_minutes: null,
          sync_to_google_calendar: false,
          calendar_sync_status: 'not_synced',
          is_archived: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      blocks: [],
    };

    const mock = createMockSupabase(db);
    const result = await taskService.archiveTask('usr-1', 'tsk-003', false, {
      timezone: tz,
      now: afternoonNow,
      clientOverride: mock,
    });

    assert.equal(result.success, true);
    assert.equal(db.tasks[0].is_archived, false);
    // Yesterday is past, today at 14:00 is past relative to 15:00 -> only tomorrow (2026-11-26) regenerated
    assert.equal(db.blocks.length, 1);
    assert.equal(db.blocks[0].block_date, tomorrow);
    assert.equal(db.blocks[0].start_time, '14:00');
    assert.equal(db.blocks[0].duration_minutes, 120);
    assert.equal(db.blocks[0].status, 'scheduled');
  });

  it('Scenario 4: Restoring a completed task unarchives while preserving status/completed_at and generating zero blocks', async () => {
    const completedAt = '2026-11-24T18:00:00.000Z';
    const db: MockDbState = {
      tasks: [
        {
          id: 'tsk-004',
          user_id: 'usr-1',
          project_id: 'prj-1',
          title: 'Sprint Retrospective',
          description: null,
          priority: 'low',
          status: 'completed',
          scheduled_date: today,
          scheduled_end_date: tomorrow,
          scheduled_start_time: '15:00',
          daily_planned_minutes: 60,
          include_weekends: true,
          planned_duration_minutes: 120,
          reminder_offset_minutes: null,
          sync_to_google_calendar: true,
          calendar_sync_status: 'synced',
          completed_at: completedAt,
          is_archived: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      blocks: [
        {
          id: 'blk-hist',
          user_id: 'usr-1',
          task_id: 'tsk-004',
          block_date: yesterday,
          start_time: '15:00',
          end_time: '16:00',
          duration_minutes: 60,
          status: 'completed',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    };

    const mock = createMockSupabase(db);
    const result = await taskService.archiveTask('usr-1', 'tsk-004', false, {
      timezone: tz,
      now: refNow,
      clientOverride: mock,
    });

    assert.equal(result.success, true);
    assert.equal(db.tasks[0].is_archived, false);
    assert.equal(db.tasks[0].status, 'completed');
    assert.equal(db.tasks[0].completed_at, completedAt);
    assert.equal(db.blocks.length, 1);
    assert.equal(db.blocks[0].id, 'blk-hist');
  });

  it('Scenario 4B: Restoring an active task checks existing calendar conflicts and avoids silent overlaps', async () => {
    // Case A: Resolvable conflict (09:00-13:00 tomorrow taken, free 13:00-17:00 exists) -> adjusts slot & warns
    const dbResolvable: MockDbState = {
      tasks: [
        {
          id: 'tsk-other',
          user_id: 'usr-1',
          project_id: 'prj-1',
          title: 'Existing Priority Workshop',
          description: null,
          priority: 'high',
          status: 'todo',
          scheduled_date: tomorrow,
          scheduled_end_date: tomorrow,
          scheduled_start_time: '09:00',
          daily_planned_minutes: 240,
          include_weekends: true,
          planned_duration_minutes: 240,
          reminder_offset_minutes: null,
          sync_to_google_calendar: false,
          calendar_sync_status: 'not_synced',
          is_archived: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'tsk-restore-conflict',
          user_id: 'usr-1',
          project_id: 'prj-1',
          title: 'User Flow Spec',
          description: null,
          priority: 'medium',
          status: 'todo',
          scheduled_date: tomorrow,
          scheduled_end_date: tomorrow,
          scheduled_start_time: '09:00',
          daily_planned_minutes: 240,
          include_weekends: true,
          planned_duration_minutes: 240,
          reminder_offset_minutes: null,
          sync_to_google_calendar: false,
          calendar_sync_status: 'not_synced',
          is_archived: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      blocks: [
        {
          id: 'blk-other',
          user_id: 'usr-1',
          task_id: 'tsk-other',
          block_date: tomorrow,
          start_time: '09:00',
          end_time: '13:00',
          duration_minutes: 240,
          status: 'scheduled',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    };

    const mockA = createMockSupabase(dbResolvable);
    const resA = await taskService.archiveTask('usr-1', 'tsk-restore-conflict', false, {
      timezone: tz,
      now: refNow,
      clientOverride: mockA,
    });
    assert.equal(resA.success, true);
    assert.ok(resA.warning?.includes('avoid overlap'));
    const restoredBlock = dbResolvable.blocks.find((b) => b.task_id === 'tsk-restore-conflict');
    assert.ok(restoredBlock);
    assert.equal(restoredBlock.start_time, '13:00');
    assert.equal(restoredBlock.end_time, '17:00');

    // Case B: Unresolvable conflict (whole day 09:00-18:00 occupied) -> blocks restore cleanly without silent overlap
    const dbUnresolvable: MockDbState = {
      tasks: [
        { ...dbResolvable.tasks[0], daily_planned_minutes: 540, planned_duration_minutes: 540 },
        { ...dbResolvable.tasks[1], is_archived: true },
      ],
      blocks: [
        {
          id: 'blk-full-day',
          user_id: 'usr-1',
          task_id: 'tsk-other',
          block_date: tomorrow,
          start_time: '09:00',
          end_time: '18:00',
          duration_minutes: 540,
          status: 'scheduled',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    };

    const mockB = createMockSupabase(dbUnresolvable);
    const resB = await taskService.archiveTask('usr-1', 'tsk-restore-conflict', false, {
      timezone: tz,
      now: refNow,
      clientOverride: mockB,
    });
    assert.equal(resB.success, false);
    assert.ok(resB.error?.includes('Scheduling conflict detected'));
    assert.equal(dbUnresolvable.tasks[1].is_archived, true);
    assert.equal(dbUnresolvable.blocks.length, 1);
  });

  it('Scenario 5: Failed calendar-block deletion preserves data consistency and does not archive task', async () => {
    const db: MockDbState = {
      tasks: [
        {
          id: 'tsk-005',
          user_id: 'usr-1',
          project_id: 'prj-1',
          title: 'Critical Infrastructure Maintenance',
          description: null,
          priority: 'high',
          status: 'in_progress',
          scheduled_date: tomorrow,
          scheduled_end_date: tomorrow,
          scheduled_start_time: '10:00',
          daily_planned_minutes: 60,
          include_weekends: true,
          planned_duration_minutes: 60,
          reminder_offset_minutes: null,
          sync_to_google_calendar: false,
          calendar_sync_status: 'not_synced',
          is_archived: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      blocks: [
        {
          id: 'blk-crit',
          user_id: 'usr-1',
          task_id: 'tsk-005',
          block_date: tomorrow,
          start_time: '10:00',
          end_time: '11:00',
          duration_minutes: 60,
          status: 'scheduled',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      failOnBlockDelete: true,
    };

    const mock = createMockSupabase(db);
    const result = await taskService.archiveTask('usr-1', 'tsk-005', true, {
      timezone: tz,
      now: refNow,
      clientOverride: mock,
    });

    assert.equal(result.success, false);
    assert.ok(result.error?.includes('Failed to remove future calendar blocks'));
    assert.equal(db.tasks[0].is_archived, false);
    assert.equal(db.blocks.length, 1);
  });

  it('Scenario 6: Failed calendar-block restoration rolls back task state to archived', async () => {
    const db: MockDbState = {
      tasks: [
        {
          id: 'tsk-006',
          user_id: 'usr-1',
          project_id: 'prj-1',
          title: 'Database Schema Optimization',
          description: null,
          priority: 'high',
          status: 'in_progress',
          scheduled_date: tomorrow,
          scheduled_end_date: tomorrow,
          scheduled_start_time: '11:00',
          daily_planned_minutes: 60,
          include_weekends: true,
          planned_duration_minutes: 60,
          reminder_offset_minutes: null,
          sync_to_google_calendar: false,
          calendar_sync_status: 'not_synced',
          is_archived: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      blocks: [],
      failOnBlockInsert: true,
    };

    const mock = createMockSupabase(db);
    const result = await taskService.archiveTask('usr-1', 'tsk-006', false, {
      timezone: tz,
      now: refNow,
      clientOverride: mock,
    });

    assert.equal(result.success, false);
    assert.ok(result.error?.includes('Failed to restore calendar blocks'));
    assert.equal(db.tasks[0].is_archived, true);
  });

  it('Scenario 7: No duplicate blocks after repeated archive and restore operations', async () => {
    const db: MockDbState = {
      tasks: [
        {
          id: 'tsk-007',
          user_id: 'usr-1',
          project_id: 'prj-1',
          title: 'End-to-End Stress Testing',
          description: null,
          priority: 'medium',
          status: 'in_progress',
          scheduled_date: today,
          scheduled_end_date: tomorrow,
          scheduled_start_time: '13:00',
          daily_planned_minutes: 90,
          include_weekends: true,
          planned_duration_minutes: 180,
          reminder_offset_minutes: null,
          sync_to_google_calendar: false,
          calendar_sync_status: 'not_synced',
          is_archived: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      blocks: [
        {
          id: 'blk-init-1',
          user_id: 'usr-1',
          task_id: 'tsk-007',
          block_date: today,
          start_time: '13:00',
          end_time: '14:30',
          duration_minutes: 90,
          status: 'scheduled',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'blk-init-2',
          user_id: 'usr-1',
          task_id: 'tsk-007',
          block_date: tomorrow,
          start_time: '13:00',
          end_time: '14:30',
          duration_minutes: 90,
          status: 'scheduled',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    };

    const mock = createMockSupabase(db);
    const opts = { timezone: tz, now: refNow, clientOverride: mock };

    // Cycle 1: Archive & Restore
    const arch1 = await taskService.archiveTask('usr-1', 'tsk-007', true, opts);
    assert.equal(arch1.success, true);
    assert.equal(db.blocks.length, 0);

    const rest1 = await taskService.archiveTask('usr-1', 'tsk-007', false, opts);
    assert.equal(rest1.success, true);
    assert.equal(db.blocks.length, 2);

    // Cycle 2: Archive & Restore
    const arch2 = await taskService.archiveTask('usr-1', 'tsk-007', true, opts);
    assert.equal(arch2.success, true);
    assert.equal(db.blocks.length, 0);

    const rest2 = await taskService.archiveTask('usr-1', 'tsk-007', false, opts);
    assert.equal(rest2.success, true);
    assert.equal(db.blocks.length, 2);

    // Re-trigger restore when blocks already exist: zero duplicates
    const retrigger = await taskService.archiveTask('usr-1', 'tsk-007', false, opts);
    assert.equal(retrigger.success, true);
    assert.equal(db.blocks.length, 2);

    const distinctDates = new Set(db.blocks.map((b) => b.block_date));
    assert.equal(distinctDates.size, 2);
    assert.ok(distinctDates.has(today));
    assert.ok(distinctDates.has(tomorrow));
  });
});
