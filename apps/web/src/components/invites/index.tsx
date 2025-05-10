import { Suspense, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "@deco/ui/components/sonner.tsx";
import { type Invite, useAcceptInvite, useInvites } from "@deco/sdk";
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
      <Card className="w-full">
        <CardHeader>
          <CardTitle>No Invitations</CardTitle>
          <CardDescription>
            You don't have any pending team invitations.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
  { invite, onAccept }: { invite: Invite; onAccept: (id: string) => void },
) {
  const [isLoading, setIsLoading] = useState(false);

  const handleAccept = async () => {
    setIsLoading(true);
    try {
      await onAccept(invite.id);
    } finally {
      setIsLoading(false);
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
      <TableCell className="text-center">
        <Button
          onClick={handleAccept}
          disabled={isLoading}
          size="sm"
        >
          {isLoading
            ? <Spinner size="xs" className="mr-2" />
            : <Icon name="check" className="mr-2" />}
          Accept Invitation
        </Button>
      </TableCell>
    </TableRow>
  );
}

function InvitesViewContent() {
  const { data: invites = [] } = useInvites();
  const acceptInviteMutation = useAcceptInvite();
  const navigate = useNavigate();

  console.log({ invites });
  if (!invites.length) {
    return <InvitesViewEmpty />;
  }

  const handleAccept = async (inviteId: string) => {
    try {
      // Accept the invitation
      const { data: result } = await acceptInviteMutation.mutateAsync(inviteId);

      if (!result.teamId) {
        toast.error("Failed to get team information");
        navigate("/");
        return;
      }

      const teamSlug = result.teamSlug;

      if (teamSlug) {
        navigate(`/${teamSlug}`);
      } else {
        navigate("/");
      }
    } catch (error) {
      console.error("Accept invitation error:", error);
      toast.error("Failed to accept invitation");
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
