import type { Project } from './models';

export type ProjectMemberRole = 'owner' | 'client';
export type ProjectMembershipStatus = 'pending' | 'accepted' | 'revoked';
export type ClientProjectStatus = 'on_track' | 'at_risk' | 'delayed' | 'completed';
export type InvitationDeliveryStatus = 'queued' | 'sent' | 'failed';
export type RealtimeConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'offline' | 'error';

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string | null;
  invitedEmail: string;
  role: ProjectMemberRole;
  membershipStatus: ProjectMembershipStatus;
  invitedBy: string;
  invitedAt: string;
  acceptedAt: string | null;
  createdAt: string;
  updatedAt: string;
  userDisplayName?: string | null;
}

export interface ProjectInvitation {
  id: string;
  projectId: string;
  invitedEmail: string;
  tokenHash: string;
  role: ProjectMemberRole;
  invitedBy: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  deliveryStatus: InvitationDeliveryStatus;
  deliveryError?: string | null;
  sentAt?: string | null;
  deliveryProviderMessageId?: string | null;
  resendCount: number;
}

export interface ProjectComment {
  id: string;
  projectId: string;
  taskId: string | null;
  parentCommentId: string | null;
  authorId: string;
  body: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  authorName?: string;
  authorEmail?: string;
  authorRole?: 'Project Owner' | 'Client Collaborator';
  isOwnerComment?: boolean;
  projectName?: string;
  taskTitle?: string | null;
  replies?: ProjectComment[];
}

export type TaskRequestPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskRequestStatus =
  | 'submitted'
  | 'under_review'
  | 'needs_information'
  | 'approved'
  | 'rejected'
  | 'withdrawn';

export interface ProjectTaskRequest {
  id: string;
  projectId: string;
  requestedBy: string;
  title: string;
  description: string | null;
  reason: string | null;
  suggestedPriority: TaskRequestPriority;
  requestedDueDate: string | null;
  status: TaskRequestStatus;
  ownerFeedback: string | null;
  createdTaskId: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  createdAt: string;
  updatedAt: string;
  requesterName?: string;
  requesterEmail?: string;
  projectName?: string;
  projectColor?: string;
}

export interface ConversationRead {
  id: string;
  userId: string;
  projectId: string;
  taskId: string | null;
  lastReadAt: string;
}

export type InboxFilterType = 'all' | 'project_discussions' | 'task_discussions' | 'task_requests';

export interface InboxConversationItem {
  id: string;
  type: 'project_discussion' | 'task_discussion' | 'task_request';
  projectId: string;
  projectName: string;
  projectColor?: string;
  taskId: string | null;
  taskTitle: string | null;
  senderName: string;
  senderRole: 'Project Owner' | 'Client Collaborator';
  lastMessageSnippet: string;
  lastActivityAt: string;
  unreadCount: number;
  requestStatus?: TaskRequestStatus;
  taskRequest?: ProjectTaskRequest;
}

export interface ProjectUpdate {
  id: string;
  projectId: string;
  authorId: string;
  status: ClientProjectStatus;
  progressSnapshot: number | null;
  message: string;
  targetCompletionDate: string | null;
  createdAt: string;
  updatedAt: string;
  authorName?: string;
}

export interface ProjectNotification {
  id: string;
  recipientUserId: string;
  projectId: string;
  commentId: string | null;
  notificationType:
    | 'project_invitation'
    | 'invitation_accepted'
    | 'project_comment'
    | 'task_comment'
    | 'comment_reply'
    | 'project_update'
    | 'access_revoked';
  title: string;
  body: string;
  readAt: string | null;
  isRead: boolean;
  createdAt: string;
  projectName?: string;
}

export interface SharedProjectView extends Project {
  clientVisibleTaskCount: number;
  completedClientVisibleTaskCount: number;
  totalRemainingEstimateMinutes: number;
  totalActualSeconds: number;
}

export interface ShareProjectInput {
  projectId: string;
  invitedEmail: string;
  role?: ProjectMemberRole;
  personalMessage?: string;
}

export interface ProjectSharingSettings {
  clientShareEnabled: boolean;
  clientViewTimeTracking: boolean;
  clientViewRemainingEstimate: boolean;
  clientViewTaskDates: boolean;
  clientAllowComments: boolean;
  clientProjectStatus: ClientProjectStatus;
  targetCompletionDate: string | null;
}
