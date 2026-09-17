import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import MainLayout from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, UserRole } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Users, Search, ArrowRightLeft, UserPlus, FolderGit2, Clock, CheckCircle2 } from "lucide-react";
import { useCourseFilter } from "@/hooks/course-filter-context";
import { CreateTeamDialog } from "@/components/create-team-dialog";
import { ManageMembersDialog } from "@/components/manage-members-dialog";

export default function ManageProject() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [changeSupervisorGroupId, setChangeSupervisorGroupId] = useState<number | null>(null);
  const [manageMembersGroupId, setManageMembersGroupId] = useState<number | null>(null);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string>("");
  const { courseFilter, getCourseQuery } = useCourseFilter();

  // Fetch all supervisors
  const { data: supervisors } = useQuery({
    queryKey: ["/api/supervisors"],
    queryFn: async () => {
      const res = await fetch("/api/supervisors");
      if (!res.ok) throw new Error("Failed to fetch supervisors");
      return res.json();
    },
    enabled: !!user,
  });

  // Fetch all student groups
  const { data: allGroups = [], isLoading: isLoadingAllGroups } = useQuery({
    queryKey: [`/api/student-groups/all${getCourseQuery() ? `?${getCourseQuery()}` : ''}`],
    queryFn: async () => {
      const res = await fetch(`/api/student-groups${getCourseQuery() ? `?${getCourseQuery()}` : ''}`);
      if (!res.ok) throw new Error("Failed to fetch all groups");
      return res.json();
    },
    enabled: !!user,
  });

  // Change supervisor mutation
  const changeSupervisorMutation = useMutation({
    mutationFn: async ({ groupId, supervisorId }: { groupId: number; supervisorId: number }) => {
      const res = await apiRequest("PATCH", `/api/student-groups/${groupId}/supervisor`, { supervisorId });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Supervisor Updated",
        description: "The supervisor allotment has been changed successfully.",
      });
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && (
            key.startsWith("/api/student-groups") ||
            key.startsWith("/api/projects")
          );
        },
      });
      setChangeSupervisorGroupId(null);
      setSelectedSupervisorId("");
    },
    onError: (error) => {
      toast({
        title: "Failed to change supervisor",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Filter groups by search
  const filteredGroups = allGroups.filter((group: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      group.name?.toLowerCase().includes(q) ||
      group.description?.toLowerCase().includes(q) ||
      group.projectTeamId?.toLowerCase().includes(q) ||
      group.project?.topicTitle?.toLowerCase().includes(q) ||
      group.project?.topicCode?.toLowerCase().includes(q) ||
      group.supervisor?.firstName?.toLowerCase().includes(q) ||
      group.supervisor?.lastName?.toLowerCase().includes(q) ||
      group.members?.some((m: any) =>
        m.firstName?.toLowerCase().includes(q) ||
        m.lastName?.toLowerCase().includes(q) ||
        m.enrollmentNumber?.toLowerCase().includes(q)
      )
    );
  });

  // Split into Pending (no project selected) and Assigned (project selected)
  const pendingGroups = filteredGroups.filter((group: any) => !group.project);
  const assignedGroups = filteredGroups.filter((group: any) => !!group.project);

  const renderGroupCard = (group: any) => (
    <Card key={group.id} className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{group.name}</CardTitle>
            <CardDescription className="mt-1">{group.description}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-accent/10 text-accent hover:bg-accent/20 border-accent/20">
              {group.course || 'BCA'}
            </Badge>
            <Badge variant="outline">
              {group.members?.length || 0} / {group.maxSize} Members
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Supervisor Info */}
        <div className="flex items-center justify-between p-3 rounded-lg border bg-primary/5 border-primary/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="font-semibold text-primary text-sm">
                {group.supervisor ? `${group.supervisor.firstName[0]}${group.supervisor.lastName[0]}` : "--"}
              </span>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Current Supervisor</p>
              <p className="font-medium">
                {group.supervisor ? `${group.supervisor.prefix ? `${group.supervisor.prefix} ` : ""}${group.supervisor.firstName} ${group.supervisor.lastName}` : "Not Assigned"}
              </p>
            </div>
          </div>
          <Dialog
            open={changeSupervisorGroupId === group.id}
            onOpenChange={(open) => {
              if (open) {
                setChangeSupervisorGroupId(group.id);
                setSelectedSupervisorId(group.supervisor?.id?.toString() || "");
              } else {
                setChangeSupervisorGroupId(null);
                setSelectedSupervisorId("");
              }
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowRightLeft className="h-4 w-4" />
                Change Supervisor
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Change Supervisor for "{group.name}"</DialogTitle>
                <DialogDescription>
                  Select a new supervisor to assign to this project team. Both the new and previous supervisor will be notified.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select Supervisor</label>
                  <Select
                    value={selectedSupervisorId}
                    onValueChange={setSelectedSupervisorId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a supervisor" />
                    </SelectTrigger>
                    <SelectContent>
                      {supervisors?.map((s: User) => (
                        <SelectItem key={s.id} value={s.id.toString()}>
                          {s.prefix ? `${s.prefix} ` : ""}{s.firstName} {s.lastName} — {s.department || s.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setChangeSupervisorGroupId(null);
                      setSelectedSupervisorId("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (selectedSupervisorId) {
                        changeSupervisorMutation.mutate({
                          groupId: group.id,
                          supervisorId: parseInt(selectedSupervisorId),
                        });
                      }
                    }}
                    disabled={!selectedSupervisorId || changeSupervisorMutation.isPending}
                  >
                    {changeSupervisorMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</>
                    ) : (
                      "Save Changes"
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Selected Project Info */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">Selected Project</p>
          {group.project ? (
            <div className="flex items-center gap-2.5 p-2.5 rounded-lg border bg-blue-50/50 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-900/40">
              <div className="w-8 h-8 rounded-md bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center shrink-0">
                <FolderGit2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/80 text-blue-700 dark:text-blue-300">
                    {group.project.topicCode || `PRJ-${group.project.id}`}
                  </span>
                  <Badge variant="outline" className="capitalize text-[10px] py-0 h-4">
                    {group.project.status || "in_progress"}
                  </Badge>
                </div>
                <p className="text-xs font-medium text-foreground truncate mt-0.5" title={group.project.topicTitle}>
                  {group.project.topicTitle || "Project Assigned"}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-2 rounded-lg border border-dashed text-xs text-muted-foreground bg-muted/20">
              <span className="italic">No topic selected by this team yet</span>
            </div>
          )}
        </div>

        {/* Members List */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <p className="text-sm font-medium text-muted-foreground">Team Members</p>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setManageMembersGroupId(group.id)}>
              <UserPlus className="h-4 w-4" /> Manage Members
            </Button>
          </div>
          <ManageMembersDialog 
            group={group} 
            open={manageMembersGroupId === group.id} 
            onOpenChange={(open) => setManageMembersGroupId(open ? group.id : null)} 
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {group.members?.map((member: any) => (
              <div key={member.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/50 text-sm">
                <div className="w-7 h-7 rounded-full bg-background border flex items-center justify-center text-xs font-semibold shrink-0">
                  {member.firstName[0]}{member.lastName[0]}
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">{member.firstName} {member.lastName}</p>
                  <p className="text-xs text-muted-foreground truncate">{member.enrollmentNumber}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <MainLayout>
      <div className="container mx-auto py-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Manage Project</h1>
            <p className="text-muted-foreground mt-1">Manage and reassign supervisors to student project teams</p>
          </div>
          <CreateTeamDialog />
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search by team name, supervisor, student name or enrollment..."
              className="pl-10"
              aria-label="Search projects"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {isLoadingAllGroups ? (
          <div className="flex justify-center items-center min-h-[40vh]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Loading project teams...</span>
          </div>
        ) : (
          <Tabs defaultValue="pending" className="space-y-6">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="pending" className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <span>Pending</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 font-medium">
                  {pendingGroups.length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="assigned" className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span>Assigned</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-700 dark:text-green-400 font-medium">
                  {assignedGroups.length}
                </span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="space-y-4">
              {pendingGroups.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <CheckCircle2 className="h-12 w-12 mx-auto text-green-500/60 mb-4" />
                    <p className="text-lg font-medium text-foreground">No Pending Teams</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {searchQuery ? "No pending teams match your search query." : "All registered project teams have selected a project topic."}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {pendingGroups.map((group: any) => renderGroupCard(group))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="assigned" className="space-y-4">
              {assignedGroups.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Clock className="h-12 w-12 mx-auto text-amber-500/60 mb-4" />
                    <p className="text-lg font-medium text-foreground">No Assigned Teams</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {searchQuery ? "No assigned teams match your search query." : "No teams have selected or been assigned a project topic yet."}</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {assignedGroups.map((group: any) => renderGroupCard(group))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </MainLayout>
  );
}
