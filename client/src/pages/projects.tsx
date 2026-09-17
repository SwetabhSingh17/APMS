import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import TopicCard from "@/components/projects/topic-card";
import ProjectTable from "@/components/projects/project-table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Modal from "@/components/ui/modal";
import { UserRole, ProjectTopic, StudentProject, InsertProjectTopic, User } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertProjectTopicSchema } from "@shared/schema";
import { z } from "zod";
import { 
  Search, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  Users, 
  Award, 
  BookOpen, 
  AlertCircle, 
  Sparkles, 
  ShieldCheck, 
  Mail, 
  Building, 
  ArrowRight,
  FileText,
  GraduationCap
} from "lucide-react";
import { useCourseFilter } from "@/hooks/course-filter-context";

export type IStudentProjectWithTopic = StudentProject & {
  topic: (ProjectTopic & { submittedBy?: User }) | null;
  student: User;
  supervisor?: User;
};

/** Response shape from GET /api/projects/supervisor/my-topics */
interface ISupervisorTopicWithTeam {
  id: number;
  topic: ProjectTopic;
  isPicked: boolean;
  team?: {
    groupId: number;
    groupName: string;
    projectTeamId: string | null;
    course: string | null;
    members: { id: number; firstName: string; lastName: string; enrollmentNumber: string | null; email: string }[];
    progress: number;
  };
}

