import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Search,
  Users,
  UserPlus,
  UserMinus,
  Edit,
  Trash2,
  ArrowRightLeft,
  FolderGit2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Check,
  X,
  Eye,
  Loader2,
  GraduationCap,
  Layers,
  UserCheck,
} from "lucide-react";
import { User, UserRole } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useCourseFilter } from "@/hooks/course-filter-context";
import { CreateTeamDialog } from "@/components/create-team-dialog";
import { ManageMembersDialog } from "@/components/manage-members-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// Interfaces prefixed with 'I' per project rules
export interface ITeamMember {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  enrollmentNumber: string;
  role: string;
  course?: string | null;
}

export interface ITeamSupervisor {
  id: number;
  prefix?: string | null;
  firstName: string;
  lastName: string;
  email?: string | null;
  role?: string;
  department?: string | null;
  designation?: string | null;
}

export interface ITeamProject {
  id: number;
  topicId: number;
  status: string;
  topicCode?: string | null;
  topicTitle?: string | null;
}

export interface ITeamData {
  id: number;
  name: string;
  description?: string | null;
  supervisorId?: number | null;
  createdById?: number | null;
  course?: string | null;
  projectTeamId?: string | null;
  maxSize: number;
  createdAt: string;
  updatedAt: string;
  members: ITeamMember[];
  supervisor: ITeamSupervisor | null;
  project: ITeamProject | null;
}

