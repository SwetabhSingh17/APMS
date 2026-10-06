import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import MainLayout from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, UserRole } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Users, Search, ArrowRightLeft, UserPlus, FolderGit2, Clock, CheckCircle2, Check, Trash2, AlertTriangle, BookOpen, Phone } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useCourseFilter } from "@/hooks/course-filter-context";
import { CreateTeamDialog } from "@/components/create-team-dialog";
import { ManageMembersDialog } from "@/components/manage-members-dialog";
import { filterBySearchQuery, createSearchDocument } from "@/lib/search-index";

export default function ManageProject() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [changeSupervisorGroupId, setChangeSupervisorGroupId] = useState<number | null>(null);
  const [manageMembersGroupId, setManageMembersGroupId] = useState<number | null>(null);
  const [deleteConfirmGroup, setDeleteConfirmGroup] = useState<any>(null);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string>("");
  const [supervisorSearchQuery, setSupervisorSearchQuery] = useState<string>("");
  const [changeTopicGroup, setChangeTopicGroup] = useState<any | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<string>("");
  const [topicSearchQuery, setTopicSearchQuery] = useState<string>("");
  const [updateSupervisorWithTopic, setUpdateSupervisorWithTopic] = useState<boolean>(true);
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

  // Fetch all approved topics
  const { data: approvedTopicsData } = useQuery<{ data: any[] } | any[]>({
    queryKey: [`/api/topics/approved?limit=all${getCourseQuery() ? `&${getCourseQuery()}` : ''}`],
    queryFn: async () => {
      const res = await fetch(`/api/topics/approved?limit=all${getCourseQuery() ? `&${getCourseQuery()}` : ''}`);
      if (!res.ok) throw new Error("Failed to fetch approved topics");
      return res.json();
    },
    enabled: !!user,
  });
  const approvedTopics: any[] = Array.isArray(approvedTopicsData)
    ? approvedTopicsData
    : (approvedTopicsData?.data || []);

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

  // Change topic mutation
  const changeTopicMutation = useMutation({
    mutationFn: async ({ groupId, topicId, updateSupervisor }: { groupId: number; topicId: number; updateSupervisor: boolean }) => {
      const res = await apiRequest("PATCH", `/api/student-groups/${groupId}/topic`, { topicId, updateSupervisor });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Topic Updated",
        description: data.message || "The project topic has been changed successfully.",
      });
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && (
            key.startsWith("/api/student-groups") ||
            key.startsWith("/api/projects") ||
            key.startsWith("/api/topics") ||
            key.startsWith("/api/stats") ||
            key.startsWith("/api/admin/supervisors-summary")
          );
        },
      });
      setChangeTopicGroup(null);
      setSelectedTopicId("");
      setTopicSearchQuery("");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update project topic",
        description: error.message,
        variant: "destructive",
      });
    },
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
            key.startsWith("/api/projects") ||
            key.startsWith("/api/topics") ||
            key.startsWith("/api/stats") ||
            key.startsWith("/api/admin/supervisors-summary")
          );
        },
      });
      setChangeSupervisorGroupId(null);
      setSelectedSupervisorId("");
      setSupervisorSearchQuery("");
    },
    onError: (error) => {
      toast({
        title: "Failed to change supervisor",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete team mutation
  const deleteTeamMutation = useMutation({
    mutationFn: async (groupId: number) => {
      const res = await apiRequest("DELETE", `/api/student-groups/${groupId}`);
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Team Removed",
        description: data.message || "The team has been removed. Member student accounts remain active.",
      });
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && (
            key.startsWith("/api/student-groups") ||
            key.startsWith("/api/projects") ||
            key.startsWith("/api/students")
          );
        },
      });
      setDeleteConfirmGroup(null);
    },
    onError: (error) => {
      toast({
        title: "Failed to remove team",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Filter groups by multi-word search
  const filteredGroups = filterBySearchQuery(allGroups, searchQuery, (group: any) =>
    createSearchDocument(
      group.name,
      group.description,
      group.projectTeamId,
      group.project?.topicTitle,
      group.project?.topicCode,
      group.supervisor?.prefix,
      group.supervisor?.firstName,
      group.supervisor?.lastName,
      group.members?.map((m: any) => [m.firstName, m.lastName, m.enrollmentNumber, m.email])
    )
  );

  // Split into Pending (no project selected) and Assigned (project selected)
  const pendingGroups = filteredGroups.filter((group: any) => !group.project);
  const assignedGroups = filteredGroups.filter((group: any) => !!group.project);

  // Filter supervisors in the change supervisor dialog
  const filteredSupervisors = filterBySearchQuery(supervisors || [], supervisorSearchQuery, (s: User) =>
    createSearchDocument(
      s.prefix,
      s.firstName,
      s.lastName,
      s.department,
      s.designation,
      s.email,
      (s as any).empId
    )
  );

  const targetGroup = allGroups.find((g: any) => g.id === changeSupervisorGroupId);

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
            {(user?.role === UserRole.ADMIN || user?.role === UserRole.COORDINATOR) && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 px-2"
                onClick={() => setDeleteConfirmGroup(group)}
                title="Remove Team"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
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
              <p className="text-xs text-muted-foreground font-medium">Tentative Supervisor</p>
              <p className="font-medium">
                {group.supervisor ? `${group.supervisor.prefix ? `${group.supervisor.prefix} ` : ""}${group.supervisor.firstName} ${group.supervisor.lastName}` : "Not Assigned"}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => {
              setChangeSupervisorGroupId(group.id);
              setSelectedSupervisorId(group.supervisor?.id?.toString() || "");
              setSupervisorSearchQuery("");
            }}
          >
            <ArrowRightLeft className="h-4 w-4" />
            Change Supervisor
          </Button>
        </div>

        {/* Selected Project Info */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-medium text-muted-foreground">Selected Project</p>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={() => {
                setChangeTopicGroup(group);
                setSelectedTopicId(group.project?.topicId?.toString() || "");
                setTopicSearchQuery("");
                setUpdateSupervisorWithTopic(true);
              }}
            >
              <BookOpen className="h-3.5 w-3.5" />
              {group.project ? "Change Topic" : "Assign Topic"}
            </Button>
          </div>
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
            <div className="flex items-center justify-between p-2.5 rounded-lg border border-dashed text-xs text-muted-foreground bg-muted/20">
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
              <div key={member.id} className="flex items-center gap-2.5 p-2 rounded-md bg-muted/50 text-sm">
                <div className="w-8 h-8 rounded-full bg-background border flex items-center justify-center text-xs font-semibold shrink-0">
                  {member.firstName[0]}{member.lastName[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate text-xs sm:text-sm">{member.firstName} {member.lastName}</p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                    <span className="font-mono text-[11px]">{member.enrollmentNumber}</span>
                    {member.mobile && (
                      <span className="font-mono flex items-center gap-1 text-[11px] text-foreground/80 font-medium">
                        <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
                        {member.mobile}
                      </span>
                    )}
                  </div>
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

        {/* Change Supervisor Dialog with Name Search */}
        <Dialog
          open={changeSupervisorGroupId !== null}
          onOpenChange={(open) => {
            if (!open) {
              setChangeSupervisorGroupId(null);
              setSelectedSupervisorId("");
              setSupervisorSearchQuery("");
            }
          }}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Change Supervisor for "{targetGroup?.name}"</DialogTitle>
              <DialogDescription>
                Search and select a new supervisor to assign to this project team. Both the new and previous supervisor will be notified.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Currently Assigned Card */}
              {targetGroup?.supervisor && (
                <div className="flex items-center justify-between px-3 py-2 rounded-md bg-muted/40 border text-xs">
                  <span className="text-muted-foreground">Currently Assigned:</span>
                  <span className="font-semibold text-foreground">
                    {targetGroup.supervisor.prefix ? `${targetGroup.supervisor.prefix} ` : ""}
                    {targetGroup.supervisor.firstName} {targetGroup.supervisor.lastName}
                    {targetGroup.supervisor.department ? ` (${targetGroup.supervisor.department})` : ""}
                  </span>
                </div>
              )}

              {/* Search Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Search Supervisor Name
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search by supervisor name, prefix, department..."
                    className="pl-9 pr-8"
                    value={supervisorSearchQuery}
                    onChange={(e) => setSupervisorSearchQuery(e.target.value)}
                    autoFocus
                  />
                  {supervisorSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setSupervisorSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground p-1"
                      aria-label="Clear search"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Filtered Supervisor List */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                  <span>Available Faculty</span>
                  <span>{filteredSupervisors.length} found</span>
                </div>
                <div className="max-h-60 overflow-y-auto space-y-1 border rounded-lg p-1.5 bg-muted/20">
                  {filteredSupervisors.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">
                      <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm font-medium">No supervisors found</p>
                      <p className="text-xs mt-0.5">No supervisor matches "{supervisorSearchQuery}".</p>
                    </div>
                  ) : (
                    filteredSupervisors.map((s: User) => {
                      const isSelected = selectedSupervisorId === s.id.toString();
                      const isCurrent = targetGroup?.supervisor?.id === s.id;
                      return (
                        <div
                          key={s.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedSupervisorId(s.id.toString())}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSelectedSupervisorId(s.id.toString());
                            }
                          }}
                          className={`flex items-center justify-between p-2.5 rounded-md cursor-pointer transition-all ${
                            isSelected
                              ? "bg-primary/15 border border-primary/40 text-primary shadow-xs"
                              : "hover:bg-muted/80 text-foreground border border-transparent"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                              isSelected
                                ? "bg-primary text-primary-foreground"
                                : "bg-primary/10 text-primary"
                            }`}>
                              {s.firstName?.[0]}{s.lastName?.[0]}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold truncate leading-tight flex items-center gap-1.5">
                                <span>{s.prefix ? `${s.prefix} ` : ""}{s.firstName} {s.lastName}</span>
                                {isCurrent && (
                                  <Badge variant="outline" className="text-[10px] py-0 h-4 font-normal text-muted-foreground">
                                    Current
                                  </Badge>
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {s.department || s.designation || s.email}
                              </p>
                            </div>
                          </div>
                          {isSelected && (
                            <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 ml-2">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setChangeSupervisorGroupId(null);
                    setSelectedSupervisorId("");
                    setSupervisorSearchQuery("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (selectedSupervisorId && targetGroup) {
                      changeSupervisorMutation.mutate({
                        groupId: targetGroup.id,
                        supervisorId: parseInt(selectedSupervisorId),
                      });
                    }
                  }}
                  disabled={!selectedSupervisorId || changeSupervisorMutation.isPending || (targetGroup?.supervisor?.id?.toString() === selectedSupervisorId)}
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

        {/* Change Project Topic Dialog */}
        <Dialog
          open={changeTopicGroup !== null}
          onOpenChange={(open) => {
            if (!open) {
              setChangeTopicGroup(null);
              setSelectedTopicId("");
              setTopicSearchQuery("");
            }
          }}
        >
          <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                {changeTopicGroup?.project ? "Change Project Topic" : "Assign Project Topic"}
              </DialogTitle>
              <DialogDescription>
                Select an approved project topic for <strong>{changeTopicGroup?.name}</strong>.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2 flex-1 overflow-hidden flex flex-col">
              {/* Current Status Info */}
              <div className="bg-muted/40 rounded-lg p-3 border text-xs space-y-1.5 shrink-0">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Team Course:</span>
                  <Badge variant="outline" className="font-semibold">
                    {changeTopicGroup?.course || changeTopicGroup?.members?.[0]?.course || "N/A"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Current Topic:</span>
                  <span className="font-medium text-foreground text-right truncate max-w-[320px]">
                    {changeTopicGroup?.project?.topicTitle ? (
                      <>
                        <span className="font-mono text-primary font-semibold mr-1.5">
                          {changeTopicGroup.project.topicCode || `PRJ-${changeTopicGroup.project.id}`}
                        </span>
                        {changeTopicGroup.project.topicTitle}
                      </>
                    ) : (
                      <span className="italic text-muted-foreground">None assigned</span>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Tentative Supervisor:</span>
                  <span className="font-medium text-foreground">
                    {changeTopicGroup?.supervisor
                      ? `${changeTopicGroup.supervisor.prefix ? `${changeTopicGroup.supervisor.prefix} ` : ""}${changeTopicGroup.supervisor.firstName} ${changeTopicGroup.supervisor.lastName}`
                      : <span className="italic text-muted-foreground">Unassigned</span>}
                  </span>
                </div>
              </div>

              {/* Topic Search Input */}
              <div className="relative shrink-0">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search topics by code, title, domain, tech, or proposer..."
                  className="pl-9 h-9 text-sm"
                  value={topicSearchQuery}
                  onChange={(e) => setTopicSearchQuery(e.target.value)}
                />
              </div>

              {/* Scrollable Topics List */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[220px] max-h-[340px]">
                {(() => {
                  const groupCourse = (changeTopicGroup?.course || changeTopicGroup?.members?.[0]?.course || "").trim().toUpperCase();
                  
                  const filteredTopics = filterBySearchQuery(
                    approvedTopics.filter((t: any) => {
                      if (groupCourse && t.course) {
                        if (t.course.trim().toUpperCase() !== groupCourse) return false;
                      }
                      return true;
                    }),
                    topicSearchQuery,
                    (t: any) =>
                      createSearchDocument(
                        t.title,
                        t.code,
                        t.topicCode,
                        t.domain,
                        t.technology,
                        t.submittedBy?.prefix,
                        t.submittedBy?.firstName,
                        t.submittedBy?.lastName
                      )
                  );

                  if (filteredTopics.length === 0) {
                    return (
                      <div className="text-center py-8 text-sm text-muted-foreground">
                        {topicSearchQuery ? "No approved topics match your search." : "No approved topics available for this course."}
                      </div>
                    );
                  }

                  return filteredTopics.map((topic: any) => {
                    const isSelected = selectedTopicId === topic.id.toString();
                    const isCurrentTopic = changeTopicGroup?.project?.topicId === topic.id;
                    const isTakenByOther = topic.isAllotted && !isCurrentTopic;

                    return (
                      <div
                        key={topic.id}
                        onClick={() => {
                          if (!isTakenByOther) {
                            setSelectedTopicId(topic.id.toString());
                          }
                        }}
                        className={`p-3 rounded-lg border transition-all text-left flex items-start justify-between gap-3 ${
                          isTakenByOther
                            ? "opacity-50 cursor-not-allowed bg-muted/20 border-dashed"
                            : isSelected
                            ? "bg-primary/10 border-primary shadow-xs cursor-pointer"
                            : "hover:bg-muted/70 hover:border-muted-foreground/30 cursor-pointer"
                        }`}
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                              {topic.code || `PRJ-${topic.id}`}
                            </span>
                            {isCurrentTopic && (
                              <Badge variant="outline" className="text-[10px] py-0 h-4 border-amber-500 text-amber-600 dark:text-amber-400">
                                Current Topic
                              </Badge>
                            )}
                            {isTakenByOther && (
                              <Badge variant="secondary" className="text-[10px] py-0 h-4 text-muted-foreground">
                                Allotted to another team
                              </Badge>
                            )}
                            {topic.course && (
                              <Badge variant="outline" className="text-[10px] py-0 h-4">
                                {topic.course}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm font-semibold text-foreground line-clamp-1 leading-snug">
                            {topic.title}
                          </p>
                          {(topic.domain || topic.technology) && (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {[topic.domain, topic.technology].filter(Boolean).join(" • ")}
                            </p>
                          )}
                          {topic.submittedBy && (
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1 pt-0.5">
                              <span>Proposed by:</span>
                              <span className="font-medium text-foreground">
                                {topic.submittedBy.prefix ? `${topic.submittedBy.prefix} ` : ""}{topic.submittedBy.firstName} {topic.submittedBy.lastName}
                              </span>
                            </p>
                          )}
                        </div>

                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 mt-0.5">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Option to also update supervisor to the topic proposer */}
              {(() => {
                const selectedTopic = approvedTopics.find((t: any) => t.id.toString() === selectedTopicId);
                if (!selectedTopic?.submittedBy) return null;
                const proposerName = `${selectedTopic.submittedBy.prefix ? `${selectedTopic.submittedBy.prefix} ` : ""}${selectedTopic.submittedBy.firstName} ${selectedTopic.submittedBy.lastName}`;
                return (
                  <div className="flex items-center space-x-2 pt-2 border-t text-sm shrink-0">
                    <Checkbox
                      id="updateSupervisorWithTopic"
                      checked={updateSupervisorWithTopic}
                      onCheckedChange={(checked) => setUpdateSupervisorWithTopic(Boolean(checked))}
                    />
                    <label
                      htmlFor="updateSupervisorWithTopic"
                      className="text-xs text-muted-foreground cursor-pointer select-none"
                    >
                      Also update Tentative Supervisor to <strong className="text-foreground">{proposerName}</strong> (Topic Proposer)
                    </label>
                  </div>
                );
              })()}

              <div className="flex justify-end gap-3 pt-3 border-t shrink-0">
                <Button
                  variant="outline"
                  onClick={() => {
                    setChangeTopicGroup(null);
                    setSelectedTopicId("");
                    setTopicSearchQuery("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (selectedTopicId && changeTopicGroup) {
                      changeTopicMutation.mutate({
                        groupId: changeTopicGroup.id,
                        topicId: parseInt(selectedTopicId),
                        updateSupervisor: updateSupervisorWithTopic,
                      });
                    }
                  }}
                  disabled={
                    !selectedTopicId ||
                    changeTopicMutation.isPending ||
                    (changeTopicGroup?.project?.topicId?.toString() === selectedTopicId)
                  }
                >
                  {changeTopicMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Team Confirmation Dialog */}
        <Dialog open={!!deleteConfirmGroup} onOpenChange={(open) => !open && setDeleteConfirmGroup(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-destructive flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Remove Project Team
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to remove <strong>{deleteConfirmGroup?.name}</strong>?
              </DialogDescription>
            </DialogHeader>
            <div className="text-sm space-y-2 py-3 bg-muted/40 rounded-lg p-3 border">
              <p className="text-foreground font-medium">Important Information:</p>
              <p className="text-muted-foreground">
                • <strong>Student accounts will NOT be deleted</strong>. All {deleteConfirmGroup?.members?.length || 0} student member accounts remain completely active in the system.
              </p>
              <p className="text-muted-foreground">
                • Members will be unassigned from this team and can be reassigned to a new team.
              </p>
              {deleteConfirmGroup?.project && (
                <p className="text-amber-600 dark:text-amber-400 font-medium">
                  • The currently selected project topic ({deleteConfirmGroup.project.topicCode || deleteConfirmGroup.project.topicTitle}) will be released.
                </p>
              )}
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <Button variant="outline" onClick={() => setDeleteConfirmGroup(null)} disabled={deleteTeamMutation.isPending}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteTeamMutation.mutate(deleteConfirmGroup.id)}
                disabled={deleteTeamMutation.isPending}
              >
                {deleteTeamMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                Confirm Remove Team
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
