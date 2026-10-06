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
import { Progress } from "@/components/ui/progress";
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
  GraduationCap,
  BookOpen,
  FolderGit2,
  CheckCircle2,
  Clock,
  Eye,
  Edit,
  ArrowRightLeft,
  UserCheck,
  UserPlus,
  Building,
  Phone,
  Mail,
  AlertTriangle,
  RotateCcw,
  Check,
  X,
  AlertCircle,
  HelpCircle,
  LayoutGrid,
  List,
} from "lucide-react";
import { UserRole } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useCourseFilter } from "@/hooks/course-filter-context";
import { filterBySearchQuery, createSearchDocument } from "@/lib/search-index";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// Interfaces prefixed with 'I' per project rules
export interface ITopicAssignedTeam {
  id: number;
  name: string;
  projectTeamId?: string | null;
  course?: string | null;
  maxSize: number;
  memberCount: number;
  members: Array<{
    id: number;
    firstName: string;
    lastName: string;
    enrollmentNumber: string;
    email: string;
    mobile?: string | null;
  }>;
  projectStatus: string;
  progress: number;
}

export interface ISubmittedTopic {
  id: number;
  topicCode?: string | null;
  title: string;
  description?: string | null;
  technology: string;
  projectType: string;
  course: string;
  estimatedComplexity: string;
  status: "pending" | "approved" | "rejected" | "pending_supervisor" | string;
  feedback?: string | null;
  createdAt: string;
  assignedTeam?: ITopicAssignedTeam | null;
}

export interface IAssignedTeam {
  id: number;
  name: string;
  projectTeamId?: string | null;
  course?: string | null;
  maxSize: number;
  memberCount: number;
  members: Array<{
    id: number;
    firstName: string;
    lastName: string;
    enrollmentNumber: string;
    email: string;
    mobile?: string | null;
  }>;
  project?: {
    id: number;
    topicId: number;
    status: string;
    topicCode?: string | null;
    topicTitle?: string;
  } | null;
}

export interface ISupervisorMetrics {
  totalTopics: number;
  approvedTopics: number;
  pendingTopics: number;
  rejectedTopics: number;
  assignedTopics: number;
  availableTopics: number;
  assignedTeams: number;
  totalStudentsSupervised: number;
  workloadStatus: "available" | "optimal" | "high" | "maximum";
}

export interface ISupervisorData {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  empId?: string | null;
  prefix?: string | null;
  designation?: string | null;
  mobile?: string | null;
  department?: string | null;
  course?: string | null;
  createdAt: string;
  submittedTopics: ISubmittedTopic[];
  assignedTeams: IAssignedTeam[];
  metrics: ISupervisorMetrics;
}

export interface ISupervisorSummaryStats {
  totalSupervisors: number;
  activeSupervisors: number;
  availableSupervisors: number;
  totalTopicsSubmitted: number;
  totalTopicsApproved: number;
  totalTopicsAssigned: number;
  totalTeamsAssigned: number;
  totalStudentsSupervised: number;
}

export interface ISupervisorSummaryResponse {
  supervisors: ISupervisorData[];
  stats: ISupervisorSummaryStats;
}

// Edit Supervisor Form Schema
const editSupervisorSchema = z.object({
  prefix: z.string().optional(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  empId: z.string().optional(),
  designation: z.string().optional(),
  department: z.string().optional(),
  email: z.string().email("Invalid email address"),
  mobile: z.string().optional(),
});

type EditSupervisorFormValues = z.infer<typeof editSupervisorSchema>;

// Edit Topic Form Schema
const editTopicSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().optional(),
  technology: z.string().min(2, "Technology stack is required"),
  projectType: z.string().min(2, "Project type is required"),
  course: z.enum(["BCA", "MCA"]),
  estimatedComplexity: z.enum(["Easy", "Medium", "Hard"]),
});

type EditTopicFormValues = z.infer<typeof editTopicSchema>;