const editTeamSchema = z.object({
  name: z.string().min(3, "Team name must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  course: z.enum(["BCA", "MCA"]),
});

type EditTeamFormValues = z.infer<typeof editTeamSchema>;

export default function TeamManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  // Dialog states
  const [manageMembersGroup, setManageMembersGroup] = useState<ITeamData | null>(null);
  const [editGroup, setEditGroup] = useState<ITeamData | null>(null);
  const [viewGroup, setViewGroup] = useState<ITeamData | null>(null);
  const [deleteConfirmGroup, setDeleteConfirmGroup] = useState<ITeamData | null>(null);
  const [removeMemberConfirm, setRemoveMemberConfirm] = useState<{ group: ITeamData; member: ITeamMember } | null>(null);
  const [changeSupervisorGroup, setChangeSupervisorGroup] = useState<ITeamData | null>(null);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string>("none");
  const [supervisorSearchQuery, setSupervisorSearchQuery] = useState<string>("");

  const { courseFilter, getCourseQuery } = useCourseFilter();

  // Fetch all supervisors
  const { data: supervisors = [] } = useQuery<User[]>({
    queryKey: ["/api/supervisors"],
    queryFn: async () => {
      const res = await fetch("/api/supervisors");
      if (!res.ok) throw new Error("Failed to fetch supervisors");
      return res.json();
    },
    enabled: !!user && (user.role === UserRole.ADMIN || user.role === UserRole.COORDINATOR),
  });

  // Fetch all student groups with course query
  const queryParam = getCourseQuery() ? `?${getCourseQuery()}` : "";
  const { data: allGroups = [], isLoading } = useQuery<ITeamData[]>({
    queryKey: [`/api/student-groups/all${queryParam}`],
    queryFn: async () => {
      const res = await fetch(`/api/student-groups${queryParam}`);
      if (!res.ok) throw new Error("Failed to fetch student groups");
      return res.json();
    },
    enabled: !!user && (user.role === UserRole.ADMIN || user.role === UserRole.COORDINATOR),
  });

  // Edit Team Form
  const editForm = useForm<EditTeamFormValues>({
    resolver: zodResolver(editTeamSchema),
    defaultValues: {
      name: "",
      description: "",
      course: "BCA",
    },
  });

  // Edit Team Mutation
  const updateTeamMutation = useMutation({
    mutationFn: async ({ groupId, data }: { groupId: number; data: EditTeamFormValues }) => {
      const res = await apiRequest("PATCH", `/api/student-groups/${groupId}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Team Updated",
        description: "Team details have been updated successfully.",
      });
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.startsWith("/api/student-groups");
        },
      });
      setEditGroup(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update team",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete Team Mutation (Preserves student user accounts intact!)
  const deleteTeamMutation = useMutation({
    mutationFn: async (groupId: number) => {
      const res = await apiRequest("DELETE", `/api/student-groups/${groupId}`);
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Team Removed Successfully",
        description: data.message || "Team has been removed. Member accounts remain intact and ready for new teams.",
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
    onError: (error: Error) => {
      toast({
        title: "Failed to remove team",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Remove Single Member Mutation
  const removeMemberMutation = useMutation({
    mutationFn: async ({ groupId, userId }: { groupId: number; userId: number }) => {
      const res = await apiRequest("DELETE", `/api/student-groups/${groupId}/members/${userId}`);
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Member Removed",
        description: data.message || "Student member has been removed from the team.",
      });
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && (
            key.startsWith("/api/student-groups") ||
            key.startsWith("/api/students")
          );
        },
      });
      setRemoveMemberConfirm(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to remove member",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Change Supervisor Mutation
  const changeSupervisorMutation = useMutation({
    mutationFn: async ({ groupId, supervisorId }: { groupId: number; supervisorId: number | null }) => {
      const res = await apiRequest("PATCH", `/api/student-groups/${groupId}/supervisor`, { supervisorId });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Supervisor Updated",
        description: "The supervisor allotment has been updated successfully.",
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
      setChangeSupervisorGroup(null);
      setSelectedSupervisorId("none");
      setSupervisorSearchQuery("");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update supervisor",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEditOpen = (group: ITeamData) => {
    setEditGroup(group);
    editForm.reset({
      name: group.name,
      description: group.description || "",
      course: (group.course === "MCA" ? "MCA" : "BCA") as "BCA" | "MCA",
    });
  };

  const handleSupervisorOpen = (group: ITeamData) => {
    setChangeSupervisorGroup(group);
    setSelectedSupervisorId(group.supervisor?.id ? group.supervisor.id.toString() : "none");
    setSupervisorSearchQuery("");
  };

  // Filter groups
  const filteredGroups = allGroups.filter((group: ITeamData) => {
    // 1. Text Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        group.name?.toLowerCase().includes(q) ||
        (group.description && group.description.toLowerCase().includes(q)) ||
        (group.projectTeamId && group.projectTeamId.toLowerCase().includes(q)) ||
        (group.project?.topicTitle && group.project.topicTitle.toLowerCase().includes(q)) ||
        (group.project?.topicCode && group.project.topicCode.toLowerCase().includes(q)) ||
        (group.supervisor && `${group.supervisor.firstName} ${group.supervisor.lastName}`.toLowerCase().includes(q)) ||
        group.members?.some((m) =>
          m.firstName?.toLowerCase().includes(q) ||
          m.lastName?.toLowerCase().includes(q) ||
          m.enrollmentNumber?.toLowerCase().includes(q) ||
          m.email?.toLowerCase().includes(q)
        );
      if (!matchesSearch) return false;
    }

    // 2. Tab filtering
    if (activeTab === "pending") return !group.project;
    if (activeTab === "assigned") return !!group.project;
    if (activeTab === "bca") return group.course === "BCA";
    if (activeTab === "mca") return group.course === "MCA";

    return true;
  });

  // Calculate stats
  const totalTeams = allGroups.length;
  const bcaTeams = allGroups.filter((g) => g.course === "BCA").length;
  const mcaTeams = allGroups.filter((g) => g.course === "MCA").length;
  const assignedTeams = allGroups.filter((g) => !!g.project).length;
  const pendingTeams = allGroups.filter((g) => !g.project).length;
  const totalStudentsInTeams = allGroups.reduce((acc, g) => acc + (g.members?.length || 0), 0);

  // Filter supervisors for change supervisor dialog
  const filteredSupervisors = supervisors.filter((s: User) => {
    if (!supervisorSearchQuery.trim()) return true;
    const q = supervisorSearchQuery.toLowerCase().trim();
    const fullName = `${s.prefix ? `${s.prefix} ` : ""}${s.firstName} ${s.lastName}`.toLowerCase();
    return (
      fullName.includes(q) ||
      (s.department && s.department.toLowerCase().includes(q)) ||
      (s.email && s.email.toLowerCase().includes(q))
    );
  });

  if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.COORDINATOR)) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-destructive">Access Restricted</CardTitle>
              <CardDescription>
                You need Administrator or Coordinator permissions to access Team Management.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto py-6 space-y-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Users className="h-8 w-8 text-primary" />
              Team Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Search, inspect, update members, reassign supervisors, or dissolve project teams.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <CreateTeamDialog />
          </div>
        </div>

        {/* Metric Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card className="border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Total Teams</p>
                <p className="text-xl font-bold">{totalTeams}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">BCA Teams</p>
                <p className="text-xl font-bold">{bcaTeams}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">MCA Teams</p>
                <p className="text-xl font-bold">{mcaTeams}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Topic Assigned</p>
                <p className="text-xl font-bold">{assignedTeams}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Pending Topic</p>
                <p className="text-xl font-bold">{pendingTeams}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Total Students</p>
                <p className="text-xl font-bold">{totalStudentsInTeams}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filter Row */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1 max-w-lg">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search team name, project team ID, member, enrollment, supervisor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
            <TabsList>
              <TabsTrigger value="all">All ({allGroups.length})</TabsTrigger>
              <TabsTrigger value="pending">Pending Topic ({pendingTeams})</TabsTrigger>
              <TabsTrigger value="assigned">Assigned ({assignedTeams})</TabsTrigger>
              <TabsTrigger value="bca">BCA ({bcaTeams})</TabsTrigger>
              <TabsTrigger value="mca">MCA ({mcaTeams})</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Teams Table */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Project Teams Roster</CardTitle>
                <CardDescription>
                  Showing {filteredGroups.length} of {allGroups.length} teams
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className="text-center py-12 px-4">
                <Users className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-lg font-medium text-foreground">No Teams Found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {searchQuery ? "No teams matched your search criteria." : "No teams have been created yet."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[240px]">Team Details</TableHead>
                      <TableHead className="w-[300px]">Members</TableHead>
                      <TableHead className="w-[200px]">Supervisor</TableHead>
                      <TableHead className="w-[240px]">Project Topic</TableHead>
                      <TableHead className="text-right w-[160px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredGroups.map((group: ITeamData) => (
                      <TableRow key={group.id} className="hover:bg-muted/40">
                        {/* Team Details */}
                        <TableCell className="align-top">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-foreground">{group.name}</span>
                              {group.projectTeamId && (
                                <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0 h-4 border-primary/30 text-primary">
                                  {group.projectTeamId}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Badge variant="secondary" className="text-[10px] py-0 h-4">
                                {group.course || "BCA"}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                Cap: {group.maxSize}
                              </span>
                            </div>
                            {group.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                                {group.description}
                              </p>
                            )}
                          </div>
                        </TableCell>

                        {/* Members with Quick Remove */}
                        <TableCell className="align-top">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-muted-foreground">
                                {group.members?.length || 0} / {group.maxSize} Members
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs text-primary px-1.5 gap-1 hover:bg-primary/10"
                                onClick={() => setManageMembersGroup(group)}
                              >
                                <UserPlus className="h-3 w-3" />
                                Edit Roster
                              </Button>
                            </div>
                            <div className="space-y-1">
                              {group.members?.map((member: ITeamMember) => (
                                <div
                                  key={member.id}
                                  className="flex items-center justify-between p-1.5 rounded-md bg-muted/60 text-xs group/member"
                                >
                                  <div className="min-w-0 pr-1 flex items-center gap-1.5">
                                    <div className="w-5 h-5 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[10px] font-semibold shrink-0">
                                      {member.firstName[0]}{member.lastName[0]}
                                    </div>
                                    <span className="font-medium truncate">
                                      {member.firstName} {member.lastName}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground font-mono">
                                      ({member.enrollmentNumber})
                                    </span>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 opacity-70 group-hover/member:opacity-100"
                                    title={`Remove ${member.firstName} ${member.lastName}`}
                                    onClick={() => setRemoveMemberConfirm({ group, member })}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                              {(!group.members || group.members.length === 0) && (
                                <p className="text-xs text-muted-foreground italic py-1">
                                  No members assigned.
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        {/* Supervisor */}
                        <TableCell className="align-top">
                          <div className="space-y-2">
                            {group.supervisor ? (
                              <div className="space-y-1">
                                <p className="font-medium text-sm text-foreground">
                                  {group.supervisor.prefix ? `${group.supervisor.prefix} ` : ""}
                                  {group.supervisor.firstName} {group.supervisor.lastName}
                                </p>
                                {group.supervisor.department && (
                                  <p className="text-xs text-muted-foreground">
                                    {group.supervisor.department}
                                  </p>
                                )}
                                {group.supervisor.designation && (
                                  <Badge variant="outline" className="text-[10px] py-0 h-4">
                                    {group.supervisor.designation}
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <Badge variant="outline" className="border-amber-500/30 text-amber-600 bg-amber-500/10 text-xs">
                                  Not Assigned
                                </Badge>
                                <p className="text-[11px] text-muted-foreground">
                                  Allotted after topic selection
                                </p>
                              </div>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1.5 w-full"
                              onClick={() => handleSupervisorOpen(group)}
                            >
                              <ArrowRightLeft className="h-3 w-3" />
                              {group.supervisor ? "Change" : "Assign"}
                            </Button>
                          </div>
                        </TableCell>

                        {/* Project Topic */}
                        <TableCell className="align-top">
                          {group.project ? (
                            <div className="p-2 rounded-lg border bg-blue-50/50 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-900/40 space-y-1">
                              <div className="flex items-center gap-1.5">
                                <FolderGit2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                                <span className="font-mono text-xs font-semibold text-blue-700 dark:text-blue-300">
                                  {group.project.topicCode || `PRJ-${group.project.id}`}
                                </span>
                                <Badge variant="outline" className="text-[10px] py-0 h-4 capitalize ml-auto">
                                  {group.project.status || "in_progress"}
                                </Badge>
                              </div>
                              <p className="text-xs text-foreground font-medium line-clamp-2" title={group.project.topicTitle || ""}>
                                {group.project.topicTitle || "Project Topic Assigned"}
                              </p>
                            </div>
                          ) : (
                            <div className="p-2.5 rounded-lg border border-dashed bg-muted/20 text-xs text-muted-foreground">
                              <span className="italic">No topic selected yet</span>
                            </div>
                          )}
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="align-top text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              title="View Details"
                              onClick={() => setViewGroup(group)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              title="Edit Team Details"
                              onClick={() => handleEditOpen(group)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                              title="Remove Team"
                              onClick={() => setDeleteConfirmGroup(group)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Manage Members Dialog */}
        {manageMembersGroup && (
          <ManageMembersDialog
            group={manageMembersGroup}
            open={!!manageMembersGroup}
            onOpenChange={(open) => !open && setManageMembersGroup(null)}
          />
        )}

        {/* Edit Team Details Dialog */}
        <Dialog open={!!editGroup} onOpenChange={(open) => !open && setEditGroup(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Team Details</DialogTitle>
              <DialogDescription>
                Update team name, description, and academic cohort course.
              </DialogDescription>
            </DialogHeader>

            <Form {...editForm}>
              <form
                onSubmit={editForm.handleSubmit((data) => {
                  if (editGroup) {
                    updateTeamMutation.mutate({ groupId: editGroup.id, data });
                  }
                })}
                className="space-y-4 py-2"
              >
                <FormField
                  control={editForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Team Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter team name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Describe the team focus..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="course"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Course Cohort</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select course" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="BCA">BCA (Max 5 members)</SelectItem>
                          <SelectItem value="MCA">MCA (Max 2 members)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter className="pt-4">
                  <Button variant="outline" type="button" onClick={() => setEditGroup(null)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateTeamMutation.isPending}>
                    {updateTeamMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Save Changes
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* View Team Details Dialog */}
        <Dialog open={!!viewGroup} onOpenChange={(open) => !open && setViewGroup(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-xl">{viewGroup?.name}</DialogTitle>
                {viewGroup?.projectTeamId && (
                  <Badge variant="outline" className="font-mono text-primary border-primary/30">
                    {viewGroup.projectTeamId}
                  </Badge>
                )}
                <Badge variant="secondary">{viewGroup?.course || "BCA"}</Badge>
              </div>
              <DialogDescription>{viewGroup?.description || "No description provided."}</DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Supervisor Info */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Assigned Supervisor
                </h4>
                {viewGroup?.supervisor ? (
                  <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                      {viewGroup.supervisor.firstName[0]}{viewGroup.supervisor.lastName[0]}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        {viewGroup.supervisor.prefix ? `${viewGroup.supervisor.prefix} ` : ""}
                        {viewGroup.supervisor.firstName} {viewGroup.supervisor.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {viewGroup.supervisor.department || viewGroup.supervisor.designation || "Faculty Member"} • {viewGroup.supervisor.email}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg border border-dashed text-xs text-muted-foreground">
                    No supervisor assigned yet. A supervisor is assigned automatically upon project topic selection.
                  </div>
                )}
              </div>

              {/* Members Roster */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Team Members ({viewGroup?.members?.length || 0} / {viewGroup?.maxSize || 5})
                  </h4>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => {
                      const g = viewGroup;
                      setViewGroup(null);
                      setManageMembersGroup(g);
                    }}
                  >
                    <UserPlus className="h-3 w-3" /> Manage Members
                  </Button>
                </div>

                <div className="grid sm:grid-cols-2 gap-2">
                  {viewGroup?.members?.map((m: ITeamMember) => (
                    <div key={m.id} className="p-3 rounded-lg border bg-card flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                          {m.firstName[0]}{m.lastName[0]}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{m.firstName} {m.lastName}</p>
                          <p className="text-xs text-muted-foreground font-mono">{m.enrollmentNumber}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{m.email}</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                        title="Remove member"
                        onClick={() => {
                          if (viewGroup) {
                            setRemoveMemberConfirm({ group: viewGroup, member: m });
                          }
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Project Topic */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Project Topic
                </h4>
                {viewGroup?.project ? (
                  <div className="p-3 rounded-lg border bg-blue-50/50 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-900/40">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-bold text-blue-700 dark:text-blue-300">
                        {viewGroup.project.topicCode || `PRJ-${viewGroup.project.id}`}
                      </span>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {viewGroup.project.status}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      {viewGroup.project.topicTitle || "Project Assigned"}
                    </p>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg border border-dashed text-xs text-muted-foreground">
                    No topic selected by this team yet.
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setViewGroup(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Change Supervisor Dialog */}
        <Dialog open={!!changeSupervisorGroup} onOpenChange={(open) => !open && setChangeSupervisorGroup(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Assign / Change Supervisor</DialogTitle>
              <DialogDescription>
                Assign or reassign faculty supervisor for <strong>{changeSupervisorGroup?.name}</strong>.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Filter supervisor by name or department..."
                  value={supervisorSearchQuery}
                  onChange={(e) => setSupervisorSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div className="max-h-60 overflow-y-auto space-y-1.5 border rounded-lg p-2">
                {/* Option to unassign supervisor */}
                <div
                  className={`p-2.5 rounded-md cursor-pointer flex items-center justify-between text-sm transition-colors ${
                    selectedSupervisorId === "none"
                      ? "bg-primary/10 border border-primary text-primary font-medium"
                      : "hover:bg-muted"
                  }`}
                  onClick={() => setSelectedSupervisorId("none")}
                >
                  <div>
                    <p className="font-medium">None / Unassigned</p>
                    <p className="text-xs text-muted-foreground">Supervisor will be allotted when team picks a topic</p>
                  </div>
                  {selectedSupervisorId === "none" && <Check className="h-4 w-4" />}
                </div>

                {filteredSupervisors.map((s: User) => {
                  const isSelected = selectedSupervisorId === s.id.toString();
                  return (
                    <div
                      key={s.id}
                      className={`p-2.5 rounded-md cursor-pointer flex items-center justify-between text-sm transition-colors ${
                        isSelected
                          ? "bg-primary/10 border border-primary text-primary font-medium"
                          : "hover:bg-muted"
                      }`}
                      onClick={() => setSelectedSupervisorId(s.id.toString())}
                    >
                      <div>
                        <p className="font-medium">
                          {s.prefix ? `${s.prefix} ` : ""}{s.firstName} {s.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {s.department || s.designation || "Faculty"} • {s.email}
                        </p>
                      </div>
                      {isSelected && <Check className="h-4 w-4" />}
                    </div>
                  );
                })}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setChangeSupervisorGroup(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (changeSupervisorGroup) {
                    const sid = selectedSupervisorId === "none" ? null : parseInt(selectedSupervisorId);
                    changeSupervisorMutation.mutate({
                      groupId: changeSupervisorGroup.id,
                      supervisorId: sid,
                    });
                  }
                }}
                disabled={changeSupervisorMutation.isPending}
              >
                {changeSupervisorMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Save Supervisor
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Remove Member Confirmation Dialog */}
        <Dialog open={!!removeMemberConfirm} onOpenChange={(open) => !open && setRemoveMemberConfirm(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-destructive flex items-center gap-2">
                <UserMinus className="h-5 w-5" />
                Remove Member from Team
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to remove <strong>{removeMemberConfirm?.member.firstName} {removeMemberConfirm?.member.lastName}</strong> from team <strong>{removeMemberConfirm?.group.name}</strong>?
              </DialogDescription>
            </DialogHeader>

            <div className="text-sm space-y-2 py-3 bg-muted/40 rounded-lg p-3 border">
              <p className="text-muted-foreground">
                • The student's account will <strong>NOT</strong> be deleted.
              </p>
              <p className="text-muted-foreground">
                • The student will become unassigned and can join another team or be assigned to a new one.
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setRemoveMemberConfirm(null)} disabled={removeMemberMutation.isPending}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (removeMemberConfirm) {
                    removeMemberMutation.mutate({
                      groupId: removeMemberConfirm.group.id,
                      userId: removeMemberConfirm.member.id,
                    });
                  }
                }}
                disabled={removeMemberMutation.isPending}
              >
                {removeMemberMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Confirm Remove Member
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Team Entirely Confirmation Dialog */}
        <Dialog open={!!deleteConfirmGroup} onOpenChange={(open) => !open && setDeleteConfirmGroup(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-destructive flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Remove Project Team
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to remove team <strong>{deleteConfirmGroup?.name}</strong>?
              </DialogDescription>
            </DialogHeader>

            <div className="text-sm space-y-2.5 py-3 bg-muted/40 rounded-lg p-3 border">
              <p className="text-foreground font-semibold">Data Protection Guarantee:</p>
              <p className="text-muted-foreground">
                • <strong>Student accounts will NOT be deleted</strong>. All {deleteConfirmGroup?.members?.length || 0} student user accounts will remain completely active and preserved in the portal database.
              </p>
              <p className="text-muted-foreground">
                • All members will be detached from this team, freeing them so that administrators and coordinators can create a new team with them.
              </p>
              {deleteConfirmGroup?.project && (
                <p className="text-amber-600 dark:text-amber-400 font-medium">
                  • The currently selected project topic ({deleteConfirmGroup.project.topicCode || deleteConfirmGroup.project.topicTitle}) will be released back to the available topic pool.
                </p>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setDeleteConfirmGroup(null)} disabled={deleteTeamMutation.isPending}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (deleteConfirmGroup) {
                    deleteTeamMutation.mutate(deleteConfirmGroup.id);
                  }
                }}
                disabled={deleteTeamMutation.isPending}
              >
                {deleteTeamMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                Confirm Remove Team
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
