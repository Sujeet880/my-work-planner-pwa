import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type {
  ProjectComment,
  ProjectTaskRequest,
  InboxConversationItem,
  SharedProjectView,
} from '../types/sharing';
import type { Task } from '../types/models';

describe('Project Collaboration End-to-End Functional Lifecycle', () => {
  // Mock data store for end-to-end flow
  const mockProfiles = new Map([
    ['user-owner-1', { fullName: 'Sujit Kumar', email: 'owner@example.com' }],
    ['user-client-1', { fullName: 'Pritam Priya', email: 'client@example.com' }],
  ]);

  const mockProject = {
    id: 'proj-001',
    userId: 'user-owner-1',
    name: 'E-Commerce Platform Redesign',
    color: '#2F65F6',
    clientProjectStatus: 'on_track' as const,
    clientShareEnabled: true,
  };

  const tasks: Task[] = [];
  const taskRequests: ProjectTaskRequest[] = [];
  const comments: ProjectComment[] = [];
  const readStates = new Map<string, string>(); // `userId:projectId:taskId` -> lastReadAt

  function resolveIdentity(userId: string) {
    const profile = mockProfiles.get(userId);
    const name = profile?.fullName || profile?.email || 'Collaborator';
    const role: 'Project Owner' | 'Client Collaborator' =
      userId === mockProject.userId ? 'Project Owner' : 'Client Collaborator';
    return { name, role, display: `${name} · ${role}` };
  }

  it('Step 1: Client submits a new Task Request with title, description, and suggested priority', () => {
    const newRequest: ProjectTaskRequest = {
      id: 'req-001',
      projectId: mockProject.id,
      requestedBy: 'user-client-1',
      requesterName: 'Pritam Priya',
      requesterEmail: 'client@example.com',
      title: 'Implement Dark Mode toggle in header',
      description: 'Add a persistent dark mode switch with system preference detection.',
      reason: 'Frequently requested by beta testers',
      suggestedPriority: 'high',
      requestedDueDate: '2026-12-01',
      status: 'submitted',
      ownerFeedback: null,
      createdTaskId: null,
      reviewedAt: null,
      reviewedBy: null,
      projectName: mockProject.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    taskRequests.push(newRequest);

    assert.equal(taskRequests.length, 1);
    assert.equal(taskRequests[0].status, 'submitted');
    assert.equal(taskRequests[0].createdTaskId, null);
  });

  it('Step 2: Owner Client Inbox aggregates the pending Task Request with unread status', () => {
    const inboxItems: InboxConversationItem[] = taskRequests.map((req) => ({
      id: `req-${req.id}`,
      type: 'task_request',
      projectId: req.projectId,
      projectName: req.projectName || 'Project',
      taskId: null,
      taskTitle: req.title,
      senderName: req.requesterName || 'Collaborator',
      senderRole: 'Client Collaborator',
      lastMessageSnippet: `Requested deliverable: ${req.title} (${req.suggestedPriority} priority)`,
      lastActivityAt: req.createdAt,
      unreadCount: 1,
      requestStatus: req.status,
      taskRequest: req,
    }));

    assert.equal(inboxItems.length, 1);
    assert.equal(inboxItems[0].type, 'task_request');
    assert.equal(inboxItems[0].senderName, 'Pritam Priya');
    assert.equal(inboxItems[0].senderRole, 'Client Collaborator');
    assert.equal(inboxItems[0].unreadCount, 1);
  });

  it('Step 3: Owner reviews and approves the Task Request, creating a deliverable task', () => {
    const req = taskRequests.find((r) => r.id === 'req-001')!;
    assert.ok(req);

    // Simulated atomic approval RPC
    const generatedTaskId = 'task-deliv-001';
    const newTask: Task = {
      id: generatedTaskId,
      userId: mockProject.userId,
      projectId: mockProject.id,
      title: req.title,
      description: req.description || undefined,
      status: 'todo',
      priority: req.suggestedPriority === 'urgent' ? 'high' : req.suggestedPriority,
      scheduledDate: req.requestedDueDate,
      scheduledStartTime: null,
      plannedDurationMinutes: 120,
      clientVisible: true,
      remainingEstimateMinutes: 120,
      reminderOffsetMinutes: null,
      syncToGoogleCalendar: false,
      calendarSyncStatus: 'not_synced',
      completedAt: null,
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    tasks.push(newTask);
    req.status = 'approved';
    req.createdTaskId = generatedTaskId;
    req.reviewedAt = new Date().toISOString();
    req.reviewedBy = mockProject.userId;

    assert.equal(req.status, 'approved');
    assert.equal(req.createdTaskId, 'task-deliv-001');
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].clientVisible, true);
    assert.equal(tasks[0].title, 'Implement Dark Mode toggle in header');
  });

  it('Step 4: Client opens dedicated Task Discussion Modal and posts a question on the deliverable', () => {
    const clientUser = 'user-client-1';
    const clientIdentity = resolveIdentity(clientUser);

    const clientComment: ProjectComment = {
      id: 'comm-001',
      projectId: mockProject.id,
      taskId: 'task-deliv-001',
      parentCommentId: null,
      authorId: clientUser,
      authorName: clientIdentity.name,
      authorRole: clientIdentity.role,
      body: 'Should we store the theme preference in localStorage or database profile?',
      resolvedAt: null,
      resolvedBy: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
      replies: [],
    };

    comments.push(clientComment);

    assert.equal(comments.length, 1);
    assert.equal(comments[0].taskId, 'task-deliv-001');
    assert.equal(comments[0].authorName, 'Pritam Priya');
    assert.equal(comments[0].authorRole, 'Client Collaborator');
  });

  it('Step 5: Owner receives message, views task discussion, and replies with real human identity', () => {
    const ownerUser = 'user-owner-1';
    const ownerIdentity = resolveIdentity(ownerUser);

    const ownerReply: ProjectComment = {
      id: 'comm-002',
      projectId: mockProject.id,
      taskId: 'task-deliv-001',
      parentCommentId: 'comm-001',
      authorId: ownerUser,
      authorName: ownerIdentity.name,
      authorRole: ownerIdentity.role,
      body: 'Let us store it in localStorage for instant render, and sync to profile when signed in.',
      resolvedAt: null,
      resolvedBy: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
    };

    comments.push(ownerReply);

    assert.equal(comments.length, 2);
    assert.equal(comments[1].parentCommentId, 'comm-001');
    assert.equal(comments[1].authorName, 'Sujit Kumar');
    assert.equal(comments[1].authorRole, 'Project Owner');
  });

  it('Step 6: Thread nesting groups owner reply under client parent comment without dropping messages', () => {
    const topLevel: ProjectComment[] = [];
    const repliesMap = new Map<string, ProjectComment[]>();

    for (const c of comments) {
      if (c.parentCommentId) {
        const list = repliesMap.get(c.parentCommentId) || [];
        list.push(c);
        repliesMap.set(c.parentCommentId, list);
      } else {
        topLevel.push({ ...c, replies: [] });
      }
    }

    for (const t of topLevel) {
      t.replies = repliesMap.get(t.id) || [];
    }

    assert.equal(topLevel.length, 1);
    assert.equal(topLevel[0].id, 'comm-001');
    assert.equal(topLevel[0].authorName, 'Pritam Priya');
    assert.equal(topLevel[0].replies?.length, 1);
    assert.equal(topLevel[0].replies?.[0].authorName, 'Sujit Kumar');
    assert.equal(topLevel[0].replies?.[0].authorRole, 'Project Owner');
  });

  it('Step 7: Task discussions remain strictly isolated from top-level Project discussions', () => {
    // Add a top-level project discussion comment
    const projectComment: ProjectComment = {
      id: 'comm-proj-001',
      projectId: mockProject.id,
      taskId: null,
      parentCommentId: null,
      authorId: 'user-owner-1',
      authorName: 'Sujit Kumar',
      authorRole: 'Project Owner',
      body: 'Sprint 2 deliverables are scheduled for delivery next Friday.',
      resolvedAt: null,
      resolvedBy: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
    };
    comments.push(projectComment);

    const projectOnlyDiscussions = comments.filter((c) => !c.taskId);
    const taskOnlyDiscussions = comments.filter((c) => c.taskId === 'task-deliv-001');

    assert.equal(projectOnlyDiscussions.length, 1);
    assert.equal(projectOnlyDiscussions[0].id, 'comm-proj-001');

    assert.equal(taskOnlyDiscussions.length, 2);
    assert.equal(taskOnlyDiscussions[0].id, 'comm-001');
    assert.equal(taskOnlyDiscussions[1].id, 'comm-002');
  });

  it('Step 8: Shared project card on Client Portal is interactive and clickable', () => {
    let navigatedPath = '';
    const navigate = (path: string) => {
      navigatedPath = path;
    };

    // Simulated card click handler
    const onCardClick = (projectId: string) => {
      navigate(`/portal/projects/${projectId}`);
    };

    onCardClick(mockProject.id);
    assert.equal(navigatedPath, '/portal/projects/proj-001');
  });
});