export default function SupervisorManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { courseFilter, getCourseQuery } = useCourseFilter();

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  // Dialog states
  const [viewSupervisor, setViewSupervisor] = useState<ISupervisorData | null>(null);
  const [editSupervisor, setEditSupervisor] = useState<ISupervisorData | null>(null);
  const [manageTopicsSupervisor, setManageTopicsSupervisor] = useState<ISupervisorData | null>(null);
  const [editTopic, setEditTopic] = useState<ISubmittedTopic | null>(null);
  const [rejectFeedbackDialog, setRejectFeedbackDialog] = useState<ISubmittedTopic | null>(null);
  const [rejectFeedback, setRejectFeedback] = useState("");

  // Assign Topic to Group Dialog State
  const [assignTopicModal, setAssignTopicModal] = useState<{
    topic: ISubmittedTopic;
    supervisor: ISupervisorData;
  } | null>(null);
  const [groupSearchQuery, setGroupSearchQuery] = useState("");
  const [groupTabFilter, setGroupTabFilter] = useState<"unassigned" | "all">("unassigned");

  // Unassign Topic Confirmation State
  const [confirmUnassignGroup, setConfirmUnassignGroup] = useState<{
    groupId: number;
    groupName: string;
    topicTitle: string;
  } | null>(null);

  // Allot Team to Supervisor Dialog State (General Allotment)
  const [allotTeamSupervisor, setAllotTeamSupervisor] = useState<ISupervisorData | null>(null);
  const [allotTeamSearch, setAllotTeamSearch] = useState("");

  // Query parameter respecting global course filter
  const queryParam = getCourseQuery() ? `?${getCourseQuery()}` : "";

  // Fetch Supervisor Summary Data
  const { data: summaryResponse, isLoading } = useQuery<ISupervisorSummaryResponse>({
    queryKey: [`/api/admin/supervisors-summary${queryParam}`],
    queryFn: async () => {
      const res = await fetch(`/api/admin/supervisors-summary${queryParam}`);
      if (!res.ok) throw new Error("Failed to fetch supervisors summary");
      return res.json();
    },
    enabled: !!user && (user.role === UserRole.ADMIN || user.role === UserRole.COORDINATOR),
  });

  // Fetch all student groups for team assignment dialogs
  const { data: allStudentGroups = [] } = useQuery<any[]>({
    queryKey: [`/api/student-groups/all${queryParam}`],
    queryFn: async () => {
      const res = await fetch(`/api/student-groups${queryParam}`);
      if (!res.ok) throw new Error("Failed to fetch student groups");
      return res.json();
    },
    enabled: !!user && (user.role === UserRole.ADMIN || user.role === UserRole.COORDINATOR),
  });

  const supervisors = summaryResponse?.supervisors || [];
  const stats = summaryResponse?.stats || {
    totalSupervisors: 0,
    activeSupervisors: 0,
    availableSupervisors: 0,
    totalTopicsSubmitted: 0,
    totalTopicsApproved: 0,
    totalTopicsAssigned: 0,
    totalTeamsAssigned: 0,
    totalStudentsSupervised: 0,
  };

  // Forms
  const supervisorForm = useForm<EditSupervisorFormValues>({
    resolver: zodResolver(editSupervisorSchema),
    defaultValues: {
      prefix: "",
      firstName: "",
      lastName: "",
      empId: "",
      designation: "",
      department: "",
      email: "",
      mobile: "",
    },
  });

  const topicForm = useForm<EditTopicFormValues>({
    resolver: zodResolver(editTopicSchema),
    defaultValues: {
      title: "",
      description: "",
      technology: "",
      projectType: "",
      course: "BCA",
      estimatedComplexity: "Medium",
    },
  });

  // Invalidate helper for all relevant queries
  const invalidateAllQueries = () => {
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === "string" && (
          key.startsWith("/api/admin/supervisors-summary") ||
          key.startsWith("/api/supervisors") ||
          key.startsWith("/api/student-groups") ||
          key.startsWith("/api/projects") ||
          key.startsWith("/api/topics") ||
          key.startsWith("/api/users") ||
          key.startsWith("/api/stats")
        );
      },
    });
  };

  // Mutations
  const updateSupervisorMutation = useMutation({
    mutationFn: async ({ userId, data }: { userId: number; data: EditSupervisorFormValues }) => {
      const res = await apiRequest("PATCH", `/api/users/${userId}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Supervisor Updated",
        description: "Supervisor profile details have been updated successfully.",
      });
      invalidateAllQueries();
      setEditSupervisor(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateTopicMutation = useMutation({
    mutationFn: async ({ topicId, data }: { topicId: number; data: EditTopicFormValues }) => {
      const res = await apiRequest("PUT", `/api/topics/${topicId}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Topic Updated",
        description: "Project topic has been successfully updated.",
      });
      invalidateAllQueries();
      setEditTopic(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update topic",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const approveTopicMutation = useMutation({
    mutationFn: async (topicId: number) => {
      const res = await apiRequest("POST", `/api/topics/${topicId}/approve`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Topic Approved",
        description: "The topic has been approved and is ready for team allotment.",
      });
      invalidateAllQueries();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to approve topic",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const rejectTopicMutation = useMutation({
    mutationFn: async ({ topicId, feedback }: { topicId: number; feedback: string }) => {
      const res = await apiRequest("POST", `/api/topics/${topicId}/reject`, { feedback });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Topic Rejected",
        description: "The topic status has been set to rejected.",
      });
      invalidateAllQueries();
      setRejectFeedbackDialog(null);
      setRejectFeedback("");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to reject topic",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const markTopicPendingMutation = useMutation({
    mutationFn: async (topicId: number) => {
      const res = await apiRequest("POST", `/api/topics/${topicId}/mark-pending`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Reverted to Pending",
        description: "Topic has been returned to pending review.",
      });
      invalidateAllQueries();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update topic status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Assign Topic to Group Mutation
  const assignTopicToGroupMutation = useMutation({
    mutationFn: async ({
      groupId,
      topicId,
      updateSupervisor = true,
    }: {
      groupId: number;
      topicId: number;
      updateSupervisor?: boolean;
    }) => {
      const res = await apiRequest("PATCH", `/api/student-groups/${groupId}/topic`, {
        topicId,
        updateSupervisor,
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Team Assigned to Topic",
        description: data.message || "Project team has been allotted to this topic successfully.",
      });
      invalidateAllQueries();
      setAssignTopicModal(null);
      setGroupSearchQuery("");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to assign team",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Unassign Topic from Group Mutation
  const unassignTopicFromGroupMutation = useMutation({
    mutationFn: async (groupId: number) => {
      const res = await apiRequest("DELETE", `/api/student-groups/${groupId}/topic`);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Topic Unassigned",
        description: "The project team has been detached from this topic.",
      });
      invalidateAllQueries();
      setConfirmUnassignGroup(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to unassign topic",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // General Team-Supervisor Assignment Mutation
  const assignTeamSupervisorMutation = useMutation({
    mutationFn: async ({ groupId, supervisorId }: { groupId: number; supervisorId: number | null }) => {
      const res = await apiRequest("PATCH", `/api/student-groups/${groupId}/supervisor`, { supervisorId });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Supervisor Assignment Updated",
        description: "Team mentor allotment has been saved successfully.",
      });
      invalidateAllQueries();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update team allotment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handlers
  const handleEditSupervisorOpen = (sup: ISupervisorData) => {
    setEditSupervisor(sup);
    supervisorForm.reset({
      prefix: sup.prefix || "",
      firstName: sup.firstName,
      lastName: sup.lastName,
      empId: sup.empId || "",
      designation: sup.designation || "",
      department: sup.department || "",
      email: sup.email,
      mobile: sup.mobile || "",
    });
  };

  const handleEditTopicOpen = (topic: ISubmittedTopic) => {
    setEditTopic(topic);
    topicForm.reset({
      title: topic.title,
      description: topic.description || "",
      technology: topic.technology,
      projectType: topic.projectType,
      course: (topic.course === "MCA" ? "MCA" : "BCA") as "BCA" | "MCA",
      estimatedComplexity: (topic.estimatedComplexity === "Hard" || topic.estimatedComplexity === "Easy" ? topic.estimatedComplexity : "Medium") as "Easy" | "Medium" | "Hard",
    });
  };

  // Filter supervisors using tokenized multi-word search engine
  const searchedSupervisors = filterBySearchQuery(supervisors, searchQuery, (sup: ISupervisorData) =>
    createSearchDocument(
      sup.prefix,
      sup.firstName,
      sup.lastName,
      sup.empId,
      sup.email,
      sup.designation,
      sup.department,
      sup.mobile,
      sup.submittedTopics.map((t) => [
        t.title,
        t.topicCode,
        t.technology,
        t.assignedTeam?.name,
        t.assignedTeam?.projectTeamId
      ]),
      sup.assignedTeams.map((team) => [team.name, team.projectTeamId])
    )
  );

  const filteredSupervisors = searchedSupervisors.filter((sup: ISupervisorData) => {
    if (activeTab === "active") return sup.metrics.assignedTeams > 0;
    if (activeTab === "available") return sup.metrics.assignedTeams === 0;
    if (activeTab === "pending_topics") return sup.metrics.pendingTopics > 0;
    return true;
  });

  // Filter groups for the "Assign Group to Specific Topic" Modal
  const candidateGroupsForTopic = filterBySearchQuery(
    allStudentGroups.filter((g: any) => {
      if (!assignTopicModal) return false;
      const targetCourse = assignTopicModal.topic.course;

      // Must match the topic cohort course (BCA with BCA, MCA with MCA)
      if (g.course && g.course !== targetCourse) return false;

      // Filter by tab: unassigned vs all
      if (groupTabFilter === "unassigned" && g.project?.topicId) {
        return false;
      }
      return true;
    }),
    groupSearchQuery,
    (g: any) =>
      createSearchDocument(
        g.name,
        g.projectTeamId,
        g.supervisor?.prefix,
        g.supervisor?.firstName,
        g.supervisor?.lastName,
        g.members?.map((m: any) => [m.firstName, m.lastName, m.enrollmentNumber, m.email])
      )
  );

  // Filter groups for General Team Allotment Dialog
  const filteredAllotmentGroups = filterBySearchQuery(
    allStudentGroups,
    allotTeamSearch,
    (g: any) =>
      createSearchDocument(
        g.name,
        g.projectTeamId,
        g.supervisor?.prefix,
        g.supervisor?.firstName,
        g.supervisor?.lastName,
        g.members?.map((m: any) => [m.firstName, m.lastName, m.enrollmentNumber])
      )
  );

  if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.COORDINATOR)) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-destructive">Access Restricted</CardTitle>
              <CardDescription>
                You need Administrator or Coordinator permissions to access Supervisor Management.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="w-full max-w-full space-y-6 pb-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <GraduationCap className="h-8 w-8 text-primary" />
              Supervisor Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Review faculty topic proposals, inspect team allotments directly beside each topic, and manage supervisor workloads.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="px-3 py-1 font-medium bg-background text-xs">
              {courseFilter === "all" ? "All Cohorts (BCA & MCA)" : `${courseFilter} Cohort`}
            </Badge>
          </div>
        </div>

        {/* Metric Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          <Card className="border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Supervisors</p>
                <p className="text-xl font-bold">{stats.totalSupervisors}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400">
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Active Mentors</p>
                <p className="text-xl font-bold">{stats.activeSupervisors}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Available</p>
                <p className="text-xl font-bold">{stats.availableSupervisors}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Proposed Topics</p>
                <p className="text-xl font-bold">{stats.totalTopicsSubmitted}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Approved Topics</p>
                <p className="text-xl font-bold">{stats.totalTopicsApproved}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Teams Supervised</p>
                <p className="text-xl font-bold">{stats.totalTeamsAssigned}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Tabs Row */}
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search faculty name, emp ID, department, topic, team name, team ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="overflow-x-auto max-w-full pb-1 lg:pb-0">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
              <TabsList className="w-max">
                <TabsTrigger value="all">All ({supervisors.length})</TabsTrigger>
                <TabsTrigger value="active">Active Mentors ({stats.activeSupervisors})</TabsTrigger>
                <TabsTrigger value="available">Available ({stats.availableSupervisors})</TabsTrigger>
                <TabsTrigger value="pending_topics">
                  Pending Topics ({supervisors.filter((s) => s.metrics.pendingTopics > 0).length})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Supervisors Roster Section (Responsive Cards View + Table View Toggle) */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <span>Faculty Supervisors & Topic Allotments</span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Showing {filteredSupervisors.length} of {supervisors.length} registered faculty supervisors with topic-to-group mappings
              </p>
            </div>

            <div className="flex items-center gap-1 self-start sm:self-center bg-muted/60 p-1 rounded-lg border">
              <Button
                variant={viewMode === "cards" ? "default" : "ghost"}
                size="sm"
                className="h-7 text-xs px-2.5 gap-1.5"
                onClick={() => setViewMode("cards")}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span>Cards View</span>
              </Button>
              <Button
                variant={viewMode === "table" ? "default" : "ghost"}
                size="sm"
                className="h-7 text-xs px-2.5 gap-1.5"
                onClick={() => setViewMode("table")}
              >
                <List className="h-3.5 w-3.5" />
                <span>Table View</span>
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <Card key={i} className="p-6">
                  <Skeleton className="h-24 w-full" />
                </Card>
              ))}
            </div>
          ) : filteredSupervisors.length === 0 ? (
            <Card className="border-border">
              <div className="text-center py-12 px-4">
                <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-lg font-medium text-foreground">No Supervisors Found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {searchQuery ? "No faculty matched your search criteria." : "No supervisors have been registered yet."}
                </p>
              </div>
            </Card>
          ) : viewMode === "cards" ? (
            /* ========================================================================= */
            /* VIEW MODE A: FULLY REACTIVE SUPERVISOR CARDS (NO HORIZONTAL OVERFLOW)    */
            /* ========================================================================= */
            <div className="space-y-4">
              {filteredSupervisors.map((sup: ISupervisorData) => {
                const hasTopics = sup.submittedTopics.length > 0;

                return (
                  <Card
                    key={sup.id}
                    className="border-border hover:border-primary/40 transition-all shadow-sm overflow-hidden"
                  >
                    {/* Supervisor Header: Profile Info + Workload + Direct Manage/Edit/View Actions */}
                    <div className="p-4 bg-muted/25 border-b border-border/80 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Left: Faculty Details */}
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">
                          {sup.firstName[0]}{sup.lastName[0]}
                        </div>
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-foreground text-base">
                              {sup.prefix ? `${sup.prefix} ` : ""}{sup.firstName} {sup.lastName}
                            </h3>
                            {sup.empId && (
                              <Badge variant="outline" className="font-mono text-xs px-2 py-0 border-primary/30 text-primary">
                                {sup.empId}
                              </Badge>
                            )}
                            {sup.designation && (
                              <Badge variant="secondary" className="text-xs">
                                {sup.designation}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-x-4 gap-y-1 text-xs text-muted-foreground flex-wrap">
                            {sup.department && (
                              <span className="flex items-center gap-1">
                                <Building className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
                                <span>{sup.department}</span>
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Mail className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
                              <span className="truncate">{sup.email}</span>
                            </span>
                            {sup.mobile && (
                              <span className="flex items-center gap-1 font-mono">
                                <Phone className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
                                <span>{sup.mobile}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Mentorship Capacity + Primary Actions (Manage, Edit, View) */}
                      <div className="flex items-center gap-2.5 flex-wrap justify-between lg:justify-end shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-border/50">
                        {/* Workload Status Widget */}
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-background text-xs">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-foreground">{sup.metrics.assignedTeams}/5 Teams</span>
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-1.5 py-0 h-4 capitalize ${
                                  sup.metrics.workloadStatus === "available"
                                    ? "border-green-500/30 text-green-600 bg-green-500/10"
                                    : sup.metrics.workloadStatus === "optimal"
                                    ? "border-blue-500/30 text-blue-600 bg-blue-500/10"
                                    : sup.metrics.workloadStatus === "high"
                                    ? "border-amber-500/30 text-amber-600 bg-amber-500/10"
                                    : "border-red-500/30 text-red-600 bg-red-500/10"
                                }`}
                              >
                                {sup.metrics.workloadStatus}
                              </Badge>
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                              {sup.metrics.totalStudentsSupervised} students mentored
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs text-primary border-primary/30 hover:bg-primary/10 gap-1 ml-1"
                            onClick={() => {
                              setAllotTeamSupervisor(sup);
                              setAllotTeamSearch("");
                            }}
                          >
                            <ArrowRightLeft className="h-3 w-3" />
                            <span className="hidden sm:inline">Allot Team</span>
                          </Button>
                        </div>

                        {/* Quick Actions: View, Edit, Manage Topics - ALWAYS ON SCREEN */}
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs gap-1.5 hover:bg-muted"
                            onClick={() => setViewSupervisor(sup)}
                            title="View Comprehensive Overview"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>View</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs gap-1.5 hover:bg-muted"
                            onClick={() => handleEditSupervisorOpen(sup)}
                            title="Edit Supervisor Profile"
                          >
                            <Edit className="h-3.5 w-3.5" />
                            <span>Edit</span>
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            className="h-8 text-xs gap-1.5 shadow-sm"
                            onClick={() => setManageTopicsSupervisor(sup)}
                            title="Manage Topics & Allotments"
                          >
                            <BookOpen className="h-3.5 w-3.5" />
                            <span>Manage Topics ({sup.submittedTopics.length})</span>
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Topics Section: All topics displayed directly with full reactivity */}
                    <div className="p-4 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-semibold text-foreground">Submitted Topics & Assigned Groups:</span>
                          <Badge variant="secondary" className="text-xs font-medium">
                            {sup.metrics.totalTopics} {sup.metrics.totalTopics === 1 ? "Topic" : "Topics"}
                          </Badge>
                          {sup.metrics.assignedTopics > 0 && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-blue-500/40 text-blue-600 bg-blue-500/10 font-semibold">
                              {sup.metrics.assignedTopics} Assigned to Teams
                            </Badge>
                          )}
                          {sup.metrics.availableTopics > 0 && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-green-500/40 text-green-600 bg-green-500/10">
                              {sup.metrics.availableTopics} Available
                            </Badge>
                          )}
                          {sup.metrics.pendingTopics > 0 && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-amber-500/40 text-amber-600 bg-amber-500/10">
                              {sup.metrics.pendingTopics} Pending Review
                            </Badge>
                          )}
                        </div>
                      </div>

                      {hasTopics ? (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                          {sup.submittedTopics.map((topic) => (
                            <div
                              key={topic.id}
                              className="p-3 rounded-lg border bg-card hover:border-primary/30 transition-all shadow-sm space-y-2.5 flex flex-col justify-between"
                            >
                              <div className="space-y-1.5">
                                {/* Top Row: Topic Code, Title, Course, Status */}
                                <div className="flex items-start justify-between gap-2">
                                  <div className="space-y-0.5 min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {topic.topicCode && (
                                        <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0 h-4 border-primary/30 text-primary">
                                          {topic.topicCode}
                                        </Badge>
                                      )}
                                      <span className="font-semibold text-foreground text-xs" title={topic.title}>
                                        {topic.title}
                                      </span>
                                      <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5">
                                        {topic.course}
                                      </Badge>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground font-mono truncate">
                                      Tech: {topic.technology} • Complexity: {topic.estimatedComplexity}
                                    </p>
                                  </div>

                                  <Badge
                                    variant="outline"
                                    className={`text-[9px] px-1.5 py-0 h-4 capitalize shrink-0 ${
                                      topic.status === "approved"
                                        ? "border-green-500/30 text-green-600 bg-green-500/10"
                                        : topic.status === "rejected"
                                        ? "border-red-500/30 text-red-600 bg-red-500/10"
                                        : "border-amber-500/30 text-amber-600 bg-amber-500/10"
                                    }`}
                                  >
                                    {topic.status}
                                  </Badge>
                                </div>

                                {/* Bottom Row: Assigned Group Box */}
                                <div className="pt-2 border-t border-border/60">
                                  {topic.assignedTeam ? (
                                    <div className="p-2 rounded-md bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                                      <div className="min-w-0 flex items-center gap-2 flex-1">
                                        <div className="p-1 rounded bg-blue-500/15 text-blue-600 dark:text-blue-400 shrink-0">
                                          <Users className="h-3.5 w-3.5" />
                                        </div>
                                        <div className="min-w-0">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="text-xs font-bold text-foreground truncate">
                                              {topic.assignedTeam.name}
                                            </span>
                                            {topic.assignedTeam.projectTeamId && (
                                              <Badge variant="outline" className="font-mono text-[9px] px-1 py-0 h-3.5 bg-background">
                                                {topic.assignedTeam.projectTeamId}
                                              </Badge>
                                            )}
                                            <span className="text-[10px] text-muted-foreground">
                                              • {topic.assignedTeam.memberCount} members
                                            </span>
                                          </div>
                                          {topic.assignedTeam.members && topic.assignedTeam.members.length > 0 && (
                                            <p className="text-[10px] text-muted-foreground truncate">
                                              {topic.assignedTeam.members.map((m) => `${m.firstName} (${m.enrollmentNumber})`).join(", ")}
                                            </p>
                                          )}
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-1 shrink-0 ml-auto">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-6 text-[11px] px-2 text-primary border-primary/30 hover:bg-primary/10 gap-1"
                                          onClick={() => {
                                            setAssignTopicModal({ topic, supervisor: sup });
                                            setGroupSearchQuery("");
                                            setGroupTabFilter("unassigned");
                                          }}
                                        >
                                          Change
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                          title="Unassign team from topic"
                                          onClick={() => {
                                            setConfirmUnassignGroup({
                                              groupId: topic.assignedTeam!.id,
                                              groupName: topic.assignedTeam!.name,
                                              topicTitle: topic.title,
                                            });
                                          }}
                                        >
                                          <X className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="p-2 rounded-md border border-dashed bg-muted/20 flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0 flex-1">
                                        <span className="italic shrink-0">No team assigned</span>
                                        {topic.status !== "approved" && (
                                          <span className="text-[10px] text-amber-600 font-medium truncate">
                                            (Requires approval before allotment)
                                          </span>
                                        )}
                                      </div>

                                      {topic.status === "approved" ? (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-6 text-xs text-primary border-primary/40 hover:bg-primary/10 gap-1 shrink-0 ml-auto"
                                          onClick={() => {
                                            setAssignTopicModal({ topic, supervisor: sup });
                                            setGroupSearchQuery("");
                                            setGroupTabFilter("unassigned");
                                          }}
                                        >
                                          <UserPlus className="h-3 w-3" />
                                          Assign Group
                                        </Button>
                                      ) : (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 text-[10px] text-green-600 hover:bg-green-500/10 gap-1 px-1.5 shrink-0 ml-auto"
                                          onClick={() => approveTopicMutation.mutate(topic.id)}
                                          disabled={approveTopicMutation.isPending}
                                        >
                                          <Check className="h-3 w-3" />
                                          Approve & Allot
                                        </Button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic py-2">
                          No project topics submitted by this supervisor yet.
                        </p>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            /* ========================================================================= */
            /* VIEW MODE B: TABLE VIEW WITH STICKY ACTIONS COLUMN & IN-ROW SHORTCUTS    */
            /* ========================================================================= */
            <Card className="border-border w-full max-w-full overflow-hidden">
              <div className="overflow-x-auto w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[280px] min-w-[240px]">Faculty Profile</TableHead>
                      <TableHead className="min-w-[420px]">Submitted Topics & Assigned Groups</TableHead>
                      <TableHead className="w-[180px] min-w-[150px]">Mentorship Load</TableHead>
                      <TableHead className="text-right w-[110px] min-w-[110px] sticky right-0 bg-background z-10 border-l shadow-sm">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSupervisors.map((sup: ISupervisorData) => {
                      const hasTopics = sup.submittedTopics.length > 0;

                      return (
                        <TableRow key={sup.id} className="hover:bg-muted/30">
                          {/* Faculty Profile + Direct Actions in Column 1 */}
                          <TableCell className="align-top">
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2">
                                <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                                  {sup.firstName[0]}{sup.lastName[0]}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-semibold text-foreground text-sm truncate">
                                    {sup.prefix ? `${sup.prefix} ` : ""}{sup.firstName} {sup.lastName}
                                  </p>
                                  {sup.empId && (
                                    <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0 h-4 border-primary/30 text-primary">
                                      {sup.empId}
                                    </Badge>
                                  )}
                                </div>
                              </div>

                              <div className="space-y-1 text-xs text-muted-foreground pl-11">
                                {sup.designation && (
                                  <p className="font-medium text-foreground text-xs">
                                    {sup.designation}
                                  </p>
                                )}
                                {sup.department && (
                                  <p className="flex items-center gap-1 text-[11px]">
                                    <Building className="h-3 w-3 shrink-0" />
                                    <span>{sup.department}</span>
                                  </p>
                                )}
                                <p className="flex items-center gap-1 text-[11px]">
                                  <Mail className="h-3 w-3 shrink-0" />
                                  <span className="truncate">{sup.email}</span>
                                </p>
                                {sup.mobile && (
                                  <p className="flex items-center gap-1 text-[11px] font-mono">
                                    <Phone className="h-3 w-3 shrink-0" />
                                    <span>{sup.mobile}</span>
                                  </p>
                                )}

                                {/* In-column quick actions so Manage, Edit, View are never out of reach */}
                                <div className="flex items-center gap-1 pt-2 flex-wrap">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-6 text-[11px] px-2 gap-1"
                                    onClick={() => setViewSupervisor(sup)}
                                  >
                                    <Eye className="h-3 w-3" />
                                    View
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-6 text-[11px] px-2 gap-1"
                                    onClick={() => handleEditSupervisorOpen(sup)}
                                  >
                                    <Edit className="h-3 w-3" />
                                    Edit
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-6 text-[11px] px-2 gap-1 text-primary border-primary/30"
                                    onClick={() => setManageTopicsSupervisor(sup)}
                                  >
                                    <BookOpen className="h-3 w-3" />
                                    Topics ({sup.submittedTopics.length})
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </TableCell>

                          {/* Submitted Topics & Assigned Groups */}
                          <TableCell className="align-top">
                            <div className="space-y-2.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Badge variant="secondary" className="text-xs font-medium">
                                  {sup.metrics.totalTopics} {sup.metrics.totalTopics === 1 ? "Topic" : "Topics"}
                                </Badge>
                                {sup.metrics.assignedTopics > 0 && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-blue-500/40 text-blue-600 bg-blue-500/10 font-semibold">
                                    {sup.metrics.assignedTopics} Assigned to Teams
                                  </Badge>
                                )}
                                {sup.metrics.availableTopics > 0 && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-green-500/40 text-green-600 bg-green-500/10">
                                    {sup.metrics.availableTopics} Available
                                  </Badge>
                                )}
                                {sup.metrics.pendingTopics > 0 && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-amber-500/40 text-amber-600 bg-amber-500/10">
                                    {sup.metrics.pendingTopics} Pending Review
                                  </Badge>
                                )}
                              </div>

                              {hasTopics ? (
                                <div className="space-y-2">
                                  {sup.submittedTopics.map((topic) => (
                                    <div
                                      key={topic.id}
                                      className="p-2.5 rounded-lg border bg-card hover:border-primary/30 transition-all shadow-sm space-y-2"
                                    >
                                      {/* Top Row: Topic Code, Title, Course, Status */}
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="space-y-0.5 min-w-0 flex-1">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            {topic.topicCode && (
                                              <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0 h-4 border-primary/30 text-primary">
                                                {topic.topicCode}
                                              </Badge>
                                            )}
                                            <span className="font-semibold text-foreground text-xs" title={topic.title}>
                                              {topic.title}
                                            </span>
                                            <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5">
                                              {topic.course}
                                            </Badge>
                                          </div>
                                          <p className="text-[11px] text-muted-foreground font-mono truncate">
                                            Tech: {topic.technology} • Complexity: {topic.estimatedComplexity}
                                          </p>
                                        </div>

                                        <Badge
                                          variant="outline"
                                          className={`text-[9px] px-1.5 py-0 h-4 capitalize shrink-0 ${
                                            topic.status === "approved"
                                              ? "border-green-500/30 text-green-600 bg-green-500/10"
                                              : topic.status === "rejected"
                                              ? "border-red-500/30 text-red-600 bg-red-500/10"
                                              : "border-amber-500/30 text-amber-600 bg-amber-500/10"
                                          }`}
                                        >
                                          {topic.status}
                                        </Badge>
                                      </div>

                                      {/* Bottom Row: Assigned Group Box */}
                                      <div className="pt-1.5 border-t border-border/60">
                                        {topic.assignedTeam ? (
                                          <div className="p-2 rounded-md bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                                            <div className="min-w-0 flex items-center gap-2 flex-1">
                                              <div className="p-1 rounded bg-blue-500/15 text-blue-600 dark:text-blue-400 shrink-0">
                                                <Users className="h-3.5 w-3.5" />
                                              </div>
                                              <div className="min-w-0">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                  <span className="text-xs font-bold text-foreground truncate">
                                                    {topic.assignedTeam.name}
                                                  </span>
                                                  {topic.assignedTeam.projectTeamId && (
                                                    <Badge variant="outline" className="font-mono text-[9px] px-1 py-0 h-3.5 bg-background">
                                                      {topic.assignedTeam.projectTeamId}
                                                    </Badge>
                                                  )}
                                                  <span className="text-[10px] text-muted-foreground">
                                                    • {topic.assignedTeam.memberCount} members
                                                  </span>
                                                </div>
                                                {topic.assignedTeam.members && topic.assignedTeam.members.length > 0 && (
                                                  <p className="text-[10px] text-muted-foreground truncate">
                                                    {topic.assignedTeam.members.map((m) => `${m.firstName} (${m.enrollmentNumber})`).join(", ")}
                                                  </p>
                                                )}
                                              </div>
                                            </div>

                                            <div className="flex items-center gap-1 shrink-0 ml-auto">
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-6 text-[11px] px-2 text-primary border-primary/30 hover:bg-primary/10 gap-1"
                                                onClick={() => {
                                                  setAssignTopicModal({ topic, supervisor: sup });
                                                  setGroupSearchQuery("");
                                                  setGroupTabFilter("unassigned");
                                                }}
                                              >
                                                Change
                                              </Button>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                title="Unassign team from topic"
                                                onClick={() => {
                                                  setConfirmUnassignGroup({
                                                    groupId: topic.assignedTeam!.id,
                                                    groupName: topic.assignedTeam!.name,
                                                    topicTitle: topic.title,
                                                  });
                                                }}
                                              >
                                                <X className="h-3 w-3" />
                                              </Button>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="p-1.5 rounded-md border border-dashed bg-muted/20 flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0 flex-1">
                                              <span className="italic shrink-0">No team assigned</span>
                                              {topic.status !== "approved" && (
                                                <span className="text-[10px] text-amber-600 font-medium truncate">
                                                  (Requires approval before allotment)
                                                </span>
                                              )}
                                            </div>

                                            {topic.status === "approved" ? (
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-6 text-xs text-primary border-primary/40 hover:bg-primary/10 gap-1 shrink-0 ml-auto"
                                                onClick={() => {
                                                  setAssignTopicModal({ topic, supervisor: sup });
                                                  setGroupSearchQuery("");
                                                  setGroupTabFilter("unassigned");
                                                }}
                                              >
                                                <UserPlus className="h-3 w-3" />
                                                Assign Group
                                              </Button>
                                            ) : (
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 text-[10px] text-green-600 hover:bg-green-500/10 gap-1 px-1.5 shrink-0 ml-auto"
                                                onClick={() => approveTopicMutation.mutate(topic.id)}
                                                disabled={approveTopicMutation.isPending}
                                              >
                                                <Check className="h-3 w-3" />
                                                Approve & Allot
                                              </Button>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground italic py-2">
                                  No project topics submitted by this supervisor yet.
                                </p>
                              )}
                            </div>
                          </TableCell>

                          {/* Mentorship Load & Capacity */}
                          <TableCell className="align-top">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-foreground">
                                  {sup.metrics.assignedTeams} / 5 Teams
                                </span>
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] px-1.5 py-0 h-4 capitalize ${
                                    sup.metrics.workloadStatus === "available"
                                      ? "border-green-500/30 text-green-600 bg-green-500/10"
                                      : sup.metrics.workloadStatus === "optimal"
                                      ? "border-blue-500/30 text-blue-600 bg-blue-500/10"
                                      : sup.metrics.workloadStatus === "high"
                                      ? "border-amber-500/30 text-amber-600 bg-amber-500/10"
                                      : "border-red-500/30 text-red-600 bg-red-500/10"
                                  }`}
                                >
                                  {sup.metrics.workloadStatus}
                                </Badge>
                              </div>

                              <Progress
                                value={Math.min(100, (sup.metrics.assignedTeams / 5) * 100)}
                                className="h-1.5"
                              />

                              <p className="text-[11px] text-muted-foreground">
                                {sup.metrics.totalStudentsSupervised} students under mentorship
                              </p>

                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs w-full gap-1.5 text-primary border-primary/30 hover:bg-primary/10 mt-1"
                                onClick={() => {
                                  setAllotTeamSupervisor(sup);
                                  setAllotTeamSearch("");
                                }}
                              >
                                <ArrowRightLeft className="h-3 w-3" />
                                Allot Project Team
                              </Button>
                            </div>
                          </TableCell>

                          {/* Actions Column: Pinned sticky right so never off-screen */}
                          <TableCell className="align-top text-right sticky right-0 bg-card z-10 border-l shadow-[-3px_0_6px_-2px_rgba(0,0,0,0.06)]">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                title="View Comprehensive Overview"
                                onClick={() => setViewSupervisor(sup)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                title="Edit Supervisor Profile"
                                onClick={() => handleEditSupervisorOpen(sup)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-primary hover:bg-primary/10"
                                title="Manage Topics & Allotments"
                                onClick={() => setManageTopicsSupervisor(sup)}
                              >
                                <BookOpen className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </div>

        {/* ========================================================================= */}
        {/* MODAL 1: ASSIGN SPECIFIC GROUP TO SPECIFIC TOPIC (PRIMARY NEW FEATURE)     */}
        {/* ========================================================================= */}
        <Dialog open={!!assignTopicModal} onOpenChange={(open) => !open && setAssignTopicModal(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            {assignTopicModal && (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-2">
                    <UserPlus className="h-5 w-5 text-primary" />
                    <DialogTitle>Assign Team to Topic</DialogTitle>
                  </div>
                  <DialogDescription>
                    Allot an eligible project team to this faculty-proposed topic. The faculty will be designated as the team's supervisor mentor.
                  </DialogDescription>
                </DialogHeader>

                {/* Target Topic Brief */}
                <div className="p-3 rounded-lg border bg-muted/40 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {assignTopicModal.topic.topicCode && (
                      <Badge variant="outline" className="font-mono text-xs text-primary border-primary/30">
                        {assignTopicModal.topic.topicCode}
                      </Badge>
                    )}
                    <span className="font-semibold text-sm text-foreground">
                      {assignTopicModal.topic.title}
                    </span>
                    <Badge variant="secondary" className="text-[10px]">
                      {assignTopicModal.topic.course}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Supervisor: <strong>{assignTopicModal.supervisor.prefix ? `${assignTopicModal.supervisor.prefix} ` : ""}{assignTopicModal.supervisor.firstName} {assignTopicModal.supervisor.lastName}</strong> • Tech: {assignTopicModal.topic.technology}
                  </p>
                </div>

                {/* Search & Tabs */}
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                      <Input
                        placeholder={`Search ${assignTopicModal.topic.course} teams, project ID, student name...`}
                        value={groupSearchQuery}
                        onChange={(e) => setGroupSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>

                    <Tabs
                      value={groupTabFilter}
                      onValueChange={(v: any) => setGroupTabFilter(v)}
                      className="w-auto"
                    >
                      <TabsList>
                        <TabsTrigger value="unassigned" className="text-xs">
                          Needs Topic
                        </TabsTrigger>
                        <TabsTrigger value="all" className="text-xs">
                          All {assignTopicModal.topic.course} Teams
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>

                  {/* Candidate Teams List */}
                  <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                    {candidateGroupsForTopic.length === 0 ? (
                      <div className="text-center py-8 text-sm text-muted-foreground">
                        <Users className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                        <p className="font-medium">No matching teams available</p>
                        <p className="text-xs mt-1">
                          {groupTabFilter === "unassigned"
                            ? `All ${assignTopicModal.topic.course} teams currently have topics assigned. Switch to "All" to reassign an existing team.`
                            : "No teams found matching your search."}
                        </p>
                      </div>
                    ) : (
                      candidateGroupsForTopic.map((g: any) => {
                        const hasTopic = !!g.project?.topicId;
                        const isThisTopic = g.project?.topicId === assignTopicModal.topic.id;

                        return (
                          <div
                            key={g.id}
                            className={`p-3 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                              isThisTopic
                                ? "bg-primary/5 border-primary/40"
                                : "bg-card hover:bg-muted/30"
                            }`}
                          >
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-sm text-foreground">
                                  {g.name}
                                </span>
                                {g.projectTeamId && (
                                  <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0 h-4">
                                    {g.projectTeamId}
                                  </Badge>
                                )}
                                <Badge variant="secondary" className="text-[10px] py-0 h-4">
                                  {g.course}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {g.members?.length || 0} members
                                </span>
                              </div>

                              <p className="text-xs text-muted-foreground truncate">
                                Students: {g.members?.map((m: any) => `${m.firstName} ${m.lastName}`).join(", ")}
                              </p>

                              {hasTopic ? (
                                <p className="text-[11px] text-amber-600 flex items-center gap-1 font-medium">
                                  <AlertCircle className="h-3 w-3 shrink-0" />
                                  Currently assigned: {g.project.topicTitle || `Topic #${g.project.topicId}`}
                                </p>
                              ) : (
                                <p className="text-[11px] text-green-600 flex items-center gap-1 font-medium">
                                  <Check className="h-3 w-3 shrink-0" />
                                  Pending topic assignment (Available)
                                </p>
                              )}
                            </div>

                            <div className="shrink-0">
                              {isThisTopic ? (
                                <Badge variant="outline" className="text-xs text-primary border-primary/40 py-1 px-2.5 bg-primary/10">
                                  Currently Assigned
                                </Badge>
                              ) : (
                                <Button
                                  size="sm"
                                  className="h-8 text-xs gap-1.5"
                                  disabled={assignTopicToGroupMutation.isPending}
                                  onClick={() =>
                                    assignTopicToGroupMutation.mutate({
                                      groupId: g.id,
                                      topicId: assignTopicModal.topic.id,
                                      updateSupervisor: true,
                                    })
                                  }
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  Allot to Team
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* ========================================================================= */}
        {/* MODAL 2: CONFIRM UNASSIGN TOPIC FROM GROUP                                */}
        {/* ========================================================================= */}
        <Dialog
          open={!!confirmUnassignGroup}
          onOpenChange={(open) => !open && setConfirmUnassignGroup(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Unassign Project Topic
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to unassign team <strong>"{confirmUnassignGroup?.groupName}"</strong> from the topic <strong>"{confirmUnassignGroup?.topicTitle}"</strong>?
              </DialogDescription>
            </DialogHeader>

            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive space-y-1">
              <p className="font-semibold">Notice:</p>
              <p>
                The topic will become available for assignment to other teams. The students will be notified that their team topic has been unassigned and is ready for a new selection.
              </p>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setConfirmUnassignGroup(null)}
                disabled={unassignTopicFromGroupMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={unassignTopicFromGroupMutation.isPending}
                onClick={() => {
                  if (confirmUnassignGroup) {
                    unassignTopicFromGroupMutation.mutate(confirmUnassignGroup.groupId);
                  }
                }}
              >
                {unassignTopicFromGroupMutation.isPending ? "Unassigning..." : "Confirm Unassign"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ========================================================================= */}
        {/* MODAL 3: VIEW SUPERVISOR COMPREHENSIVE OVERVIEW                           */}
        {/* ========================================================================= */}
        <Dialog open={!!viewSupervisor} onOpenChange={(open) => !open && setViewSupervisor(null)}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            {viewSupervisor && (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center text-sm font-bold shrink-0">
                      {viewSupervisor.firstName[0]}{viewSupervisor.lastName[0]}
                    </div>
                    <div>
                      <DialogTitle className="text-xl">
                        {viewSupervisor.prefix ? `${viewSupervisor.prefix} ` : ""}{viewSupervisor.firstName} {viewSupervisor.lastName}
                      </DialogTitle>
                      <DialogDescription>
                        {viewSupervisor.designation || "Faculty Supervisor"} • {viewSupervisor.department || "Academic Department"}
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                <Tabs defaultValue="overview" className="mt-4">
                  <TabsList className="grid grid-cols-3">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="topics">
                      Submitted Topics ({viewSupervisor.submittedTopics.length})
                    </TabsTrigger>
                    <TabsTrigger value="teams">
                      Assigned Teams ({viewSupervisor.assignedTeams.length})
                    </TabsTrigger>
                  </TabsList>

                  {/* Overview Tab */}
                  <TabsContent value="overview" className="space-y-4 pt-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="p-3 rounded-lg border bg-muted/30 space-y-1">
                        <span className="text-xs text-muted-foreground font-medium">Employee ID</span>
                        <p className="font-semibold font-mono">{viewSupervisor.empId || "N/A"}</p>
                      </div>
                      <div className="p-3 rounded-lg border bg-muted/30 space-y-1">
                        <span className="text-xs text-muted-foreground font-medium">Department</span>
                        <p className="font-semibold">{viewSupervisor.department || "N/A"}</p>
                      </div>
                      <div className="p-3 rounded-lg border bg-muted/30 space-y-1">
                        <span className="text-xs text-muted-foreground font-medium">Email</span>
                        <p className="font-semibold">{viewSupervisor.email}</p>
                      </div>
                      <div className="p-3 rounded-lg border bg-muted/30 space-y-1">
                        <span className="text-xs text-muted-foreground font-medium">Mobile Contact</span>
                        <p className="font-semibold font-mono">{viewSupervisor.mobile || "N/A"}</p>
                      </div>
                    </div>

                    <div className="p-4 rounded-lg border bg-muted/20 space-y-3">
                      <h4 className="font-semibold text-sm">Supervision & Topic Metrics</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                        <div className="p-2 bg-background rounded-md border">
                          <p className="text-lg font-bold text-primary">{viewSupervisor.metrics.totalTopics}</p>
                          <p className="text-[11px] text-muted-foreground">Topics Proposed</p>
                        </div>
                        <div className="p-2 bg-background rounded-md border">
                          <p className="text-lg font-bold text-green-600">{viewSupervisor.metrics.approvedTopics}</p>
                          <p className="text-[11px] text-muted-foreground">Approved</p>
                        </div>
                        <div className="p-2 bg-background rounded-md border">
                          <p className="text-lg font-bold text-blue-600">{viewSupervisor.metrics.assignedTeams}</p>
                          <p className="text-[11px] text-muted-foreground">Teams Mentored</p>
                        </div>
                        <div className="p-2 bg-background rounded-md border">
                          <p className="text-lg font-bold text-purple-600">{viewSupervisor.metrics.totalStudentsSupervised}</p>
                          <p className="text-[11px] text-muted-foreground">Total Students</p>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Topics Tab */}
                  <TabsContent value="topics" className="space-y-3 pt-3">
                    {viewSupervisor.submittedTopics.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">
                        No project topics submitted by this supervisor yet.
                      </p>
                    ) : (
                      viewSupervisor.submittedTopics.map((topic) => (
                        <div key={topic.id} className="p-3.5 rounded-lg border bg-card space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                {topic.topicCode && (
                                  <Badge variant="outline" className="font-mono text-xs text-primary border-primary/30">
                                    {topic.topicCode}
                                  </Badge>
                                )}
                                <span className="font-semibold text-foreground text-sm">{topic.title}</span>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="secondary" className="text-[10px]">
                                  {topic.course}
                                </Badge>
                                <span className="text-xs text-muted-foreground font-mono">
                                  {topic.technology}
                                </span>
                                <span className="text-xs text-muted-foreground">• Complexity: {topic.estimatedComplexity}</span>
                              </div>
                            </div>
                            <Badge
                              variant="outline"
                              className={`text-[10px] capitalize ${
                                topic.status === "approved"
                                  ? "border-green-500/30 text-green-600 bg-green-500/10"
                                  : topic.status === "rejected"
                                  ? "border-red-500/30 text-red-600 bg-red-500/10"
                                  : "border-amber-500/30 text-amber-600 bg-amber-500/10"
                              }`}
                            >
                              {topic.status}
                            </Badge>
                          </div>

                          {topic.description && (
                            <p className="text-xs text-muted-foreground line-clamp-3">
                              {topic.description}
                            </p>
                          )}

                          {/* Assigned Team Card alongside topic */}
                          {topic.assignedTeam ? (
                            <div className="p-2.5 rounded-lg bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 text-xs text-blue-700 dark:text-blue-300 flex items-center justify-between">
                              <div className="min-w-0">
                                <p className="font-bold text-foreground">
                                  Selected by Team: {topic.assignedTeam.name} ({topic.assignedTeam.projectTeamId})
                                </p>
                                <p className="text-muted-foreground text-[11px] mt-0.5">
                                  Members: {topic.assignedTeam.members?.map((m) => `${m.firstName} (${m.enrollmentNumber})`).join(", ")}
                                </p>
                              </div>
                              <Badge variant="outline" className="text-[10px] bg-background">
                                {topic.assignedTeam.memberCount} members
                              </Badge>
                            </div>
                          ) : (
                            <div className="p-2 rounded bg-muted/20 border border-dashed text-xs text-muted-foreground flex items-center justify-between">
                              <span className="italic">No team assigned to this topic</span>
                              {topic.status === "approved" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-xs text-primary hover:bg-primary/10"
                                  onClick={() => {
                                    setViewSupervisor(null);
                                    setAssignTopicModal({ topic, supervisor: viewSupervisor });
                                    setGroupSearchQuery("");
                                    setGroupTabFilter("unassigned");
                                  }}
                                >
                                  Assign Team Now
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </TabsContent>

                  {/* Teams Tab */}
                  <TabsContent value="teams" className="space-y-3 pt-3">
                    {viewSupervisor.assignedTeams.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">
                        No student teams are currently assigned to this supervisor.
                      </p>
                    ) : (
                      viewSupervisor.assignedTeams.map((team) => (
                        <div key={team.id} className="p-3 rounded-lg border bg-card space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-foreground text-sm">{team.name}</span>
                              {team.projectTeamId && (
                                <Badge variant="outline" className="font-mono text-xs">
                                  {team.projectTeamId}
                                </Badge>
                              )}
                              <Badge variant="secondary" className="text-[10px]">
                                {team.course || "Cohort"}
                              </Badge>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {team.members.length} Members
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {team.members.map((m) => (
                              <div key={m.id} className="p-1.5 rounded bg-muted/40 text-xs flex items-center justify-between">
                                <span className="font-medium truncate">{m.firstName} {m.lastName}</span>
                                <span className="font-mono text-[10px] text-muted-foreground">({m.enrollmentNumber})</span>
                              </div>
                            ))}
                          </div>

                          {team.project?.topicTitle && (
                            <div className="p-2 rounded bg-muted/30 border text-xs space-y-0.5">
                              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                                Project Topic
                              </span>
                              <p className="font-medium text-primary">
                                {team.project.topicCode ? `${team.project.topicCode}: ` : ""}{team.project.topicTitle}
                              </p>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </TabsContent>
                </Tabs>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* ========================================================================= */}
        {/* MODAL 4: EDIT SUPERVISOR PROFILE                                         */}
        {/* ========================================================================= */}
        <Dialog open={!!editSupervisor} onOpenChange={(open) => !open && setEditSupervisor(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Supervisor Profile</DialogTitle>
              <DialogDescription>
                Update faculty employment and contact information.
              </DialogDescription>
            </DialogHeader>

            <Form {...supervisorForm}>
              <form
                onSubmit={supervisorForm.handleSubmit((data) => {
                  if (editSupervisor) {
                    updateSupervisorMutation.mutate({ userId: editSupervisor.id, data });
                  }
                })}
                className="space-y-4"
              >
                <div className="grid grid-cols-3 gap-3">
                  <FormField
                    control={supervisorForm.control}
                    name="prefix"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prefix</FormLabel>
                        <FormControl>
                          <Input placeholder="Dr. / Prof." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={supervisorForm.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input placeholder="First Name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={supervisorForm.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Last Name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={supervisorForm.control}
                    name="empId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Employee ID</FormLabel>
                        <FormControl>
                          <Input placeholder="EMP-1024" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={supervisorForm.control}
                    name="designation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Designation</FormLabel>
                        <FormControl>
                          <Input placeholder="Associate Professor" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={supervisorForm.control}
                  name="department"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department</FormLabel>
                      <FormControl>
                        <Input placeholder="Computer Science & Engineering" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={supervisorForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="faculty@integral.edu" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={supervisorForm.control}
                    name="mobile"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mobile Number</FormLabel>
                        <FormControl>
                          <Input placeholder="+91 9876543210" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <DialogFooter className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditSupervisor(null)}
                    disabled={updateSupervisorMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateSupervisorMutation.isPending}>
                    {updateSupervisorMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* ========================================================================= */}
        {/* MODAL 5: MANAGE TOPICS REVIEW & GROUP ASSIGNMENTS                         */}
        {/* ========================================================================= */}
        <Dialog
          open={!!manageTopicsSupervisor}
          onOpenChange={(open) => !open && setManageTopicsSupervisor(null)}
        >
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            {manageTopicsSupervisor && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-primary" />
                    Manage Topics for {manageTopicsSupervisor.prefix ? `${manageTopicsSupervisor.prefix} ` : ""}{manageTopicsSupervisor.firstName} {manageTopicsSupervisor.lastName}
                  </DialogTitle>
                  <DialogDescription>
                    Review proposals, allot specific student groups, or edit topic information.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 mt-3">
                  {manageTopicsSupervisor.submittedTopics.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground italic">
                      No topics submitted yet.
                    </div>
                  ) : (
                    manageTopicsSupervisor.submittedTopics.map((topic) => (
                      <div key={topic.id} className="p-3.5 rounded-lg border bg-card space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {topic.topicCode && (
                                <Badge variant="outline" className="font-mono text-xs text-primary border-primary/30">
                                  {topic.topicCode}
                                </Badge>
                              )}
                              <span className="font-semibold text-foreground text-sm">{topic.title}</span>
                              <Badge variant="secondary" className="text-[10px]">
                                {topic.course}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground font-mono">
                              Tech: {topic.technology} • Type: {topic.projectType} • Complexity: {topic.estimatedComplexity}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className={`text-xs capitalize ${
                              topic.status === "approved"
                                ? "border-green-500/30 text-green-600 bg-green-500/10"
                                : topic.status === "rejected"
                                ? "border-red-500/30 text-red-600 bg-red-500/10"
                                : "border-amber-500/30 text-amber-600 bg-amber-500/10"
                            }`}
                          >
                            {topic.status}
                          </Badge>
                        </div>

                        {topic.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {topic.description}
                          </p>
                        )}

                        {/* Assigned Team Card right next to topic details */}
                        <div className="pt-2 border-t border-border">
                          {topic.assignedTeam ? (
                            <div className="p-2.5 rounded-md bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <Users className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                                  <span className="font-bold text-sm text-foreground truncate">
                                    {topic.assignedTeam.name}
                                  </span>
                                  {topic.assignedTeam.projectTeamId && (
                                    <Badge variant="outline" className="font-mono text-[10px]">
                                      {topic.assignedTeam.projectTeamId}
                                    </Badge>
                                  )}
                                  <Badge variant="secondary" className="text-[10px]">
                                    {topic.assignedTeam.memberCount} members
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground pl-6 truncate mt-0.5">
                                  {topic.assignedTeam.members?.map((m) => `${m.firstName} ${m.lastName}`).join(", ")}
                                </p>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs text-primary border-primary/30 hover:bg-primary/10"
                                  onClick={() => {
                                    setAssignTopicModal({ topic, supervisor: manageTopicsSupervisor });
                                    setGroupSearchQuery("");
                                    setGroupTabFilter("unassigned");
                                  }}
                                >
                                  Change Group
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                  title="Unassign team"
                                  onClick={() => {
                                    setConfirmUnassignGroup({
                                      groupId: topic.assignedTeam!.id,
                                      groupName: topic.assignedTeam!.name,
                                      topicTitle: topic.title,
                                    });
                                  }}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="p-2 rounded bg-muted/20 border border-dashed flex items-center justify-between text-xs text-muted-foreground">
                              <span>No team currently assigned to this topic.</span>
                              {topic.status === "approved" ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs text-primary border-primary/40 hover:bg-primary/10 gap-1"
                                  onClick={() => {
                                    setAssignTopicModal({ topic, supervisor: manageTopicsSupervisor });
                                    setGroupSearchQuery("");
                                    setGroupTabFilter("unassigned");
                                  }}
                                >
                                  <UserPlus className="h-3.5 w-3.5" />
                                  Assign Specific Group
                                </Button>
                              ) : (
                                <Badge variant="outline" className="text-[10px] text-amber-600 bg-amber-500/10">
                                  Approve first to allot
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-border">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => handleEditTopicOpen(topic)}
                          >
                            <Edit className="h-3 w-3" />
                            Edit Details
                          </Button>

                          {topic.status !== "approved" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1 text-green-600 border-green-500/30 hover:bg-green-500/10"
                              disabled={approveTopicMutation.isPending}
                              onClick={() => approveTopicMutation.mutate(topic.id)}
                            >
                              <Check className="h-3 w-3" />
                              Approve
                            </Button>
                          )}

                          {topic.status !== "rejected" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1 text-red-600 border-red-500/30 hover:bg-red-500/10"
                              onClick={() => {
                                setRejectFeedbackDialog(topic);
                                setRejectFeedback(topic.feedback || "");
                              }}
                            >
                              <X className="h-3 w-3" />
                              Reject
                            </Button>
                          )}

                          {topic.status !== "pending" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs gap-1 text-muted-foreground hover:bg-muted"
                              disabled={markTopicPendingMutation.isPending}
                              onClick={() => markTopicPendingMutation.mutate(topic.id)}
                            >
                              <RotateCcw className="h-3 w-3" />
                              Revert to Pending
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* ========================================================================= */}
        {/* MODAL 6: EDIT TOPIC INFORMATION FORM                                      */}
        {/* ========================================================================= */}
        <Dialog open={!!editTopic} onOpenChange={(open) => !open && setEditTopic(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Topic Information</DialogTitle>
              <DialogDescription>
                Update topic title, technology, scope, cohort course, and complexity.
              </DialogDescription>
            </DialogHeader>

            <Form {...topicForm}>
              <form
                onSubmit={topicForm.handleSubmit((data) => {
                  if (editTopic) {
                    updateTopicMutation.mutate({ topicId: editTopic.id, data });
                  }
                })}
                className="space-y-4"
              >
                <FormField
                  control={topicForm.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Topic Title</FormLabel>
                      <FormControl>
                        <Input placeholder="AI Based Medical Diagnosis..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={topicForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea rows={3} placeholder="Project objectives and technical scope..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={topicForm.control}
                    name="technology"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Technology Stack</FormLabel>
                        <FormControl>
                          <Input placeholder="React, Python, Node.js..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={topicForm.control}
                    name="projectType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project Type</FormLabel>
                        <FormControl>
                          <Input placeholder="Web App / ML / Mobile" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={topicForm.control}
                    name="course"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cohort Course</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select course" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="BCA">BCA</SelectItem>
                            <SelectItem value="MCA">MCA</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={topicForm.control}
                    name="estimatedComplexity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estimated Complexity</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select complexity" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Easy">Easy</SelectItem>
                            <SelectItem value="Medium">Medium</SelectItem>
                            <SelectItem value="Hard">Hard</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <DialogFooter className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditTopic(null)}
                    disabled={updateTopicMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateTopicMutation.isPending}>
                    {updateTopicMutation.isPending ? "Saving..." : "Update Topic"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* ========================================================================= */}
        {/* MODAL 7: REJECT TOPIC WITH FEEDBACK                                       */}
        {/* ========================================================================= */}
        <Dialog
          open={!!rejectFeedbackDialog}
          onOpenChange={(open) => !open && setRejectFeedbackDialog(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-destructive">Reject Project Topic</DialogTitle>
              <DialogDescription>
                Provide reason or constructive feedback to help the supervisor improve or revise the proposal.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <p className="text-sm font-medium">Topic: {rejectFeedbackDialog?.title}</p>
              <Textarea
                rows={3}
                placeholder="State reason for rejection or required amendments..."
                value={rejectFeedback}
                onChange={(e) => setRejectFeedback(e.target.value)}
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectFeedbackDialog(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={rejectTopicMutation.isPending}
                onClick={() => {
                  if (rejectFeedbackDialog) {
                    rejectTopicMutation.mutate({
                      topicId: rejectFeedbackDialog.id,
                      feedback: rejectFeedback,
                    });
                  }
                }}
              >
                {rejectTopicMutation.isPending ? "Rejecting..." : "Confirm Rejection"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ========================================================================= */}
        {/* MODAL 8: GENERAL TEAM ALLOTMENT TO SUPERVISOR                             */}
        {/* ========================================================================= */}
        <Dialog
          open={!!allotTeamSupervisor}
          onOpenChange={(open) => !open && setAllotTeamSupervisor(null)}
        >
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            {allotTeamSupervisor && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <ArrowRightLeft className="h-5 w-5 text-primary" />
                    Allot Team to {allotTeamSupervisor.prefix ? `${allotTeamSupervisor.prefix} ` : ""}{allotTeamSupervisor.firstName} {allotTeamSupervisor.lastName}
                  </DialogTitle>
                  <DialogDescription>
                    Assign unassigned project teams or reassign teams from other mentors to this supervisor.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 mt-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      placeholder="Search team name, project team ID, or current mentor..."
                      value={allotTeamSearch}
                      onChange={(e) => setAllotTeamSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>

                  <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                    {filteredAllotmentGroups.length === 0 ? (
                      <p className="text-center text-sm text-muted-foreground py-6">
                        No project teams found matching your search.
                      </p>
                    ) : (
                      filteredAllotmentGroups.map((g: any) => {
                        const isCurrentSupervisor = g.supervisorId === allotTeamSupervisor.id;

                        return (
                          <div
                            key={g.id}
                            className={`p-3 rounded-lg border flex items-center justify-between gap-3 ${
                              isCurrentSupervisor
                                ? "bg-primary/5 border-primary/30"
                                : "bg-card hover:bg-muted/40"
                            }`}
                          >
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm truncate">{g.name}</span>
                                {g.projectTeamId && (
                                  <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0 h-4">
                                    {g.projectTeamId}
                                  </Badge>
                                )}
                                <Badge variant="secondary" className="text-[10px] py-0 h-4">
                                  {g.course || "Cohort"}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Members: {g.members?.length || 0} • Current Supervisor:{" "}
                                <strong className="text-foreground">
                                  {g.supervisor
                                    ? `${g.supervisor.firstName} ${g.supervisor.lastName}`
                                    : "Not Assigned"}
                                </strong>
                              </p>
                              {g.project?.topicTitle && (
                                <p className="text-[11px] text-blue-600 dark:text-blue-400 truncate flex items-center gap-1">
                                  <FolderGit2 className="h-3 w-3 shrink-0" />
                                  <span>{g.project.topicTitle}</span>
                                </p>
                              )}
                            </div>

                            <div>
                              {isCurrentSupervisor ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                                  disabled={assignTeamSupervisorMutation.isPending}
                                  onClick={() =>
                                    assignTeamSupervisorMutation.mutate({
                                      groupId: g.id,
                                      supervisorId: null,
                                    })
                                  }
                                >
                                  Unassign
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  className="h-8 text-xs gap-1"
                                  disabled={assignTeamSupervisorMutation.isPending}
                                  onClick={() =>
                                    assignTeamSupervisorMutation.mutate({
                                      groupId: g.id,
                                      supervisorId: allotTeamSupervisor.id,
                                    })
                                  }
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  Assign to {allotTeamSupervisor.firstName}
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