export default function Projects() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<ProjectTopic | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<IStudentProjectWithTopic | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { courseFilter, getCourseQuery } = useCourseFilter();

  // Topics catalog for coordinators and admins
  const { data: approvedTopics = [], isLoading: isLoadingTopics } = useQuery<ProjectTopic[]>({
    queryKey: [`/api/projects/approved-topics${getCourseQuery() ? `?${getCourseQuery()}` : ''}`],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/topics/approved?${getCourseQuery() ? `${getCourseQuery()}&` : ''}limit=all`);
      const data = await response.json();
      return Array.isArray(data) ? data : (data.data || data.availableTopics || []);
    },
    enabled: !!user && (user.role === UserRole.COORDINATOR || user.role === UserRole.ADMIN)
  });

  // Supervisor: fetch own submitted topics with team allotment details
  const { data: supervisorTopicsWithTeams = [], isLoading: isLoadingSupervisorTopics } = useQuery<ISupervisorTopicWithTeam[]>({
    queryKey: ["/api/projects/supervisor/my-topics"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/projects/supervisor/my-topics");
      return await response.json();
    },
    enabled: !!user && user.role === UserRole.SUPERVISOR
  });

  // Query student's selected project
  const { data: myProjects = [], isLoading: isLoadingMyProjects } = useQuery<IStudentProjectWithTopic[]>({
    queryKey: ["/api/projects/my"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/projects/my");
      const data = await response.json();
      return data;
    },
    enabled: !!user && user.role === UserRole.STUDENT
  });

  // Query student's group details to display team members & assigned supervisor
  const { data: userGroup, isLoading: isLoadingUserGroup } = useQuery<{
    id: number;
    name: string;
    description?: string;
    createdById?: number;
    members?: User[];
    supervisor?: User;
  } | null>({
    queryKey: ["/api/student-groups/my-group"],
    queryFn: async () => {
      const res = await fetch("/api/student-groups/my-group");
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error("Failed to fetch user group");
      }
      return res.json();
    },
    enabled: !!user && user.role === UserRole.STUDENT
  });
 
  // Add query for coordinator/admin to fetch all student projects
  // Supervisors now use the dedicated /api/projects/supervisor/my-topics endpoint instead
  const { data: allProjects = [], isLoading: isLoadingAllProjects } = useQuery<IStudentProjectWithTopic[]>({
    queryKey: [`/api/projects/all${getCourseQuery() ? `?${getCourseQuery()}` : ''}`],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/projects?${getCourseQuery() ? `${getCourseQuery()}&` : ''}limit=all`);
      const data = await response.json();
      return Array.isArray(data) ? data : (data.data || []);
    },
    enabled: !!user && (user.role === UserRole.COORDINATOR || user.role === UserRole.ADMIN)
  });

  // Define form schema with additional validation
  const topicFormSchema = insertProjectTopicSchema.extend({
    technology: z.string().min(1, "Technology is required"),
    submittedById: z.number(),
    estimatedComplexity: z.number().min(1, "Estimated complexity is required")
  });

  type ITopicFormValues = z.infer<typeof topicFormSchema>;

  const form = useForm<ITopicFormValues>({
    resolver: zodResolver(topicFormSchema),
    defaultValues: {
      title: "",
      description: "",
      technology: "",
      submittedById: user?.id || 0,
      estimatedComplexity: 1
    }
  });

  const submitTopicMutation = useMutation({
    mutationFn: async (data: ITopicFormValues) => {
      const res = await apiRequest("POST", "/api/topics", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Topic submitted successfully",
        description: "Your project topic has been submitted for approval.",
      });
      form.reset();
      setIsSubmitModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/topics/my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects/supervisor/my-topics"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to submit topic",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const selectTopicMutation = useMutation({
    mutationFn: async (topicId: number) => {
      // Use raw fetch to handle error body parsing ourselves
      // apiRequest's throwIfResNotOk consumes the body, preventing res.json()
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to select topic");
      }
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Topic selected successfully",
        description: "You have successfully selected this project topic.",
      });
      setIsConfirmModalOpen(false);
      setSelectedTopic(null);
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && (
            key.startsWith('/api/topics') ||
            key.startsWith('/api/projects') ||
            key.startsWith('/api/student-groups') ||
            key.startsWith('/api/stats')
          );
        },
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to select topic",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const onSubmit = (data: ITopicFormValues) => {
    console.log("Form submitted with data:", data);
    try {
      submitTopicMutation.mutate(data);
    } catch (error) {
      console.error("Error submitting topic:", error);
    }
  };

  const handleSelectTopic = (topicId: number) => {
    const topic = approvedTopics?.find(t => t.id === topicId);
    if (topic) {
      setSelectedTopic(topic);
      setIsConfirmModalOpen(true);
    }
  };

  const confirmTopicSelection = () => {
    if (selectedTopic) {
      selectTopicMutation.mutate(selectedTopic.id);
    }
  };

  const openDetailsModal = (projectId: number) => {
    const project = allProjects.find(p => p.id === projectId);
    if (project) {
      setSelectedProject(project);
      setIsDetailsModalOpen(true);
    }
  };

  const closeDetailsModal = () => {
    setIsDetailsModalOpen(false);
    setSelectedProject(null);
  };

  const filterProjects = (projects: IStudentProjectWithTopic[]) => {
    if (!searchQuery) return projects;

    const query = searchQuery.toLowerCase();
    return projects.filter(project =>
      project.topic?.title.toLowerCase().includes(query) ||
      (project.topic?.description?.toLowerCase().includes(query) || false) ||
      project.topic?.technology.toLowerCase().includes(query) ||
      project.student.firstName.toLowerCase().includes(query) ||
      project.student.lastName.toLowerCase().includes(query) ||
      project.student.email.toLowerCase().includes(query) ||
      (project.supervisor?.firstName.toLowerCase().includes(query) || false) ||
      (project.supervisor?.lastName.toLowerCase().includes(query) || false)
    );
  };

  // Filter supervisor topics by search query
  const filterSupervisorTopics = (topics: ISupervisorTopicWithTeam[]) => {
    if (!searchQuery) return topics;
    const query = searchQuery.toLowerCase();
    return topics.filter(item =>
      item.topic.title.toLowerCase().includes(query) ||
      (item.topic.description?.toLowerCase().includes(query) || false) ||
      (item.topic.technology?.toLowerCase().includes(query) || false) ||
      (item.topic.topicCode?.toLowerCase().includes(query) || false) ||
      (item.team?.groupName.toLowerCase().includes(query) || false) ||
      (item.team?.projectTeamId?.toLowerCase().includes(query) || false) ||
      (item.team?.members.some(m =>
        m.firstName.toLowerCase().includes(query) ||
        m.lastName.toLowerCase().includes(query) ||
        (m.enrollmentNumber?.toLowerCase().includes(query) || false)
      ) || false)
    );
  };

  const renderTeacherContent = () => {
    const filteredItems = filterSupervisorTopics(supervisorTopicsWithTeams);
    const pickedCount = supervisorTopicsWithTeams.filter(t => t.isPicked).length;
    const availableCount = supervisorTopicsWithTeams.filter(t => !t.isPicked).length;

    return (
      <>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">My Topics & Teams</h1>
            <p className="text-muted-foreground mt-1">Track your submitted topics and see which teams have picked them</p>
          </div>
          <Button onClick={() => setIsSubmitModalOpen(true)}>Submit New Topic</Button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="p-4 rounded-lg bg-background border shadow-xs">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-primary" />
              Total Topics
            </p>
            <p className="text-2xl font-bold text-foreground">{supervisorTopicsWithTeams.length}</p>
          </div>
          <div className="p-4 rounded-lg bg-background border shadow-xs">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
              Picked by Teams
            </p>
            <p className="text-2xl font-bold text-green-600">{pickedCount}</p>
          </div>
          <div className="p-4 rounded-lg bg-background border shadow-xs">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              Still Available
            </p>
            <p className="text-2xl font-bold text-amber-600">{availableCount}</p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search by topic title, team name, student name, enrollment..."
              className="pl-10"
              aria-label="Search topics"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {isLoadingSupervisorTopics ? (
          <div className="space-y-4">
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
          </div>
        ) : filteredItems.length === 0 ? (
          <Card className="border-dashed border-2 text-center py-16 px-6 max-w-2xl mx-auto shadow-sm">
            <CardContent className="space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                <BookOpen className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">No Topics Submitted Yet</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                {searchQuery
                  ? `No topics match "${searchQuery}". Try refining your search.`
                  : "You haven't submitted any project topics yet. Click 'Submit New Topic' to get started."
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredItems.map(item => (
              <Card key={item.id} className={`shadow-sm transition-all ${
                item.isPicked ? "border-green-500/30 bg-green-500/[0.02]" : "border-border"
              }`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      {item.topic.topicCode && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-mono font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                          {item.topic.topicCode}
                        </span>
                      )}
                      {item.topic.course && (
                        <Badge variant="outline" className="font-semibold border-primary/30 text-primary bg-primary/5">
                          {item.topic.course}
                        </Badge>
                      )}
                      {item.topic.projectType && (
                        <Badge variant="secondary" className="text-xs">
                          {item.topic.projectType}
                        </Badge>
                      )}
                    </div>
                    {item.isPicked ? (
                      <Badge className="bg-green-600 text-white gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Picked
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-amber-500/30 text-amber-600 bg-amber-500/10">
                        <Clock className="w-3 h-3 mr-1" />
                        Available
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-lg font-bold text-foreground mt-2">
                    {item.topic.title}
                  </CardTitle>
                  {item.topic.description && (
                    <CardDescription className="line-clamp-2 mt-1">
                      {item.topic.description}
                    </CardDescription>
                  )}
                </CardHeader>

                <CardContent className="pt-0">
                  {/* Topic metadata row */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      {item.topic.technology || "General"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Award className="w-3 h-3" />
                      Complexity: {item.topic.estimatedComplexity || "Medium"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(item.topic.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </span>
                  </div>

                  {/* Team details — only shown for picked topics */}
                  {item.isPicked && item.team && (
                    <div className="p-4 rounded-lg bg-muted/30 border border-border/50 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                          <Users className="w-4 h-4 text-primary" />
                          Team Details
                        </h4>
                        <div className="flex items-center gap-2">
                          {item.team.projectTeamId && (
                            <span className="text-xs font-mono font-bold px-2 py-0.5 bg-primary/10 text-primary rounded">
                              {item.team.projectTeamId}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {item.team.groupName}
                          </span>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-16 shrink-0">Progress</span>
                        <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-primary h-full rounded-full transition-all duration-500"
                            style={{ width: `${item.team.progress}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-primary w-10 text-right">{item.team.progress}%</span>
                      </div>

                      {/* Members list */}
                      {item.team.members.length > 0 ? (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Team Members</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {item.team.members.map(member => (
                              <div key={member.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-background border border-border/50">
                                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                                  {member.firstName[0]}{member.lastName[0]}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-foreground truncate">
                                    {member.firstName} {member.lastName}
                                  </p>
                                  <p className="text-[11px] text-muted-foreground truncate">
                                    {member.enrollmentNumber || member.email}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">
                          Individual assignment — no team members
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </>
    );
  };

  const renderStudentContent = () => {
    if (isLoadingMyProjects || isLoadingUserGroup) {
      return (
        <div className="space-y-6">
          <div>
            <Skeleton className="h-9 w-48 mb-2" />
            <Skeleton className="h-5 w-96" />
          </div>
          <Skeleton className="h-64 rounded-xl" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        </div>
      );
    }

    if (!myProjects || myProjects.length === 0) {
      return (
        <div className="space-y-6">
          <div className="border-b pb-4">
            <h1 className="text-3xl font-bold text-foreground tracking-tight">My Project</h1>
            <p className="text-muted-foreground mt-1">Track your project milestone progress, deliverables, and supervisor details</p>
          </div>

          <Card className="border-dashed border-2 text-center py-16 px-6 max-w-2xl mx-auto shadow-sm my-8">
            <CardContent className="space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                <BookOpen className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">No Project Selected Yet</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                You haven't selected a project topic yet. Explore the available topics in the Topics section to choose a topic for your project.
              </p>
              <div className="pt-2">
                <Link href="/student-topics">
                  <Button size="lg" className="gap-2 shadow-sm">
                    <BookOpen className="w-4 h-4" />
                    Browse Available Topics
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    const project = myProjects[0];
    if (!project.topic) {
      return (
        <div className="space-y-6">
          <div className="border-b pb-4">
            <h1 className="text-3xl font-bold text-foreground">My Project</h1>
          </div>
          <Card className="border-amber-500/30 bg-amber-500/5 text-center py-12">
            <CardContent className="space-y-3">
              <AlertCircle className="w-10 h-10 text-amber-600 mx-auto" />
              <h3 className="text-lg font-semibold text-foreground">Project Topic Pending</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Your project assignment is currently being processed. Please contact your coordinator if this issue persists.
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    // Resolve supervisor defensively from topic submitter or group assignment
    const supervisor = project.topic.submittedBy || userGroup?.supervisor;
    const supervisorName = supervisor
      ? `${supervisor.prefix ? `${supervisor.prefix} ` : ""}${supervisor.firstName} ${supervisor.lastName || ""}`.trim()
      : null;

    // Standard academic project milestone phases based on progress %
    const milestones = [
      { id: 1, title: "Topic Selection & Allotment", threshold: 0, desc: "Topic chosen and confirmed by department", completed: true },
      { id: 2, title: "Synopsis & Literature Survey", threshold: 25, desc: "Problem statement & research review", completed: project.progress >= 25 },
      { id: 3, title: "System Design & SRS", threshold: 50, desc: "Architecture diagrams & specifications", completed: project.progress >= 50 },
      { id: 4, title: "Core Implementation & Testing", threshold: 75, desc: "Coding, module testing & verification", completed: project.progress >= 75 },
      { id: 5, title: "Final Report & Viva Voce", threshold: 100, desc: "Thesis defense & final presentation", completed: project.progress >= 100 },
    ];

    return (
      <div className="space-y-8">
        {/* Page Heading */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b pb-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">My Project</h1>
            <p className="text-muted-foreground mt-1">Track your project milestone progress, deliverables, and supervisor details</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/student-groups">
              <Button variant="outline" size="sm" className="gap-2">
                <Users className="w-4 h-4" />
                View Project Team
              </Button>
            </Link>
          </div>
        </div>

        {/* Project Hero Card */}
        <Card className="border-primary/20 bg-card shadow-sm overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-primary to-primary/60" />
          <CardHeader className="space-y-3 pb-4">
            <div className="flex flex-wrap items-center gap-2">
              {project.topic.topicCode && (
                <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-mono font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                  {project.topic.topicCode}
                </span>
              )}
              {project.topic.course && (
                <Badge variant="outline" className="font-semibold border-primary/30 text-primary bg-primary/5">
                  {project.topic.course}
                </Badge>
              )}
              {project.topic.projectType && (
                <Badge variant="secondary" className="text-xs">
                  {project.topic.projectType}
                </Badge>
              )}
              <Badge className={project.progress === 100 ? "bg-green-600 text-white" : "bg-primary text-primary-foreground"}>
                {project.progress === 100 ? "Completed" : "In Progress"}
              </Badge>
            </div>
            <CardTitle className="text-2xl md:text-3xl font-bold text-foreground leading-tight">
              {project.topic.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Project Overview & Scope
              </h3>
              <p className="text-sm md:text-base text-foreground/90 leading-relaxed whitespace-pre-line bg-muted/30 p-4 rounded-lg border border-border/50">
                {project.topic.description}
              </p>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
              <div className="p-3.5 rounded-lg bg-background border shadow-xs">
                <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  Technology Stack
                </p>
                <p className="font-semibold text-sm line-clamp-1">{project.topic.technology || "General"}</p>
              </div>

              <div className="p-3.5 rounded-lg bg-background border shadow-xs">
                <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
                  <Calendar className="w-3.5 h-3.5 text-primary" />
                  Selected Date
                </p>
                <p className="font-semibold text-sm">{new Date(project.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</p>
              </div>

              <div className="p-3.5 rounded-lg bg-background border shadow-xs">
                <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
                  <Award className="w-3.5 h-3.5 text-primary" />
                  Complexity
                </p>
                <p className="font-semibold text-sm">{project.topic.estimatedComplexity || "Standard"}</p>
              </div>

              <div className="p-3.5 rounded-lg bg-background border shadow-xs">
                <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  Overall Progress
                </p>
                <p className="font-semibold text-sm text-primary">{project.progress}% Complete</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Milestone Tracker Section */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                  Academic Milestone Tracker
                </CardTitle>
                <CardDescription>Continuous assessment phases toward project viva and completion</CardDescription>
              </div>
              <span className="text-sm font-bold text-primary px-3 py-1 bg-primary/10 rounded-full">
                {project.progress}%
              </span>
            </div>
            {/* Visual Progress Bar */}
            <div className="w-full bg-muted rounded-full h-3 mt-3 overflow-hidden">
              <div
                className="bg-primary h-full rounded-full transition-all duration-500"
                style={{ width: `${project.progress}%` }}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-2">
              {milestones.map((m) => (
                <div
                  key={m.id}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    m.completed
                      ? "bg-primary/5 border-primary/30 shadow-2xs"
                      : "bg-muted/20 border-border opacity-75"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-mono font-bold text-muted-foreground">Phase {m.id}</span>
                    {m.completed ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                    ) : (
                      <Clock className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  <p className="font-semibold text-xs leading-snug text-foreground">{m.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{m.desc}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Two Columns: Supervisor & Team Details */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Supervisor Card */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" />
                Assigned Supervisor
              </CardTitle>
              <CardDescription>Academic mentor guiding this project</CardDescription>
            </CardHeader>
            <CardContent>
              {supervisor ? (
                <div className="flex items-start gap-4 p-4 rounded-lg bg-primary/5 border border-primary/15">
                  <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <span className="text-primary font-bold text-base">
                      {supervisor.firstName?.[0] || ""}{supervisor.lastName?.[0] || ""}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-base text-foreground">{supervisorName}</p>
                    {supervisor.department && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Building className="w-3 h-3 text-muted-foreground" />
                        {supervisor.department}
                      </p>
                    )}
                    {supervisor.email && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Mail className="w-3 h-3 text-muted-foreground" />
                        {supervisor.email}
                      </p>
                    )}
                    <Badge variant="outline" className="mt-2 text-xs border-green-500/30 text-green-600 bg-green-500/10">
                      Active Supervisor
                    </Badge>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-lg border border-dashed text-center space-y-2 bg-muted/20">
                  <Badge variant="outline" className="border-amber-500/30 text-amber-600 bg-amber-500/10">
                    Not Assigned
                  </Badge>
                  <p className="text-xs text-muted-foreground">
                    A supervisor will be assigned by the coordinator or automatically mapped to your selected topic.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Project Team Card */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                Project Team & Members
              </CardTitle>
              <CardDescription>
                {userGroup ? userGroup.name : "Individual Project"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {userGroup && userGroup.members && userGroup.members.length > 0 ? (
                <div className="space-y-2.5">
                  {userGroup.members.map((member: User) => (
                    <div key={member.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border/50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                          {member.firstName?.[0]}{member.lastName?.[0]}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-foreground">
                            {member.firstName} {member.lastName}
                          </p>
                          <p className="text-[11px] text-muted-foreground">{member.enrollmentNumber || member.email}</p>
                        </div>
                      </div>
                      {member.id === (userGroup as any).createdById && (
                        <Badge variant="secondary" className="text-[10px]">Team Creator</Badge>
                      )}
                    </div>
                  ))}
                  <div className="pt-1 text-right">
                    <Link href="/student-groups">
                      <Button variant="ghost" size="sm" className="text-xs text-primary gap-1">
                        Manage Team in Project Teams
                        <ArrowRight className="w-3 h-3" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-lg border border-dashed text-center space-y-2 bg-muted/20">
                  <p className="text-xs text-muted-foreground">
                    You are registered as an individual student. To collaborate with peers, form or join a team in Project Teams.
                  </p>
                  <Link href="/student-groups">
                    <Button variant="outline" size="sm" className="text-xs">
                      Go to Project Teams
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  const renderCoordinatorContent = () => {
    const filteredProjects = filterProjects(allProjects);

    return (
      <>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-1">All Projects</h1>
            <p className="text-muted-foreground">Overview of all student projects</p>
          </div>
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search projects by title, student, supervisor, technology..."
              className="pl-10"
              aria-label="Search projects"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {isLoadingAllProjects ? (
          <div className="space-y-4">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        ) : (
          <ProjectTable
            projects={filteredProjects}
            onViewDetails={openDetailsModal}
          />
        )}
      </>
    );
  };

  const filterTopics = (topics: ProjectTopic[]) => {
    if (!searchQuery) return topics;
    const query = searchQuery.toLowerCase();
    return topics.filter(t =>
      t.title.toLowerCase().includes(query) ||
      (t.description?.toLowerCase().includes(query) || false) ||
      (t.technology?.toLowerCase().includes(query) || false) ||
      (t.topicCode?.toLowerCase().includes(query) || false) ||
      (t.projectType?.toLowerCase().includes(query) || false) ||
      ((t.submittedBy as any)?.firstName?.toLowerCase().includes(query) || false) ||
      ((t.submittedBy as any)?.lastName?.toLowerCase().includes(query) || false)
    );
  };

  const filteredTopics = filterTopics(approvedTopics);

  const renderSubmitTopicModal = () => (
    <Modal
      isOpen={isSubmitModalOpen}
      onClose={() => setIsSubmitModalOpen(false)}
      title="Submit New Project Topic"
      description="Propose a new topic for students to work on"
    >
      <div className="bg-background/95 backdrop-blur-sm rounded-lg">
        <Form {...form}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              console.log("Form submit event triggered");
              const values = form.getValues();
              console.log("Form values:", values);
              submitTopicMutation.mutate(values);
            }}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Topic Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter the project topic title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Provide a detailed description of the project topic"
                      rows={4}
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="technology"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Technology</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter technology" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="estimatedComplexity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estimated Complexity (1-5)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={5}
                      placeholder="Enter complexity (1-5)"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsSubmitModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitTopicMutation.isPending}
              >
                {submitTopicMutation.isPending ? "Submitting..." : "Submit Topic"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </Modal>
  );

  // In Student accounts, the project section exclusively displays their selected project progress and detail.
  // Topic selection and catalog browsing is located in the dedicated Topics section (/student-topics).
  if (user?.role === UserRole.STUDENT) {
    return (
      <MainLayout>
        {renderStudentContent()}
      </MainLayout>
    );
  }

  // In Supervisor accounts, exclusively display "My Topics & Teams".
  // The general project topics catalog is completely removed from the supervisor project page.
  if (user?.role === UserRole.SUPERVISOR) {
    return (
      <MainLayout>
        {renderTeacherContent()}
        {renderSubmitTopicModal()}
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Project Hub</h1>
          <p className="text-muted-foreground mt-1">Explore approved project topics and monitor student project teams</p>
        </div>
      </div>

      <Tabs defaultValue="projects" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="topics" className="flex items-center gap-2">
            <span>Project Topics</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
              {filteredTopics.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="projects" className="flex items-center gap-2">
            <span>Student Projects</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
              {allProjects.length}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="topics" className="space-y-6">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search topics by title, PUGID code, technology, supervisor..."
                className="pl-10 w-full"
                aria-label="Search topics"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {isLoadingTopics ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array(6).fill(0).map((_, i) => (
                <Skeleton key={i} className="h-64 rounded-xl" />
              ))}
            </div>
          ) : filteredTopics.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTopics.map((topic) => (
                <TopicCard
                  key={topic.id}
                  topic={topic}
                  onSelect={handleSelectTopic}
                  isStudent={user?.role === UserRole.STUDENT}
                  isCoordinator={user?.role === UserRole.COORDINATOR || user?.role === UserRole.ADMIN}
                  hideSupervisor={user?.role === UserRole.STUDENT}
                />
              ))}
            </div>
          ) : (
            <Card className="text-center py-12">
              <CardContent>
                <p className="text-lg font-medium text-foreground mb-1">No topics found</p>
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? "Try refining your search query." : "No approved project topics found for the selected course."}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="projects">
          {renderCoordinatorContent()}
        </TabsContent>
      </Tabs>

      {renderSubmitTopicModal()}

      {/* Confirm Topic Selection Modal */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => {
          setIsConfirmModalOpen(false);
          setSelectedTopic(null);
        }}
        title="Confirm Topic Selection"
      >
        <div className="bg-background/95 backdrop-blur-sm rounded-lg">
          {selectedTopic && (
            <>
              <div className="mb-4">
                <h4 className="font-medium mb-2">{selectedTopic.title}</h4>
                <p className="text-sm text-muted-foreground">{selectedTopic.description}</p>
              </div>

              <div className="mb-4">
                <p className="text-sm text-muted-foreground mb-1">
                  Are you sure you want to select this topic? This action cannot be undone.
                </p>
                <p className="text-sm font-medium">
                  You can only select one project topic per semester.
                </p>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsConfirmModalOpen(false);
                    setSelectedTopic(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmTopicSelection}
                  disabled={selectTopicMutation.isPending}
                >
                  {selectTopicMutation.isPending ? "Selecting..." : "Confirm Selection"}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Project Details Modal */}
      {isDetailsModalOpen && selectedProject && (
        <Modal
          isOpen={isDetailsModalOpen}
          onClose={closeDetailsModal}
          title="Project Details"
          description="Detailed information about the selected project"
        >
          <div className="bg-background/95 backdrop-blur-sm rounded-lg">
            <div className="space-y-6">
              <div className="space-y-2 bg-card/50 p-4 rounded-lg backdrop-blur-sm">
                <h3 className="text-lg font-semibold">{selectedProject.topic?.title || 'Unknown Topic'}</h3>
                <p className="text-sm text-muted-foreground">{selectedProject.topic?.description || 'No description available'}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-card/50 p-3 rounded-lg backdrop-blur-sm">
                  <p className="text-sm font-medium">Student</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedProject.student ? `${selectedProject.student.firstName} ${selectedProject.student.lastName}` : 'Unknown Student'}
                  </p>
                </div>
                <div className="bg-card/50 p-3 rounded-lg backdrop-blur-sm">
                  <p className="text-sm font-medium">Start Date</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(selectedProject.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="bg-card/50 p-3 rounded-lg backdrop-blur-sm">
                  <p className="text-sm font-medium">Technology</p>
                  <p className="text-sm text-muted-foreground">{selectedProject.topic?.technology || 'Unknown'}</p>
                </div>
              </div>

              <div className="bg-card/50 p-4 rounded-lg backdrop-blur-sm">
                <p className="text-sm font-medium mb-2">Overall Progress</p>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="w-full bg-muted/50 rounded-full h-2">
                      <div
                        className="bg-primary/80 rounded-full h-2"
                        style={{ width: `${selectedProject.progress}%` }}
                      ></div>
                    </div>
                  </div>
                  <span className="text-sm font-medium">{selectedProject.progress}%</span>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={closeDetailsModal}>Close</Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </MainLayout>
  );
}
