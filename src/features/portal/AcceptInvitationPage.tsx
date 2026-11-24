import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  FolderKanban,
  LogIn,
  LogOut,
  Shield,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { sharingService } from '../../services/sharingService';
import { Button } from '../../components/ui/Button';

interface InvitationPreviewState {
  projectName: string;
  projectDescription?: string;
  invitedEmail: string;
}

export function AcceptInvitationPage() {
  const { token } = useParams<{ token: string }>();
  const { user, isLoading: authLoading, signOut, refreshRole } = useAuth();
  const navigate = useNavigate();

  const [preview, setPreview] = useState<InvitationPreviewState | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [accepting, setAccepting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Fetch invitation preview on load
  useEffect(() => {
    let isMounted = true;
    if (!token) {
      setPreviewError('Missing invitation token.');
      setLoadingPreview(false);
      return;
    }

    setLoadingPreview(true);
    setPreviewError(null);

    sharingService.getInvitationByToken(token).then((res) => {
      if (!isMounted) return;
      if (res.error || !res.data) {
        setPreviewError(res.error || 'Invalid or expired invitation token.');
      } else {
        setPreview({
          projectName: res.data.projectName,
          projectDescription: res.data.projectDescription,
          invitedEmail: res.data.invitedEmail,
        });
      }
      setLoadingPreview(false);
    });

    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;
    setAccepting(true);
    setErrorMsg(null);

    const res = await sharingService.acceptInvitation(token);
    setAccepting(false);

    if (res.error) {
      setErrorMsg(res.error);
    } else if (res.projectId) {
      setSuccess(true);
      await refreshRole();
      setTimeout(() => {
        navigate(`/portal/projects/${res.projectId}`, { replace: true });
      }, 1200);
    }
  };

  const isEmailMatching =
    user && preview && user.email?.trim().toLowerCase() === preview.invitedEmail.trim().toLowerCase();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-[#F4F7FC] via-white to-[#EDF2FE] p-4 sm:p-6 text-[#1A1F2C]">
      <div className="w-full max-w-md rounded-[28px] border border-[#E9ECF5] bg-white p-8 shadow-[0_25px_60px_rgba(25,45,100,0.08)]">
        {/* Brand Header */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-[#2F65F6] to-[#5584F8] shadow-md text-white font-black text-base">
            W
          </div>
          <span className="font-bold tracking-tight text-xl text-[#1A1F2C]">
            My Work Planner
          </span>
        </div>

        {/* Content */}
        <div className="text-center space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EDF2FE] text-[#2F65F6]">
            <FolderKanban className="h-7 w-7" />
          </div>

          <h1 className="text-xl font-bold tracking-tight text-[#1A1F2C]">
            Project Collaboration Invite
          </h1>

          {preview ? (
            <div className="rounded-2xl border border-[#E9ECF5] bg-[#F8FAFD] p-4 text-left space-y-1.5">
              <span className="text-[11px] font-semibold text-[#7E8B9B] uppercase tracking-wider">
                Invited Project
              </span>
              <p className="text-base font-bold text-[#1A1F2C]">{preview.projectName}</p>
              {preview.projectDescription && (
                <p className="text-xs text-[#475467] leading-relaxed line-clamp-2">
                  {preview.projectDescription}
                </p>
              )}
              <div className="pt-1 text-xs text-[#7E8B9B]">
                Sent to: <span className="font-semibold text-[#1A1F2C]">{preview.invitedEmail}</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-[#7E8B9B] leading-relaxed">
              You have received an invitation to collaborate on a shared project in My Work Planner.
            </p>
          )}
        </div>

        {/* State Handling */}
        <div className="mt-6 pt-4 border-t border-[#F0F2F5]">
          {loadingPreview || authLoading ? (
            <div className="py-6 text-center text-xs text-[#7E8B9B]">Verifying invitation...</div>
          ) : previewError ? (
            <div className="rounded-2xl border border-[#FCE8E9] bg-[#FFF5F5] p-4 text-center space-y-3">
              <XCircle className="mx-auto h-7 w-7 text-[#C2414B]" />
              <p className="text-sm font-bold text-[#C2414B]">Unable to Accept Invite</p>
              <p className="text-xs text-[#475467] leading-relaxed">{previewError}</p>
              <Link
                to="/sign-in"
                className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-[#2F65F6] hover:underline pt-2"
              >
                <span>Go to Sign In</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : !user ? (
            <div className="space-y-4">
              <div className="rounded-xl bg-[#FEF3E2] p-3 text-xs text-[#B7791F] flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  Please sign in with <strong className="text-[#875508]">{preview?.invitedEmail}</strong> to accept this invitation.
                </span>
              </div>
              <Link
                to={`/sign-in?returnTo=${encodeURIComponent(window.location.pathname)}&email=${encodeURIComponent(preview?.invitedEmail || '')}`}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2F65F6] py-2.5 text-xs font-semibold text-white shadow-md hover:bg-[#2554DB] transition-all"
              >
                <LogIn className="h-4 w-4" />
                <span>Sign In to Accept</span>
              </Link>
            </div>
          ) : success ? (
            <div className="rounded-2xl border border-[#BDE8C8] bg-[#EAF7EE] p-5 text-center space-y-2">
              <CheckCircle2 className="mx-auto h-8 w-8 text-[#16845B]" />
              <p className="text-sm font-bold text-[#16845B]">Invitation Accepted!</p>
              <p className="text-xs text-[#344054]">
                Joining project workspace...
              </p>
            </div>
          ) : !isEmailMatching ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#FCE8E9] bg-[#FFF5F5] p-4 space-y-2 text-xs text-[#475467]">
                <div className="flex items-center gap-2 font-bold text-[#C2414B]">
                  <AlertCircle className="h-4 w-4" />
                  <span>Account Mismatch</span>
                </div>
                <p>
                  This invitation was sent to <strong className="text-[#1A1F2C]">{preview?.invitedEmail}</strong>, but you are signed in as <strong className="text-[#1A1F2C]">{user.email}</strong>.
                </p>
                <p className="text-[#7E8B9B]">
                  Please sign out and sign in with the invited email address to join this project.
                </p>
              </div>

              <Button
                type="button"
                variant="secondary"
                onClick={() => signOut()}
                className="w-full flex items-center justify-center gap-2 text-xs py-2.5"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out &amp; Switch Account</span>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl bg-[#F8FAFD] p-3 text-xs text-[#475467] flex items-center justify-between">
                <span>Signed in as:</span>
                <strong className="text-[#1A1F2C]">{user.email}</strong>
              </div>

              {errorMsg && (
                <div className="rounded-xl bg-[#FCE8E9] p-3 text-xs text-[#C2414B] flex items-start gap-2">
                  <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <Button
                type="button"
                variant="primary"
                onClick={handleAccept}
                disabled={accepting}
                className="w-full flex items-center justify-center gap-2 py-3 font-semibold text-xs shadow-md"
              >
                <Check className="h-4 w-4" />
                <span>{accepting ? 'Accepting Invitation...' : 'Accept & Join Project'}</span>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
