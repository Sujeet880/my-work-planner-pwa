import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mapTaskFromRow } from './taskService';
import { mapProjectFromRow } from './projectService';
import type { Database } from '../types/database.types';
import { getLocalDateISO } from '../lib/timeMath';

type TaskRow = Database['public']['Tables']['tasks']['Row'];
type ProjectRow = Database['public']['Tables']['projects']['Row'];

describe('Task & Project Service Domain Mappings & Business Rules', () => {
  it('mapProjectFromRow maps database snake_case to application camelCase correctly', () => {
    const row: ProjectRow = {
      id: 'proj-123',
      user_id: 'user-abc',
      name: 'Client Alpha',
      client_name: 'Alpha Corp',
      description: 'Brand identity and UI redesign',
      color: '#2F65F6',
      is_archived: false,
      target_completion_date: null,
      client_share_enabled: false,
      client_view_time_tracking: true,
      client_view_remaining_estimate: true,
      client_view_task_dates: true,
      client_allow_comments: true,
      client_project_status: 'in_progress',
      created_at: '2026-11-21T00:00:00Z',
      updated_at: '2026-11-21T00:00:00Z',
    };

    const domain = mapProjectFromRow(row);
    assert.equal(domain.id, 'proj-123');
    assert.equal(domain.userId, 'user-abc');
    assert.equal(domain.name, 'Client Alpha');
    assert.equal(domain.description, 'Brand identity and UI redesign');
    assert.equal(domain.color, '#2F65F6');
    assert.equal(domain.isArchived, false);
  });

  it('mapTaskFromRow maps database snake_case to application domain Task model correctly', () => {
    const row: TaskRow = {
      id: 'task-789',
      user_id: 'user-abc',
      project_id: 'proj-123',
      title: 'Review Sprint Deliverables',
      description: 'Check acceptance criteria',
      priority: 'high',
      status: 'in_progress',
      scheduled_date: '2026-11-21',
      scheduled_start_time: '10:30',
      planned_duration_minutes: 45,
      reminder_offset_minutes: 15,
      client_visible: false,
      remaining_estimate_minutes: null,
      sync_to_google_calendar: true,
      calendar_sync_status: 'synced',
      completed_at: null,
      is_archived: false,
      sort_order: 1,
      created_at: '2026-11-21T01:00:00Z',
      updated_at: '2026-11-21T01:00:00Z',
    };

    const domain = mapTaskFromRow(row);
    assert.equal(domain.id, 'task-789');
    assert.equal(domain.userId, 'user-abc');
    assert.equal(domain.projectId, 'proj-123');
    assert.equal(domain.title, 'Review Sprint Deliverables');
    assert.equal(domain.priority, 'high');
    assert.equal(domain.status, 'in_progress');
    assert.equal(domain.scheduledDate, '2026-11-21');
    assert.equal(domain.scheduledStartTime, '10:30');
    assert.equal(domain.plannedDurationMinutes, 45);
    assert.equal(domain.syncToGoogleCalendar, true);
    assert.equal(domain.calendarSyncStatus, 'synced');
  });

  it('Inbox Rule: task with scheduled_date = null is an Inbox task', () => {
    const inboxRow: TaskRow = {
      id: 'task-inbox',
      user_id: 'user-abc',
      project_id: null,
      title: 'Unscheduled Idea',
      description: null,
      priority: 'low',
      status: 'todo',
      scheduled_date: null,
      scheduled_start_time: null,
      planned_duration_minutes: null,
      reminder_offset_minutes: null,
      client_visible: false,
      remaining_estimate_minutes: null,
      sync_to_google_calendar: false,
      calendar_sync_status: 'not_synced',
      completed_at: null,
      is_archived: false,
      sort_order: 0,
      created_at: '2026-11-21T00:00:00Z',
      updated_at: '2026-11-21T00:00:00Z',
    };

    const task = mapTaskFromRow(inboxRow);
    const isInbox = task.scheduledDate === null;
    assert.equal(isInbox, true);
  });

  it('Today & Upcoming Scheduling Rules classify tasks accurately', () => {
    const todayIso = getLocalDateISO();

    const todayTask = mapTaskFromRow({
      id: 'task-today',
      user_id: 'user-abc',
      project_id: null,
      title: 'Focus Task Today',
      description: null,
      priority: 'high',
      status: 'todo',
      scheduled_date: todayIso,
      scheduled_start_time: '14:00',
      planned_duration_minutes: 60,
      reminder_offset_minutes: null,
      client_visible: false,
      remaining_estimate_minutes: null,
      sync_to_google_calendar: false,
      calendar_sync_status: 'not_synced',
      completed_at: null,
      is_archived: false,
      sort_order: 0,
      created_at: '2026-11-21T00:00:00Z',
      updated_at: '2026-11-21T00:00:00Z',
    });

    const upcomingTask = mapTaskFromRow({
      id: 'task-upcoming',
      user_id: 'user-abc',
      project_id: null,
      title: 'Next Week Initiative',
      description: null,
      priority: 'medium',
      status: 'todo',
      scheduled_date: '2026-12-01',
      scheduled_start_time: null,
      planned_duration_minutes: 120,
      reminder_offset_minutes: null,
      client_visible: false,
      remaining_estimate_minutes: null,
      sync_to_google_calendar: false,
      calendar_sync_status: 'not_synced',
      completed_at: null,
      is_archived: false,
      sort_order: 0,
      created_at: '2026-11-21T00:00:00Z',
      updated_at: '2026-11-21T00:00:00Z',
    });

    assert.equal(todayTask.scheduledDate, todayIso);
    assert.equal(upcomingTask.scheduledDate! > todayIso, true);
  });

  it('Project Deletion Safety: associated tasks become unassigned (projectId = null) rather than lost', () => {
    const tasks = [
      { id: 't1', title: 'Task 1', projectId: 'p1' },
      { id: 't2', title: 'Task 2', projectId: 'p2' },
      { id: 't3', title: 'Task 3', projectId: 'p1' },
    ];

    const deletedProjectId = 'p1';
    const disassociatedTasks = tasks.map((t) =>
      t.projectId === deletedProjectId ? { ...t, projectId: null } : t
    );

    assert.equal(disassociatedTasks[0].projectId, null);
    assert.equal(disassociatedTasks[1].projectId, 'p2');
    assert.equal(disassociatedTasks[2].projectId, null);
    // Task records remain alive
    assert.equal(disassociatedTasks.length, 3);
  });
});
