import React, { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Globe,
  Link as LinkIcon,
  Mail,
  RefreshCw,
  Send,
  Shield,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { sharingService } from '../../services/sharingService';
import type {
  ClientProjectStatus,
  ProjectInvitation,
  ProjectMember,
  ProjectSharingSettings,
} from '../../types/sharing';
import type { Project } from '../../types/models';
import {
  InvitationDeliveryBadge,
  InvitationLifecycleBadge,
  MembershipStatusBadge,
} from '../ui/Badges';
import { Button } from '../ui/Button';

interface ShareProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  onProjectUpdated?: (updated: Project) => void;
}

export function ShareProjectModal({
  isOpen,
  onClose,
  project,
  onProjectUpdated,
}: ShareProjectModalProps) {
  const [activeTab, setActiveTab] = useState<'invite' | 'members' | 'settings'>('invite');
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [invitations, setInvitations] = useState<ProjectInvitation[]>([]);
  const [loading, setLoading] = useState(false);

  // Invite state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteSuccessLink, setInviteSuccessLink] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteDeliveryNotice, setInviteDeliveryNotice] = useState<{
    type: 'success' | 'warning';
    message: string;
  } | null>(null);

  // Resend / Revoke state
  const [resendingEmail, setResendingEmail] = useState<string | null>(null);
  const [copyingLinkEmail, setCopyingLinkEmail] = useState<string | null>(null);
  const [copyLinkSuccessEmail, setCopyLinkSuccessEmail] = useState<string | null>(null);
  const [cachedLinks, setCachedLinks] = useState<Record<string, string>>({});
  const [resendFeedback, setResendFeedback] = useState<{
    type: 'success' | 'warning';
    message: string;
  } | null>(null);

  // Settings state
  const [clientShareEnabled, setClientShareEnabled] = useState(
    project.clientShareEnabled ?? false
  );
  const [clientProjectStatus, setClientProjectStatus] = useState<ClientProjectStatus>(
    project.clientProjectStatus || 'on_track'
  );
  const [targetCompletionDate, setTargetCompletionDate] = useState(
    project.targetCompletionDate || ''
  );
  const [clientViewTimeTracking, setClientViewTimeTracking] = useState(
    project.clientViewTimeTracking ?? true
  );
  const [clientViewRemainingEstimate, setClientViewRemainingEstimate] = useState(
    project.clientViewRemainingEstimate ?? true
  );
  const [clientViewTaskDates, setClientViewTaskDates] = useState(
    project.clientViewTaskDates ?? true
  );
  const [clientAllowComments, setClientAllowComments] = useState(
    project.clientAllowComments ?? true
  );
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsFeedback, setSettingsFeedback] = useState<string | null>(null);

  const activeClients = members.filter((m) => m.membershipStatus === 'accepted');
  const pendingInvitations = invitations.filter((i) => !i.acceptedAt && !i.revokedAt);

  useEffect(() => {
    if (isOpen) {
      loadMembersAndInvites();
      setClientShareEnabled(project.clientShareEnabled ?? false);
      setClientProjectStatus(project.clientProjectStatus || 'on_track');
      setTargetCompletionDate(project.targetCompletionDate || '');
      setClientViewTimeTracking(project.clientViewTimeTracking ?? true);
      setClientViewRemainingEstimate(project.clientViewRemainingEstimate ?? true);
      setClientViewTaskDates(project.clientViewTaskDates ?? true);
      setClientAllowComments(project.clientAllowComments ?? true);
      setInviteError(null);
      setInviteSuccessLink(null);
      setInviteDeliveryNotice(null);
      setResendFeedback(null);
      setSettingsFeedback(null);
    }
  }, [isOpen, project]);

  const loadMembersAndInvites = async () => {
    setLoading(true);
    const [membersRes, invitesRes] = await Promise.all([
      sharingService.getProjectMembers(project.id),
      sharingService.getProjectInvitations(project.id),
    ]);
    if (membersRes.data) setMembers(membersRes.data);
    if (invitesRes.data) setInvitations(invitesRes.data);
    setLoading(false);
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inviteSubmitting) return;
    setInviteError(null);
    setInviteSuccessLink(null);
    setInviteDeliveryNotice(null);

    const email = inviteEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      setInviteError('Please enter a valid client email address.');
      return;
    }

    setInviteSubmitting(true);
    const res = await sharingService.createInvitation({
      projectId: project.id,
      email,
      role: 'client',
      personalMessage: inviteMessage.trim() || undefined,
    });
    setInviteSubmitting(false);

    if (res.error) {
      setInviteError(res.error);
    } else if (res.data?.inviteLink) {
      setInviteSuccessLink(res.data.inviteLink);
      setCachedLinks((prev) => ({ ...prev, [email]: res.data!.inviteLink }));
      if (res.data.emailDelivery === 'sent') {
        setInviteDeliveryNotice({
          type: 'success',
          message: `Invitation email dispatched to ${email}.`,
        });
      } else {
        setInviteDeliveryNotice({
          type: 'warning',
          message:
            'Email could not be sent automatically. You can copy and share the secure invitation link manually.',
        });
      }
      setInviteEmail('');
      setInviteMessage('');
      loadMembersAndInvites();
    }
  };

  const handleCopyPendingLink = async (email: string) => {
    setCopyingLinkEmail(email);
    setResendFeedback(null);
    try {
      let linkToCopy = cachedLinks[email];
      if (!linkToCopy) {
        const res = await sharingService.reissueInvitationLink(project.id, email);
        if (res.error) {
          setResendFeedback({
            type: 'warning',
            message: `Failed to generate link: ${res.error}`,
          });
          setCopyingLinkEmail(null);
          return;
        }
        if (res.data?.inviteLink) {
          linkToCopy = res.data.inviteLink;
          setCachedLinks((prev) => ({ ...prev, [email]: res.data!.inviteLink }));
        }
      }

      if (linkToCopy) {
        await navigator.clipboard.writeText(linkToCopy);
        setCopyLinkSuccessEmail(email);
        setResendFeedback({
          type: 'success',
          message: `Secure invitation link copied to clipboard for ${email}! Anyone with the link must still authenticate with ${email} to accept.`,
        });
        setTimeout(() => {
          setCopyLinkSuccessEmail(null);
          setResendFeedback(null);
        }, 5000);
      }
    } catch (err: any) {
      setResendFeedback({
        type: 'warning',
        message: `Clipboard error: ${err.message || 'Please grant clipboard permissions to copy link.'}`,
      });
    } finally {
      setCopyingLinkEmail(null);
    }
  };

  const handleResendInvite = async (email: string) => {
    setResendingEmail(email);
    setResendFeedback(null);
    const res = await sharingService.resendInvitation(project.id, email);
    setResendingEmail(null);

    if (res.error) {
      setResendFeedback({
        type: 'warning',
        message: `Failed to resend: ${res.error}`,
      });
    } else if (res.data?.inviteLink) {
      setCachedLinks((prev) => ({ ...prev, [email]: res.data!.inviteLink }));

      if (res.data.emailDelivery === 'sent') {
        setResendFeedback({
          type: 'success',
          message: `Invitation email dispatched to ${email}.`,
        });
      } else {
        setResendFeedback({
          type: 'warning',
          message:
            'Email could not be sent automatically. You can copy and share the secure invitation link manually.',
        });
      }
      setTimeout(() => setResendFeedback(null), 6000);
      loadMembersAndInvites();
    }
  };

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleRevokeInvite = async (invitationId: string) => {
    if (!window.confirm('Are you sure you want to revoke this invitation?')) return;
    const res = await sharingService.revokeInvitation(invitationId);
    if (res.success) {
      loadMembersAndInvites();
    } else {
      alert(res.error || 'Failed to revoke invitation');
    }
  };

  const handleRemoveMember = async (memberId: string, memberEmail: string) => {
    if (
      !window.confirm(
        `Remove ${memberEmail} from this project? They will no longer have access to tasks or discussions.`
      )
    )
      return;
    const res = await sharingService.removeProjectMember(memberId);
    if (res.success) {
      loadMembersAndInvites();
    } else {
      alert(res.error || 'Failed to remove member');
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setSettingsFeedback(null);
    const updatePayload: Partial<ProjectSharingSettings> = {
      clientShareEnabled,
      clientProjectStatus,
      targetCompletionDate: targetCompletionDate || null,
      clientViewTimeTracking,
      clientViewRemainingEstimate,
      clientViewTaskDates,
      clientAllowComments,
    };

    const res = await sharingService.updateProjectSharingSettings(project.id, updatePayload);
    setSavingSettings(false);

    if (res.error) {
      setSettingsFeedback(`Error: ${res.error}`);
    } else {
      setSettingsFeedback('Sharing settings saved successfully.');
      if (onProjectUpdated) {
        onProjectUpdated({
          ...project,
          clientShareEnabled,
          clientProjectStatus,
          targetCompletionDate: targetCompletionDate || null,
          clientViewTimeTracking,
          clientViewRemainingEstimate,
          clientViewTaskDates,
          clientAllowComments,
        });
      }
      setTimeout(() => setSettingsFeedback(null), 3000);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#0F172A]/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog Card */}
      <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col rounded-[24px] border border-[#E9ECF5] bg-white shadow-[0_25px_60px_rgba(25,45,100,0.18)] z-10 overflow-hidden">
        {/* Sticky Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#E9ECF5] bg-gradient-to-b from-white to-[#F8FAFD] px-6 py-4">
          <div className="flex items-center gap-3">
            <span
              className="h-3.5 w-3.5 shrink-0 rounded-full shadow-sm"
              style={{ backgroundColor: project.color }}
            />
            <div>
              <h2 id="share-modal-title" className="text-lg font-bold text-[#1A1F2C]">
                Share Project — {project.name}
              </h2>
              <p className="text-xs text-[#7E8B9B]">
                Invite clients, manage visibility and control access permissions.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#7E8B9B] hover:bg-[#F0F2F5] hover:text-[#1A1F2C] transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#E9ECF5] bg-white px-6">
          <button
            type="button"
            onClick={() => setActiveTab('invite')}
            className={`flex items-center gap-2 border-b-2 py-3 px-4 text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'invite'
                ? 'border-[#2F65F6] text-[#2F65F6]'
                : 'border-transparent text-[#7E8B9B] hover:text-[#1A1F2C]'
            }`}
          >
            <Mail className="h-4 w-4" />
            <span>Invite Client</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('members')}
            className={`flex items-center gap-2 border-b-2 py-3 px-4 text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'members'
                ? 'border-[#2F65F6] text-[#2F65F6]'
                : 'border-transparent text-[#7E8B9B] hover:text-[#1A1F2C]'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Clients &amp; Invites ({activeClients.length + pendingInvitations.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 border-b-2 py-3 px-4 text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'settings'
                ? 'border-[#2F65F6] text-[#2F65F6]'
                : 'border-transparent text-[#7E8B9B] hover:text-[#1A1F2C]'
            }`}
          >
            <Shield className="h-4 w-4" />
            <span>Client Visibility &amp; Controls</span>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {activeTab === 'invite' && (
            <div className="space-y-5">
              <form onSubmit={handleSendInvite} className="space-y-4">
                <div>
                  <label
                    htmlFor="invite-email"
                    className="block text-xs font-semibold text-[#1A1F2C]"
                  >
                    Client Email Address <span className="text-[#C2414B]">*</span>
                  </label>
                  <p className="mt-0.5 text-xs text-[#7E8B9B]">
                    The client will receive an invitation link to view this project in the Client
                    Portal.
                  </p>
                  <div className="relative mt-2">
                    <Mail className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#7E8B9B]" />
                    <input
                      id="invite-email"
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="client@company.com"
                      required
                      className="w-full rounded-xl border border-[#E9ECF5] bg-[#F8FAFD] pl-9 pr-3 py-2 text-sm text-[#1A1F2C] placeholder:text-[#98A2B3] focus:border-[#2F65F6] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#2F65F6]"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="invite-note"
                    className="block text-xs font-semibold text-[#1A1F2C]"
                  >
                    Personal Message <span className="font-normal text-[#7E8B9B]">(Optional)</span>
                  </label>
                  <textarea
                    id="invite-note"
                    rows={2}
                    value={inviteMessage}
                    onChange={(e) => setInviteMessage(e.target.value)}
                    placeholder="Hi! Here is our project workspace where you can review approved tasks, milestone progress and share notes."
                    className="mt-1.5 w-full rounded-xl border border-[#E9ECF5] bg-[#F8FAFD] p-3 text-sm text-[#1A1F2C] placeholder:text-[#98A2B3] focus:border-[#2F65F6] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#2F65F6]"
                  />
                </div>

                <div className="rounded-xl border border-[#EDF2FE] bg-[#F8FAFD] p-3 text-xs text-[#475467] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-[#2F65F6]" />
                    <span>
                      Access level: <strong>Client — View &amp; Comment</strong> (Client-visible tasks
                      only)
                    </span>
                  </div>
                </div>

                {inviteError && (
                  <p className="rounded-lg bg-[#FCE8E9] p-2.5 text-xs font-medium text-[#C2414B]">
                    {inviteError}
                  </p>
                )}

                <div className="flex justify-end pt-2">
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={inviteSubmitting}
                    className="flex items-center gap-2"
                  >
                    <Send className="h-4 w-4" />
                    <span>{inviteSubmitting ? 'Sending Invite...' : 'Send Invitation'}</span>
                  </Button>
                </div>
              </form>

              {/* Generated Invite Link Card */}
              {inviteSuccessLink && (
                <div
                  className={`mt-4 rounded-2xl border p-4 ${
                    inviteDeliveryNotice?.type === 'warning'
                      ? 'border-[#FEDF89] bg-[#FFFAEB]'
                      : 'border-[#BDE8C8] bg-[#EAF7EE]/60'
                  }`}
                >
                  <div
                    className={`flex items-center gap-2 text-xs font-bold ${
                      inviteDeliveryNotice?.type === 'warning' ? 'text-[#B54708]' : 'text-[#16845B]'
                    }`}
                  >
                    <Check className="h-4 w-4" />
                    <span>Invitation Created Successfully!</span>
                  </div>
                  {inviteDeliveryNotice && (
                    <p
                      className={`mt-1 text-xs font-medium ${
                        inviteDeliveryNotice.type === 'warning'
                          ? 'text-[#B54708]'
                          : 'text-[#16845B]'
                      }`}
                    >
                      {inviteDeliveryNotice.message}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-[#344054]">
                    Share this direct single-use link with your client:
                  </p>
                  <div className="mt-2.5 flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={inviteSuccessLink}
                      className="flex-1 rounded-xl border border-[#D0D5DD] bg-white px-3 py-2 text-xs font-mono text-[#1A1F2C]"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopyLink(inviteSuccessLink)}
                      className="flex items-center gap-1.5 rounded-xl bg-[#16845B] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#126b4a] transition-all cursor-pointer"
                    >
                      {copiedLink ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'members' && (
            <div className="space-y-6">
              {/* Active Members */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#7E8B9B]">
                  Active Clients ({activeClients.length})
                </h3>
                {activeClients.length === 0 ? (
                  <p className="mt-2 text-xs text-[#7E8B9B] italic">
                    No active clients have accepted invitations yet.
                  </p>
                ) : (
                  <div className="mt-3 divide-y divide-[#F0F2F5] rounded-xl border border-[#E9ECF5]">
                    {activeClients.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-3 text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EDF2FE] font-bold text-[#2F65F6]">
                            {(member.invitedEmail || 'C')[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-[#1A1F2C]">{member.invitedEmail}</p>
                            <p className="text-[11px] text-[#7E8B9B]">
                              Joined {member.acceptedAt ? new Date(member.acceptedAt).toLocaleDateString() : '—'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <MembershipStatusBadge status={member.membershipStatus} />
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(member.id, member.invitedEmail)}
                            className="flex h-7 w-7 items-center justify-center rounded text-[#7E8B9B] hover:bg-[#FCE8E9] hover:text-[#C2414B] transition-colors"
                            title="Remove member"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pending Invitations */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#7E8B9B]">
                  Pending Invitations ({pendingInvitations.length})
                </h3>

                {resendFeedback && (
                  <div
                    className={`mt-2 rounded-xl p-3 text-xs font-medium flex items-center gap-2 ${
                      resendFeedback.type === 'success'
                        ? 'bg-[#EAF7EE] text-[#16845B] border border-[#BDE8C8]'
                        : 'bg-[#FFFAEB] text-[#B54708] border border-[#FEDF89]'
                    }`}
                  >
                    <Check className="h-4 w-4 shrink-0" />
                    <span>{resendFeedback.message}</span>
                  </div>
                )}

                {pendingInvitations.length === 0 ? (
                  <p className="mt-2 text-xs text-[#7E8B9B] italic">No pending invitations.</p>
                ) : (
                  <div className="mt-3 divide-y divide-[#F0F2F5] rounded-xl border border-[#E9ECF5]">
                    {pendingInvitations.map((inv) => {
                      const isExpired = new Date(inv.expiresAt) < new Date();
                      return (
                        <div
                          key={inv.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 gap-2 text-xs"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-[#1A1F2C]">{inv.invitedEmail}</p>
                              <InvitationLifecycleBadge
                                isExpired={isExpired}
                                revokedAt={inv.revokedAt}
                                acceptedAt={inv.acceptedAt}
                              />
                              <InvitationDeliveryBadge
                                status={inv.deliveryStatus}
                                sentAt={inv.sentAt}
                                error={inv.deliveryError}
                              />
                              {(inv.resendCount ?? 0) > 0 && (
                                <span className="text-[10px] text-[#7E8B9B] bg-[#F0F2F5] px-1.5 py-0.5 rounded">
                                  Resent x{inv.resendCount}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-[#7E8B9B]">
                              Expires {new Date(inv.expiresAt).toLocaleDateString()}
                              {inv.sentAt && inv.deliveryStatus === 'sent' && (
                                <span className="text-[#16845B] ml-2">
                                  • Sent {new Date(inv.sentAt).toLocaleDateString()}
                                </span>
                              )}
                              {inv.deliveryError && inv.deliveryStatus === 'failed' && (
                                <span className="block text-[#C2414B] font-normal text-[10px] mt-0.5">
                                  {inv.deliveryError}
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {/* Explicit Copy Link Button */}
                            <button
                              type="button"
                              disabled={copyingLinkEmail === inv.invitedEmail}
                              onClick={() => handleCopyPendingLink(inv.invitedEmail)}
                              className="flex items-center gap-1 rounded-lg border border-[#E9ECF5] bg-white px-2.5 py-1 text-[11px] font-medium text-[#1A1F2C] hover:bg-[#F8FAFD] hover:border-[#2F65F6] hover:text-[#2F65F6] transition-colors cursor-pointer disabled:opacity-50"
                              title="Copy secure invitation link"
                            >
                              {copyLinkSuccessEmail === inv.invitedEmail ? (
                                <Check className="h-3 w-3 text-[#16845B]" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                              <span>
                                {copyingLinkEmail === inv.invitedEmail
                                  ? 'Generating...'
                                  : copyLinkSuccessEmail === inv.invitedEmail
                                  ? 'Copied'
                                  : 'Copy Link'}
                              </span>
                            </button>

                            {/* Independent Resend Email Button */}
                            <button
                              type="button"
                              disabled={resendingEmail === inv.invitedEmail}
                              onClick={() => handleResendInvite(inv.invitedEmail)}
                              className="flex items-center gap-1 rounded-lg border border-[#E9ECF5] bg-white px-2.5 py-1 text-[11px] font-medium text-[#1A1F2C] hover:bg-[#F8FAFD] hover:border-[#2F65F6] hover:text-[#2F65F6] transition-colors cursor-pointer disabled:opacity-50"
                              title="Resend invitation email"
                            >
                              <RefreshCw
                                className={`h-3 w-3 ${
                                  resendingEmail === inv.invitedEmail ? 'animate-spin' : ''
                                }`}
                              />
                              <span>
                                {resendingEmail === inv.invitedEmail ? 'Sending...' : 'Resend Email'}
                              </span>
                            </button>

                            {/* Revoke Button */}
                            <button
                              type="button"
                              onClick={() => handleRevokeInvite(inv.id)}
                              className="flex items-center gap-1 rounded-lg border border-transparent px-2 py-1 text-[11px] font-medium text-[#7E8B9B] hover:bg-[#FCE8E9] hover:text-[#C2414B] transition-colors cursor-pointer"
                              title="Revoke invitation"
                            >
                              <X className="h-3.5 w-3.5" />
                              <span>Revoke</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-5">
              {/* Main Sharing Toggle */}
              <div className="flex items-center justify-between rounded-2xl border border-[#E9ECF5] bg-[#F8FAFD] p-4">
                <div>
                  <h4 className="text-sm font-semibold text-[#1A1F2C]">Enable Client Portal</h4>
                  <p className="text-xs text-[#7E8B9B]">
                    Allow invited clients to access their shared workspace for this project.
                  </p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={clientShareEnabled}
                    onChange={(e) => setClientShareEnabled(e.target.checked)}
                    className="peer sr-only"
                  />
                  <div className="h-6 w-11 rounded-full bg-[#D0D5DD] transition-all peer-checked:bg-[#2F65F6] after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full" />
                </label>
              </div>

              {/* Status & Target Date */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#1A1F2C]">
                    Client Project Status
                  </label>
                  <select
                    value={clientProjectStatus}
                    onChange={(e) =>
                      setClientProjectStatus(e.target.value as ClientProjectStatus)
                    }
                    className="mt-1.5 w-full rounded-xl border border-[#E9ECF5] bg-white px-3 py-2 text-xs font-medium text-[#1A1F2C] focus:border-[#2F65F6] focus:outline-none"
                  >
                    <option value="on_track">On Track</option>
                    <option value="at_risk">At Risk</option>
                    <option value="delayed">Delayed</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1A1F2C]">
                    Target Completion Date
                  </label>
                  <input
                    type="date"
                    value={targetCompletionDate}
                    onChange={(e) => setTargetCompletionDate(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-[#E9ECF5] bg-white px-3 py-2 text-xs font-medium text-[#1A1F2C] focus:border-[#2F65F6] focus:outline-none"
                  />
                </div>
              </div>

              {/* Granular Visibility Toggles */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#7E8B9B]">
                  Client Visibility Controls
                </h4>

                <label className="flex items-center justify-between rounded-xl border border-[#E9ECF5] p-3 text-xs cursor-pointer hover:bg-[#F8FAFD]">
                  <div>
                    <span className="font-semibold text-[#1A1F2C]">
                      Show Tracked Time &amp; Hours
                    </span>
                    <p className="text-[11px] text-[#7E8B9B]">
                      Display saved actual logged work hours on client-visible tasks.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={clientViewTimeTracking}
                    onChange={(e) => setClientViewTimeTracking(e.target.checked)}
                    className="h-4 w-4 rounded text-[#2F65F6] focus:ring-[#2F65F6]"
                  />
                </label>

                <label className="flex items-center justify-between rounded-xl border border-[#E9ECF5] p-3 text-xs cursor-pointer hover:bg-[#F8FAFD]">
                  <div>
                    <span className="font-semibold text-[#1A1F2C]">
                      Show Remaining Estimates
                    </span>
                    <p className="text-[11px] text-[#7E8B9B]">
                      Allow client to see estimated remaining minutes on visible tasks.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={clientViewRemainingEstimate}
                    onChange={(e) => setClientViewRemainingEstimate(e.target.checked)}
                    className="h-4 w-4 rounded text-[#2F65F6] focus:ring-[#2F65F6]"
                  />
                </label>

                <label className="flex items-center justify-between rounded-xl border border-[#E9ECF5] p-3 text-xs cursor-pointer hover:bg-[#F8FAFD]">
                  <div>
                    <span className="font-semibold text-[#1A1F2C]">
                      Show Scheduled Task Dates
                    </span>
                    <p className="text-[11px] text-[#7E8B9B]">
                      Display target scheduled dates and timeframes on tasks.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={clientViewTaskDates}
                    onChange={(e) => setClientViewTaskDates(e.target.checked)}
                    className="h-4 w-4 rounded text-[#2F65F6] focus:ring-[#2F65F6]"
                  />
                </label>

                <label className="flex items-center justify-between rounded-xl border border-[#E9ECF5] p-3 text-xs cursor-pointer hover:bg-[#F8FAFD]">
                  <div>
                    <span className="font-semibold text-[#1A1F2C]">
                      Allow Client Comments &amp; Discussions
                    </span>
                    <p className="text-[11px] text-[#7E8B9B]">
                      Enable clients to ask questions and discuss deliverables in this project.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={clientAllowComments}
                    onChange={(e) => setClientAllowComments(e.target.checked)}
                    className="h-4 w-4 rounded text-[#2F65F6] focus:ring-[#2F65F6]"
                  />
                </label>
              </div>

              {settingsFeedback && (
                <p
                  className={`rounded-lg p-2.5 text-xs font-medium ${
                    settingsFeedback.startsWith('Error')
                      ? 'bg-[#FCE8E9] text-[#C2414B]'
                      : 'bg-[#EAF7EE] text-[#16845B]'
                  }`}
                >
                  {settingsFeedback}
                </p>
              )}

              <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleSaveSettings}
                  disabled={savingSettings}
                >
                  {savingSettings ? 'Saving...' : 'Save Settings'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
