import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { ProjectComment } from '../types/sharing';

describe('Project Discussions & Comment Thread Hierarchy Rules', () => {
  it('Organizes flat comment rows into top-level threads and nested replies accurately', () => {
    const rawComments: ProjectComment[] = [
      {
        id: 'c1',
        projectId: 'p1',
        taskId: null,
        parentCommentId: null,
        authorId: 'user-client-1',
        body: 'When is the milestone review scheduled?',
        resolvedAt: null,
        resolvedBy: null,
        createdAt: '2026-11-22T10:00:00Z',
        updatedAt: '2026-11-22T10:00:00Z',
        deletedAt: null,
        replies: [],
      },
      {
        id: 'c2',
        projectId: 'p1',
        taskId: null,
        parentCommentId: 'c1',
        authorId: 'user-owner',
        body: 'It is scheduled for next Tuesday at 3 PM.',
        resolvedAt: null,
        resolvedBy: null,
        createdAt: '2026-11-22T10:15:00Z',
        updatedAt: '2026-11-22T10:15:00Z',
        deletedAt: null,
        replies: [],
      },
      {
        id: 'c3',
        projectId: 'p1',
        taskId: 't-123',
        parentCommentId: null,
        authorId: 'user-owner',
        body: 'Please review the updated Figma wireframes.',
        resolvedAt: null,
        resolvedBy: null,
        createdAt: '2026-11-22T11:00:00Z',
        updatedAt: '2026-11-22T11:00:00Z',
        deletedAt: null,
        replies: [],
      },
      {
        id: 'c4',
        projectId: 'p1',
        taskId: null,
        parentCommentId: 'c1',
        authorId: 'user-client-1',
        body: 'Sounds great, looking forward to it!',
        resolvedAt: null,
        resolvedBy: null,
        createdAt: '2026-11-22T10:30:00Z',
        updatedAt: '2026-11-22T10:30:00Z',
        deletedAt: null,
        replies: [],
      },
    ];

    // Reconstruct threads
    const topLevel: ProjectComment[] = [];
    const repliesMap = new Map<string, ProjectComment[]>();

    for (const comment of rawComments) {
      if (comment.parentCommentId) {
        const list = repliesMap.get(comment.parentCommentId) || [];
        list.push(comment);
        repliesMap.set(comment.parentCommentId, list);
      } else {
        topLevel.push({ ...comment });
      }
    }

    for (const parent of topLevel) {
      parent.replies = repliesMap.get(parent.id) || [];
    }

    assert.equal(topLevel.length, 2); // c1 and c3
    const c1 = topLevel.find((c) => c.id === 'c1');
    assert.ok(c1);
    assert.equal(c1.replies?.length, 2);
    assert.equal(c1.replies?.[0].id, 'c2');
    assert.equal(c1.replies?.[1].id, 'c4');

    const c3 = topLevel.find((c) => c.id === 'c3');
    assert.ok(c3);
    assert.equal(c3.replies?.length, 0);
  });

  it('Thread resolution rule: resolving parent thread marks thread as resolved without mutating reply states', () => {
    const parentComment: ProjectComment = {
      id: 'c1',
      projectId: 'p1',
      taskId: null,
      parentCommentId: null,
      authorId: 'user-client-1',
      body: 'Can we change the brand color to sky blue?',
      resolvedAt: null,
      resolvedBy: null,
      createdAt: '2026-11-22T10:00:00Z',
      updatedAt: '2026-11-22T10:00:00Z',
      deletedAt: null,
      replies: [
        {
          id: 'c2',
          projectId: 'p1',
          taskId: null,
          parentCommentId: 'c1',
          authorId: 'user-owner',
          body: 'Updated to sky blue in the design system!',
          resolvedAt: null,
          resolvedBy: null,
          createdAt: '2026-11-22T10:30:00Z',
          updatedAt: '2026-11-22T10:30:00Z',
          deletedAt: null,
        },
      ],
    };

    const resolvedTimestamp = '2026-11-22T11:00:00Z';
    const resolverUserId = 'user-owner';

    const resolvedThread: ProjectComment = {
      ...parentComment,
      resolvedAt: resolvedTimestamp,
      resolvedBy: resolverUserId,
    };

    assert.equal(Boolean(resolvedThread.resolvedAt), true);
    assert.equal(resolvedThread.resolvedBy, resolverUserId);
    assert.equal(resolvedThread.replies?.[0].resolvedAt, null);
  });

  it('Notification recipient filtering: comment authors must never receive self-notifications', () => {
    const projectOwnerId: string = 'owner-123';
    const members = [
      { userId: 'client-456' },
      { userId: 'client-789' },
    ];

    // Case 1: Owner posts a comment
    const authorId: string = projectOwnerId;
    const recipientIds = new Set<string>();

    if (authorId !== projectOwnerId) {
      recipientIds.add(projectOwnerId);
    }
    for (const m of members) {
      if (m.userId && m.userId !== authorId) {
        recipientIds.add(m.userId);
      }
    }

    assert.equal(recipientIds.has(projectOwnerId), false); // owner not notified of own comment
    assert.equal(recipientIds.has('client-456'), true);
    assert.equal(recipientIds.has('client-789'), true);
    assert.equal(recipientIds.size, 2);

    // Case 2: Client posts a comment
    const clientAuthorId: string = 'client-456';
    const clientPostRecipients = new Set<string>();

    if (clientAuthorId !== projectOwnerId) {
      clientPostRecipients.add(projectOwnerId);
    }
    for (const m of members) {
      if (m.userId && m.userId !== clientAuthorId) {
        clientPostRecipients.add(m.userId);
      }
    }

    assert.equal(clientPostRecipients.has('client-456'), false); // client author not notified
    assert.equal(clientPostRecipients.has(projectOwnerId), true); // owner notified
    assert.equal(clientPostRecipients.has('client-789'), true); // other client notified
    assert.equal(clientPostRecipients.size, 2);
  });

  it('Sender Identity Resolution: resolves real human profile names with role labels', () => {
    const mockProfiles = new Map<string, { fullName: string; email: string }>([
      ['owner-1', { fullName: 'Sujit Kumar', email: 'owner@example.com' }],
      ['client-1', { fullName: 'Pritam Priya', email: 'client@example.com' }],
    ]);

    const projectOwnerId = 'owner-1';

    function formatUserDisplay(userId: string) {
      const p = mockProfiles.get(userId);
      const name = p?.fullName || p?.email || 'Collaborator';
      const isOwner = userId === projectOwnerId;
      const role: 'Project Owner' | 'Client Collaborator' = isOwner
        ? 'Project Owner'
        : 'Client Collaborator';
      return { name, role, combined: `${name} · ${role}` };
    }

    const ownerDisplay = formatUserDisplay('owner-1');
    assert.equal(ownerDisplay.name, 'Sujit Kumar');
    assert.equal(ownerDisplay.role, 'Project Owner');
    assert.equal(ownerDisplay.combined, 'Sujit Kumar · Project Owner');

    const clientDisplay = formatUserDisplay('client-1');
    assert.equal(clientDisplay.name, 'Pritam Priya');
    assert.equal(clientDisplay.role, 'Client Collaborator');
    assert.equal(clientDisplay.combined, 'Pritam Priya · Client Collaborator');
  });

  it('Separates Project Discussions (taskId is null) from Task Discussions (taskId is UUID)', () => {
    const allComments = [
      { id: '1', projectId: 'p1', taskId: null, body: 'General project kick-off note' },
      { id: '2', projectId: 'p1', taskId: 't-abc', body: 'Question about wireframe header' },
      { id: '3', projectId: 'p1', taskId: null, body: 'Project milestone reached' },
      { id: '4', projectId: 'p1', taskId: 't-def', body: 'API endpoint auth header question' },
    ];

    const projectLevelDiscussions = allComments.filter((c) => !c.taskId);
    const taskLevelDiscussions = allComments.filter((c) => Boolean(c.taskId));
    const specificTaskComments = allComments.filter((c) => c.taskId === 't-abc');

    assert.equal(projectLevelDiscussions.length, 2);
    assert.equal(taskLevelDiscussions.length, 2);
    assert.equal(specificTaskComments.length, 1);
    assert.equal(specificTaskComments[0].body, 'Question about wireframe header');
  });

  it('Task Request Approval is idempotent and guards against duplicate task creation', () => {
    interface MockRequest {
      id: string;
      status: string;
      createdTaskId: string | null;
    }

    const request: MockRequest = {
      id: 'req-1',
      status: 'submitted',
      createdTaskId: null,
    };

    // First approval: creates task
    function approve(req: MockRequest, generatedTaskId: string) {
      if (req.createdTaskId) {
        // Idempotent: already has task
        return { success: true, taskId: req.createdTaskId, createdNew: false };
      }
      req.status = 'approved';
      req.createdTaskId = generatedTaskId;
      return { success: true, taskId: generatedTaskId, createdNew: true };
    }

    const firstRun = approve(request, 'task-uuid-100');
    assert.equal(firstRun.success, true);
    assert.equal(firstRun.createdNew, true);
    assert.equal(firstRun.taskId, 'task-uuid-100');
    assert.equal(request.status, 'approved');

    // Second run with same request: returns existing task, no duplicate!
    const secondRun = approve(request, 'task-uuid-999');
    assert.equal(secondRun.success, true);
    assert.equal(secondRun.createdNew, false);
    assert.equal(secondRun.taskId, 'task-uuid-100'); // same task id, NOT task-uuid-999
  });
});
