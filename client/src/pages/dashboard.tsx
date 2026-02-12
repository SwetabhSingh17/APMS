import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { FileText, CheckCircle, Clock, AlertTriangle, CheckSquare, Users, Bell, AlertCircle, Download, Trash2, Database } from "lucide-react";
import MainLayout from "@/components/layout/main-layout";
import StatsCard from "@/components/dashboard/stats-card";
import ProgressBar from "@/components/dashboard/progress-bar";
import ActivityItem from "@/components/dashboard/activity-item";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { UserRole, ProjectTopic, User } from "@shared/schema";
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
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedTopic, setSelectedTopic] = useState<PendingTopic | null>(null);
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
  const [feedback, setFeedback] = useState("");



  const { data: stats, isLoading: isLoadingStats } = useQuery<DashboardStats>({
    queryKey: ["/api/stats"],
    enabled: !!user,
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  const { data: pendingTopics = [], isLoading: isLoadingTopics } = useQuery<PendingTopic[]>({
    queryKey: ["/api/topics/pending"],
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
    enabled: !!user && user.role === UserRole.STUDENT
  });

  const renderContent = () => {
    if (!user) return null;

    if (user.role === UserRole.STUDENT) {
      const project = myProjects[0];

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
                    <CardTitle className="text-xl text-primary">{project.topic?.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground mb-4">{project.topic?.description}</p>
                    <div className="flex gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <span>Status: {project.status}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        <span>{project.topic?.technology}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Faculty Mentor</CardTitle>
                  </CardHeader>
                  <CardContent className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                      {project.topic?.submittedBy?.firstName?.[0]}{project.topic?.submittedBy?.lastName?.[0]}
                    </div>
                    <div>
                      <p className="font-semibold">{project.topic?.submittedBy?.firstName} {project.topic?.submittedBy?.lastName}</p>
                      {/* <p className="text-sm text-muted-foreground">{project.topic?.submittedBy?.department}</p> */}
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="col-span-full p-8 text-center border-dashed">
                <div className="flex flex-col items-center gap-3">
                  <AlertTriangle className="w-10 h-10 text-yellow-500" />
                  <h3 className="text-lg font-semibold">No Project Selected</h3>
                  <p className="text-muted-foreground">You haven't selected a project topic yet.</p>
                  <Link href="/topics">
                    <Button>Browse Topics</Button>
                  </Link>
                </div>
              </Card>
            )}
          </div>
        </>
      );
    }

    // Admin/Coordinator/Teacher View
    return (
      <>
        {/* Welcome Section */}
        <div className="mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-1">Welcome back, {user.firstName}!</h1>
              <p className="text-muted-foreground">Here's what's happening with projects today.</p>
            </div>
            {user.role === UserRole.TEACHER && (
              <Button onClick={() => {
                // Use the same state as in Topics page
                window.location.href = '/topics?action=submit';
              }}>
                Submit New Topic
              </Button>
            )}
          </div>
        </div>

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
              />
              <StatsCard
                title="Approved Topics"
                value={stats?.approvedTopics || 0}
                icon={<CheckCircle className="w-6 h-6 text-secondary" />}
                iconBgColor="bg-secondary/10"
                borderColor="secondary"
                change={{ value: `${stats?.pendingTopics || 0}`, label: "pending approval", positive: false }}
              />
              <StatsCard
                title="Average Progress"
                value={`${stats?.avgProgress || 0}%`}
                icon={<Clock className="w-6 h-6 text-accent" />}
                iconBgColor="bg-accent/10"
                borderColor="accent"
                change={{ value: "Overall", label: "project completion", positive: true }}
              />
              <StatsCard
                title="Unassigned Students"
                value={stats?.unassignedStudents || 0}
                icon={<AlertTriangle className="w-6 h-6 text-destructive" />}
                iconBgColor="bg-destructive/10"
                borderColor="destructive"
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
                <div className="space-y-4">
                  <ProgressBar
                    label="Topic Selection Phase"
                    percentage={stats?.projectPhases?.topicSelection || 0}
                    color="bg-secondary"
                  />
                  <ProgressBar
                    label="Research & Planning"
                    percentage={stats?.projectPhases?.research || 0}
                    color="bg-primary"
                  />
                  <ProgressBar
                    label="Implementation"
                    percentage={stats?.projectPhases?.implementation || 0}
                    color="bg-accent"
                  />
                  <ProgressBar
                    label="Testing & Documentation"
                    percentage={stats?.projectPhases?.testing || 0}
                    color="bg-destructive"
                  />
                </div>



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
              <div className="space-y-4">
                <ProgressBar
                  label="Topic Selection Phase"
                  percentage={stats?.projectPhases?.topicSelection || 0}
                  color="bg-secondary"
                />
                <ProgressBar
                  label="Research & Planning"
                  percentage={stats?.projectPhases?.research || 0}
                  color="bg-primary"
                />
                <ProgressBar
                  label="Implementation"
                  percentage={stats?.projectPhases?.implementation || 0}
                  color="bg-accent"
                />
                <ProgressBar
                  label="Testing & Documentation"
                  percentage={stats?.projectPhases?.testing || 0}
                  color="bg-destructive"
                />
              </div>


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
