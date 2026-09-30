import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { FileText, CheckCircle, Clock, AlertTriangle, CheckSquare, Users, Bell, AlertCircle, Download, Trash2, Database } from "lucide-react";
import MainLayout from "@/components/layout/main-layout";
import StatsCard from "@/components/dashboard/stats-card";
import Progress3D from "@/components/dashboard/progress-3d";
import ActivityItem from "@/components/dashboard/activity-item";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useLocation } from "wouter";
import { UserRole, ProjectTopic, User, IEnrollmentConflict } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { useCourseFilter } from "@/hooks/course-filter-context";
import { useState } from "react";
import Modal from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

interface DashboardStats {
  totalProjects: number;
  approvedTopics: number;
  pendingTopics: number;
  unassignedStudents: number;
  avgProgress: number;
  projectPhases: {
    topicSelection: number;
    research: number;
    implementation: number;
    testing: number;
  };
  departmentStats: Record<string, {
    progress: number;
    studentCount: number;
    projectCount: number;
  }>;
}

interface PendingTopic extends ProjectTopic {
  submittedBy?: User;
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedTopic, setSelectedTopic] = useState<PendingTopic | null>(null);
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
  const [feedback, setFeedback] = useState("");

  // State for enrollment conflict resolution
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  const [resolvingStudentId, setResolvingStudentId] = useState<number | null>(null);
  const [newEnrollmentInputs, setNewEnrollmentInputs] = useState<Record<number, string>>({});

  const { courseFilter, getCourseQuery } = useCourseFilter();

  const { data: stats, isLoading: isLoadingStats } = useQuery<DashboardStats>({
    queryKey: [`/api/stats${getCourseQuery() ? `?${getCourseQuery()}` : ''}`],
    enabled: !!user,
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Query for student enrollment conflicts (Admin and Coordinator only)
  const { data: conflictData } = useQuery<{ conflicts: IEnrollmentConflict[], count: number }>({
    queryKey: ["/api/admin/enrollment-conflicts"],
    enabled: !!user && (user.role === UserRole.COORDINATOR || user.role === UserRole.ADMIN),
    refetchInterval: 15000 // Refresh every 15 seconds
  });
  const conflicts = conflictData?.conflicts || [];

  const resolveConflictMutation = useMutation({
    mutationFn: async ({ userId, newEnrollmentNumber }: { userId: number, newEnrollmentNumber: string }) => {
      const res = await apiRequest("POST", "/api/admin/resolve-enrollment-conflict", {
        userId,
        newEnrollmentNumber
      });
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Conflict Resolved",
        description: data.message || "Enrollment number updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/enrollment-conflicts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setResolvingStudentId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to resolve conflict",
        description: error.message,
        variant: "destructive",
      });
      setResolvingStudentId(null);
    }
  });

  const { data: pendingTopics = [], isLoading: isLoadingTopics } = useQuery<PendingTopic[]>({
    queryKey: [`/api/topics/pending${getCourseQuery() ? `?${getCourseQuery()}` : ''}`],
    enabled: !!user && (user.role === UserRole.COORDINATOR || user.role === UserRole.ADMIN)
  });

  const { data: activities, isLoading: isLoadingActivities } = useQuery({
    queryKey: ["/api/activities"],
    enabled: !!user
  });

  const handleTopicAction = async (topicId: number, action: 'approve' | 'reject') => {
    try {
      await apiRequest("POST", `/api/topics/${topicId}/${action}`, { feedback });
      toast({
        title: `Topic ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
        description: `The project topic has been ${action === 'approve' ? 'approved' : 'rejected'}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/topics/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setIsTopicModalOpen(false);
      setSelectedTopic(null);
      setFeedback("");
    } catch (error) {
      toast({
        title: `Failed to ${action} topic`,
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    }
  };

  const openTopicModal = (topic: PendingTopic) => {
    setSelectedTopic(topic);
    setIsTopicModalOpen(true);
  };




  const { data: myProjects = [], isLoading: isLoadingMyProjects } = useQuery<any[]>({
    queryKey: ["/api/projects/my"],
    enabled: !!user && user.role === UserRole.STUDENT,
    refetchOnWindowFocus: true,
    staleTime: 2000,
  });

  const { data: userGroup } = useQuery<any>({
    queryKey: ["/api/student-groups/my-group"],
    enabled: !!user && user.role === UserRole.STUDENT,
    refetchOnWindowFocus: true,
    staleTime: 2000,
  });

  const renderContent = () => {
    if (!user) return null;

    if (user.role === UserRole.STUDENT) {
      const project = myProjects[0];
      const supervisor = project?.supervisor || userGroup?.supervisor || project?.topic?.submittedBy;

      return (
        <>
          {/* Welcome Section */}
          <div className="mb-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-foreground mb-1">Welcome back, {user.firstName}!</h1>
                <p className="text-muted-foreground">Here's your project overview.</p>
              </div>
            </div>
          </div>

          {/* Student Specific Dashboard */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
            {isLoadingMyProjects ? (
              <Skeleton className="h-40 w-full" />
            ) : project ? (
              <>
                <Card className="col-span-1 md:col-span-2 bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
                  <CardHeader>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {project.topic?.topicCode && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                          {project.topic.topicCode}
                        </span>
                      )}
                      {project.topic?.course && (
                        <Badge variant="outline" className="text-xs font-semibold border-primary/30 text-primary bg-primary/5">
                          {project.topic.course}
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-xl text-primary">{project.topic?.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground mb-4 line-clamp-3">{project.topic?.description}</p>
                    <div className="flex flex-wrap gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <span>Status: <span className="capitalize">{project.status?.replace('_', ' ')}</span></span>
                      </div>
                      {project.topic?.technology && (
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          <span>{project.topic.technology}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Supervisor</CardTitle>
                  </CardHeader>
                  <CardContent className="flex items-center gap-4">
                    {supervisor ? (
                      <>
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0">
                          {supervisor.firstName?.[0]}{supervisor.lastName?.[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate">
                            {supervisor.prefix ? `${supervisor.prefix} ` : ""}{supervisor.firstName} {supervisor.lastName}
                          </p>
                          {supervisor.department && (
                            <p className="text-xs text-muted-foreground truncate">{supervisor.department}</p>
                          )}
                          {supervisor.email && (
                            <p className="text-xs text-muted-foreground truncate">{supervisor.email}</p>
                          )}
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No supervisor assigned</p>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="col-span-full p-8 text-center border-dashed">
                <div className="flex flex-col items-center gap-3">
                  <AlertTriangle className="w-10 h-10 text-yellow-500" />
                  <h3 className="text-lg font-semibold">No Project Selected</h3>
                  <p className="text-muted-foreground">You haven't selected a project topic yet.</p>
                  <Link href="/student-topics">
                    <Button>Browse Topics</Button>
                  </Link>
                </div>
              </Card>
            )}
          </div>
        </>
      );
    }

    // Admin/Coordinator/Supervisor View
    return (
      <>
        {/* Welcome Section */}
        <div className="mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-1">Welcome back, {user.firstName}!</h1>
              <p className="text-muted-foreground">Here's what's happening with projects today.</p>
            </div>
            {user.role === UserRole.SUPERVISOR && (
              <Button onClick={() => {
                // Use the same state as in Topics page
                window.location.href = '/topics?action=submit';
              }}>
                Submit New Topic
              </Button>
            )}
          </div>
        </div>

        {/* Enrollment Conflict Alert Banner for Admin and Coordinator */}
        {(user.role === UserRole.COORDINATOR || user.role === UserRole.ADMIN) && conflicts.length > 0 && (
          <Card className="mb-6 border-2 border-amber-500/60 bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-orange-500/15 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                    <AlertTriangle className="h-5 w-5 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg font-bold text-amber-900 dark:text-amber-300">
                        Enrolment Conflict Detected
                      </CardTitle>
                      <span className="bg-destructive text-destructive-foreground text-xs font-bold px-2 py-0.5 rounded-full">
                        {conflicts.length} {conflicts.length === 1 ? "Conflict" : "Conflicts"}
                      </span>
                    </div>
                    <CardDescription className="text-amber-800/90 dark:text-amber-400/90 mt-0.5">
                      The system detected multiple students sharing the same enrolment number. Please resolve the conflict by changing their enrolment number.
                    </CardDescription>
                  </div>
                </div>
                <Button
                  variant="destructive"
                  className="shrink-0 font-semibold shadow-sm"
                  onClick={() => setIsConflictModalOpen(true)}
                >
                  <AlertCircle className="w-4 h-4 mr-2" />
                  Resolve Enrolment Conflict
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="bg-background/80 dark:bg-background/40 backdrop-blur rounded-lg p-3 border border-amber-500/20 divide-y divide-border">
                {conflicts.map((conflict) => (
                  <div key={conflict.enrollmentNumber} className="py-2.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-semibold bg-muted px-2 py-0.5 rounded text-xs border border-border">
                        {conflict.enrollmentNumber}
                      </span>
                      <span className="text-muted-foreground text-xs">shared by:</span>
                      <span className="font-medium text-foreground text-xs">
                        {conflict.students.map(s => `${s.firstName} ${s.lastName} (${s.projectTeamId ? `Team ${s.projectTeamId}` : (s.groupName || 'No Team')})`).join(" & ")}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 self-start sm:self-auto border-amber-500/40 hover:bg-amber-500/10 text-amber-700 dark:text-amber-300"
                      onClick={() => setIsConflictModalOpen(true)}
                    >
                      Change Enrolment
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {isLoadingStats ? (
            Array(4).fill(0).map((_, i) => (
              <Card key={i} className="p-4">
                <Skeleton className="h-5 w-28 mb-2" />
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-4 w-32" />
              </Card>
            ))
          ) : (
            <>
              <StatsCard
                title="Total Projects"
                value={stats?.totalProjects || 0}
                icon={<FileText className="w-6 h-6 text-primary" />}
                iconBgColor="bg-primary/10"
                borderColor="primary"
                change={{ value: `${stats?.totalProjects || 0}`, label: "active projects", positive: true }}
                onClick={() => setLocation("/projects")}
              />
              <StatsCard
                title="Approved Topics"
                value={stats?.approvedTopics || 0}
                icon={<CheckCircle className="w-6 h-6 text-secondary" />}
                iconBgColor="bg-secondary/10"
                borderColor="secondary"
                change={{ value: `${stats?.pendingTopics || 0}`, label: "pending approval", positive: false }}
                onClick={() => setLocation(user?.role === UserRole.STUDENT ? "/student-topics" : user?.role === UserRole.SUPERVISOR ? "/topics" : "/approve-topics")}
              />
              <StatsCard
                title="Average Progress"
                value={`${stats?.avgProgress || 0}%`}
                icon={<Clock className="w-6 h-6 text-accent" />}
                iconBgColor="bg-accent/10"
                borderColor="accent"
                change={{ value: "Overall", label: "project completion", positive: true }}
                onClick={() => setLocation("/track-progress")}
              />
              <StatsCard
                title="Unassigned Students"
                value={stats?.unassignedStudents || 0}
                icon={<AlertTriangle className="w-6 h-6 text-destructive" />}
                iconBgColor="bg-destructive/10"
                borderColor="destructive"
                onClick={() => setLocation("/user-management")}
                change={{ value: "Action required", label: "", positive: false }}
              />
            </>
          )}
        </div>

        {/* Main Content Tabs */}
        {(user.role === UserRole.COORDINATOR || user.role === UserRole.ADMIN) && (
          <Card className="mb-6">
            <Tabs defaultValue="pendingApprovals">
              <div className="border-b border-border">
                <TabsList className="mx-4 my-1">
                  <TabsTrigger value="pendingApprovals">Pending Approvals</TabsTrigger>
                  <TabsTrigger value="projectProgress">Project Progress</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="pendingApprovals" className="p-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Pending Topics</h3>
                </div>
                {isLoadingTopics ? (
                  <div className="space-y-4">
                    {Array(3).fill(0).map((_, i) => (
                      <div key={i} className="flex justify-between items-center">
                        <div className="space-y-2">
                          <Skeleton className="h-5 w-48" />
                          <Skeleton className="h-4 w-96" />
                        </div>
                        <Skeleton className="h-10 w-24" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Topic</TableHead>
                          <TableHead>Course</TableHead>
                          <TableHead>Submitted By</TableHead>

                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingTopics.length > 0 ? (
                          pendingTopics.map((topic: PendingTopic) => (
                            <TableRow key={topic.id} className="hover:bg-muted/50">
                              <TableCell>
                                <div>
                                  <p className="font-medium text-foreground">{topic.title}</p>
                                  <p className="text-sm text-muted-foreground">{(topic.description || "").substring(0, 60)}...</p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className="px-2 py-1 bg-accent/10 text-accent text-xs rounded-full border border-accent/20">
                                  {topic.course}
                                </span>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center space-x-2">
                                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                    <span className="text-primary font-medium text-sm">
                                      {topic.submittedBy?.firstName?.charAt(0) || ""}
                                      {topic.submittedBy?.lastName?.charAt(0) || ""}
                                    </span>
                                  </div>
                                  <span>{topic.submittedBy?.firstName} {topic.submittedBy?.lastName}</span>
                                </div>
                              </TableCell>

                              <TableCell className="text-muted-foreground">
                                {new Date(topic.createdAt).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex space-x-2 justify-end">
                                  <Button
                                    variant="default"
                                    size="sm"
                                    className="bg-secondary hover:bg-secondary/90"
                                    onClick={() => openTopicModal(topic)}
                                  >
                                    Review
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                              No pending topics to approve
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {pendingTopics.length > 3 && (
                  <div className="mt-4 text-center">
                    <Link href="/approve-topics">
                      <Button variant="link">View all pending approvals</Button>
                    </Link>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="projectProgress" className="p-4">
                  <Progress3D stats={stats?.projectPhases as any} />



                <div className="mt-4 text-center">
                  <Link href="/track-progress">
                    <Button variant="link">View detailed progress</Button>
                  </Link>
                </div>
              </TabsContent>


            </Tabs>
          </Card >
        )}


        {/* Two-column layout for bottom section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Project Status Overview - Existing code remains... */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-lg font-semibold">Project Status Overview</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
                <Progress3D stats={stats?.projectPhases as any} />


            </CardContent>
          </Card>
        </div>
      </>
    );
  };

  return (
    <MainLayout>
      {renderContent()}

      {/* Review Topic Modal */}
      {selectedTopic && (
        <Modal
          isOpen={isTopicModalOpen}
          onClose={() => {
            setIsTopicModalOpen(false);
            setSelectedTopic(null);
            setFeedback("");
          }}
          title="Review Project Topic"
        >
          <div className="mb-4">
            <h4 className="font-medium mb-2">{selectedTopic.title}</h4>
            <p className="text-sm text-muted-foreground">{selectedTopic.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-sm text-muted-foreground">Submitted By</p>
              <p className="font-medium">
                {selectedTopic.submittedBy?.firstName} {selectedTopic.submittedBy?.lastName}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Department</p>
              <p className="font-medium">General</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Date Submitted</p>
              <p className="font-medium">
                {new Date(selectedTopic.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Estimated Complexity</p>
              <p className="font-medium">{selectedTopic.estimatedComplexity}</p>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Feedback (optional)</label>
            <Textarea
              rows={3}
              className="w-full text-sm"
              placeholder="Add any feedback or suggestions..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
            />
          </div>

          <div className="flex space-x-3 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setIsTopicModalOpen(false);
                setSelectedTopic(null);
                setFeedback("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleTopicAction(selectedTopic.id, 'reject')}
            >
              Reject Topic
            </Button>
            <Button
              variant="default"
              className="bg-secondary hover:bg-secondary/90"
              onClick={() => handleTopicAction(selectedTopic.id, 'approve')}
            >
              Approve Topic
            </Button>
          </div>
        </Modal>
      )}

      {/* Enrollment Conflict Resolution Dialog */}
      <Dialog open={isConflictModalOpen} onOpenChange={setIsConflictModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
              <DialogTitle>Resolve Enrolment Conflict</DialogTitle>
            </div>
            <DialogDescription>
              Multiple students are currently assigned the same enrolment number. Update the enrolment number for the student(s) to resolve the conflict. Their username and login credentials will automatically update.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-2">
            {conflicts.map((conflict, idx) => (
              <Card key={conflict.enrollmentNumber} className="border border-border shadow-none">
                <CardHeader className="bg-muted/40 py-2.5 px-4 border-b border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Conflict #{idx + 1}
                    </span>
                    <span className="font-mono text-xs font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 px-2 py-0.5 rounded">
                      Enrolment: {conflict.enrollmentNumber} ({conflict.count} Students)
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="p-3 space-y-3">
                  {conflict.students.map((student) => (
                    <div key={student.id} className="p-3 rounded-lg border border-border/70 bg-card/60 space-y-2.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-sm">
                        <div>
                          <span className="font-semibold text-foreground">{student.firstName} {student.lastName}</span>
                          <span className="text-xs text-muted-foreground ml-2">({student.course || "BCA"})</span>
                          <p className="text-xs text-muted-foreground font-mono">{student.email}</p>
                        </div>
                        <div className="text-right">
                          <span className="inline-block text-xs font-medium px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                            {student.projectTeamId ? `Team ${student.projectTeamId}` : (student.groupName || "No Team Assigned")}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <Input
                          placeholder={`Enter new enrolment for ${student.firstName}`}
                          value={newEnrollmentInputs[student.id] ?? ""}
                          onChange={(e) => setNewEnrollmentInputs(prev => ({ ...prev, [student.id]: e.target.value }))}
                          className="font-mono text-sm h-8"
                        />
                        <Button
                          size="sm"
                          className="h-8 text-xs shrink-0"
                          disabled={
                            (resolveConflictMutation.isPending && resolvingStudentId === student.id) ||
                            !newEnrollmentInputs[student.id]?.trim() ||
                            newEnrollmentInputs[student.id]?.trim() === student.enrollmentNumber
                          }
                          onClick={() => {
                            const val = newEnrollmentInputs[student.id]?.trim();
                            if (!val) return;
                            setResolvingStudentId(student.id);
                            resolveConflictMutation.mutate({
                              userId: student.id,
                              newEnrollmentNumber: val
                            });
                          }}
                        >
                          {resolveConflictMutation.isPending && resolvingStudentId === student.id ? "Updating..." : "Update Enrolment"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setIsConflictModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}

// Helper functions for activity icons
function getActivityIcon(type: string) {
  switch (type) {
    case 'topic_submitted':
      return <CheckSquare className="w-5 h-5 text-primary" />;
    case 'topic_selected':
      return <Users className="w-5 h-5 text-secondary" />;
    case 'deadline':
      return <Bell className="w-5 h-5 text-accent" />;
    case 'warning':
      return <AlertCircle className="w-5 h-5 text-destructive" />;
    default:
      return <Bell className="w-5 h-5 text-muted-foreground" />;
  }
}

function getActivityIconBgColor(type: string) {
  switch (type) {
    case 'topic_submitted':
      return 'bg-primary/10';
    case 'topic_selected':
      return 'bg-secondary/10';
    case 'deadline':
      return 'bg-accent/10';
    case 'warning':
      return 'bg-destructive/10';
    default:
      return 'bg-muted';
  }
}
