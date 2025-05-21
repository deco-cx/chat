import { Suspense, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "@deco/ui/components/sonner.tsx";
import {
  type Invite,
  useAcceptInvite,
  useInvites,
  useRejectInvite,
} from "@deco/sdk";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@deco/ui/components/table.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@deco/ui/components/card.tsx";
import { timeAgo } from "../../utils/timeAgo.ts";

function InvitesTitle() {
  return (
    <div className="items-center justify-between flex mb-6">
      <h2 className="text-2xl">Team Invitations</h2>
    </div>
  );
}

function InvitesViewLoading() {
  return (
    <div className="p-6 flex flex-col gap-6">
      <InvitesTitle />
      <div className="flex justify-center p-8">
        <Spinner />
        <span className="ml-2">Loading invitations...</span>
      </div>
    </div>
  );
}

function InvitesViewEmpty() {
  const navigate = useNavigate();

  return (
    <div className="p-6 flex flex-col gap-6">
      <InvitesTitle />
      <Card className="w-sm md:w-xl p-6">
        <CardHeader>
          <CardTitle>No Invitations</CardTitle>
          <CardDescription>
            You don't have any pending team invitations.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-end">
          <Button onClick={() => navigate("/")} className="mt-2">
            <Icon name="home" className="mr-2" />
            Return to Home
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function InviteItem(
  { invite, onAccept, onReject }: {
    invite: Invite;
    onAccept: (id: string) => void;
    onReject: (id: string) => void;
  },
) {
  const [isAcceptLoading, setIsAcceptLoading] = useState(false);
  const [isRejectLoading, setIsRejectLoading] = useState(false);

  const handleAccept = async () => {
    setIsAcceptLoading(true);
    try {
      await onAccept(invite.id);
    } finally {
      setIsAcceptLoading(false);
    }
  };

  const handleReject = async () => {
    setIsRejectLoading(true);
    try {
      await onReject(invite.id);
    } finally {
      setIsRejectLoading(false);
    }
  };

  return (
    <TableRow>
      <TableCell className="font-medium">{invite.teamName}</TableCell>
      <TableCell>
        {invite.inviter.name || invite.inviter.email || "Unknown"}
      </TableCell>
      <TableCell>
        {invite.roles.map((role) =>
          role.name.charAt(0).toUpperCase() + role.name.slice(1)
        ).join(", ")}
      </TableCell>
      <TableCell>{timeAgo(invite.createdAt)}</TableCell>
      <TableCell className="text-center space-x-2">
        <Button
          onClick={handleAccept}
          disabled={isAcceptLoading || isRejectLoading}
          size="sm"
        >
          {isAcceptLoading
            ? <Spinner size="xs" />
            : <Icon name="check" className="mr-2" />}
          Accept
        </Button>
        <Button
          onClick={handleReject}
          disabled={isRejectLoading || isAcceptLoading}
          variant="outline"
          size="sm"
        >
          {isRejectLoading
            ? <Spinner size="xs" />
            : <Icon name="close" className="mr-2" />}
          Reject
        </Button>
      </TableCell>
    </TableRow>
  );
}

function InvitesViewContent() {
  const { data: invites = [] } = useInvites();
  const acceptInviteMutation = useAcceptInvite();
  const rejectInviteMutation = useRejectInvite();
  const navigate = useNavigate();

  if (!invites.length) {
    return <InvitesViewEmpty />;
  }

  const handleAccept = async (inviteId: string) => {
    try {
      // Accept the invitation
      const result = await acceptInviteMutation.mutateAsync(inviteId);

      if (!result.teamId) {
        toast.error("Failed to get team information");
        navigate("/");
        return;
      }

      const teamSlug = result.teamSlug;

      if (teamSlug) {
        navigate(`/${teamSlug}/agents`);
      } else {
        navigate("/");
      }
    } catch (error) {
      console.error("Accept invitation error:", error);
      toast.error("Failed to accept invitation");
    }
  };

  const handleReject = async (inviteId: string) => {
    try {
      // Reject the invitation
      await rejectInviteMutation.mutateAsync(inviteId);
      toast.success("Invitation rejected");
    } catch (error) {
      console.error("Reject invitation error:", error);
      toast.error("Failed to reject invitation");
    }
  };

  return (
    <div className="p-6 flex flex-col gap-6">
      <InvitesTitle />

      <Card>
        <CardContent className="p-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team</TableHead>
                <TableHead>Invited By</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Invited</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invites.map((invite) => (
                <InviteItem
                  key={invite.id}
                  invite={invite}
                  onAccept={handleAccept}
                  onReject={handleReject}
                />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default function InvitesList() {
  return (
    <div className="h-full text-slate-700 max-w-5xl mx-auto">
      <Suspense fallback={<InvitesViewLoading />}>
        <InvitesViewContent />
      </Suspense>
    </div>
  );
}
