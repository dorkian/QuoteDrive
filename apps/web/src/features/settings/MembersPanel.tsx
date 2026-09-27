import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { FIELD_CLASSES } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  ErrorState,
  LoadingRegion,
  Skeleton,
} from "../../components/states/StateViews";
import {
  fetchMembers,
  updateMemberRole,
  type Member,
  type Role,
} from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import {
  ApiError,
  describeError,
  type ErrorDescription,
} from "../../lib/errors";
import { ROLE_LABELS } from "../../lib/roles";

const ROLES = Object.keys(ROLE_LABELS) as Role[];

interface PendingChange {
  member: Member;
  role: Role;
}

export function MembersPanel() {
  const { token, me, refreshMe } = useAuth();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState<ErrorDescription | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState<PendingChange | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }
    fetchMembers(token)
      .then(setMembers)
      .catch((err: unknown) =>
        setError(
          describeError(err, { action: "load members", role: me?.role }),
        ),
      );
  }, [token, me?.role, attempt]);

  function retry(): void {
    setError(null);
    setMembers(null);
    setAttempt((n) => n + 1);
  }

  async function confirmChange(): Promise<void> {
    if (!token || !pending) {
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await updateMemberRole(
        token,
        pending.member.user_id,
        pending.role,
      );
      setMembers(
        (current) =>
          current?.map((m) => (m.user_id === updated.user_id ? updated : m)) ??
          null,
      );
      toast.success(
        `${updated.display_name} is now ${ROLE_LABELS[updated.role]}`,
      );
      setPending(null);
      if (updated.user_id === me?.user.id) {
        // Your own role changed: pick it up now so the UI stops offering
        // Admin-only controls.
        await refreshMe();
      }
    } catch (err) {
      setSaveError(
        err instanceof ApiError && err.status === 400 && err.detail
          ? `${err.detail}. Make someone else an Admin first.`
          : describeError(err, {
              action: "change roles",
              subject: "member",
              role: me?.role,
            }).message,
      );
    } finally {
      setSaving(false);
    }
  }

  if (error) {
    return (
      <ErrorState
        message={error.message}
        onRetry={error.retryable ? retry : undefined}
      />
    );
  }
  if (members === null) {
    return (
      <LoadingRegion label="Members loading" className="mt-4">
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      </LoadingRegion>
    );
  }

  const adminCount = members.filter((m) => m.role === "admin").length;
  const isSelfDemotion =
    pending !== null &&
    pending.member.user_id === me?.user.id &&
    pending.role !== "admin";

  return (
    <div>
      <p className="max-w-prose text-sm text-muted-foreground">
        Roles decide who can build proposals, approve them, or only view. Every
        change is recorded in the audit log.
      </p>
      <div className="mt-4">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Member</TableHead>
              <TableHead className="w-52">Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => {
              const isLastAdmin = member.role === "admin" && adminCount === 1;
              const isYou = member.user_id === me?.user.id;
              return (
                <TableRow key={member.user_id}>
                  <TableCell>
                    <span className="font-medium text-foreground">
                      {member.display_name}
                      {isYou && (
                        <span className="font-normal text-muted-foreground">
                          {" "}
                          (you)
                        </span>
                      )}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {member.email}
                    </span>
                  </TableCell>
                  <TableCell>
                    <select
                      aria-label={`Role for ${member.display_name}`}
                      value={member.role}
                      disabled={isLastAdmin}
                      aria-describedby={
                        isLastAdmin ? `last-admin-${member.user_id}` : undefined
                      }
                      onChange={(event) => {
                        setSaveError(null);
                        setPending({
                          member,
                          role: event.target.value as Role,
                        });
                      }}
                      className={cn(FIELD_CLASSES, "h-9")}
                    >
                      {ROLES.map((role) => (
                        <option key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </option>
                      ))}
                    </select>
                    {isLastAdmin && (
                      <span
                        id={`last-admin-${member.user_id}`}
                        className="mt-1 block text-xs text-muted-foreground"
                      >
                        The only Admin can&apos;t be changed.
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open && !saving) setPending(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Make {pending?.member.display_name}{" "}
              {pending ? ROLE_LABELS[pending.role] : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isSelfDemotion
                ? "You'll lose access to Settings immediately."
                : `They change from ${pending ? ROLE_LABELS[pending.member.role] : ""} on their next action.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {saveError && (
            <p className="text-sm text-destructive-foreground" role="alert">
              {saveError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <Button
              variant={isSelfDemotion ? "destructive" : "default"}
              onClick={() => void confirmChange()}
              disabled={saving || saveError !== null}
            >
              {saving ? "Saving…" : "Change role"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
