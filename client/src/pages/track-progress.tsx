import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ProgressBar from "@/components/dashboard/progress-bar";
import { Search, FileText, FileDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserRole, ProjectMilestone, StudentProject, ProjectTopic, User } from "@shared/schema";
import Modal from "@/components/ui/modal";
import axios, { AxiosResponse } from "axios";
import * as XLSX from 'xlsx';
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ProjectWithMilestones extends StudentProject {
  topic: ProjectTopic;
  student: User;
  milestones: ProjectMilestone[];
}

export default function TrackProgress() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");

  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectWithMilestones | null>(null);

  const { data: projects, isLoading } = useQuery<ProjectWithMilestones[]>({
    queryKey: ['/api/projects'],
    enabled: !!user && (user.role === UserRole.COORDINATOR || user.role === UserRole.ADMIN),
    queryFn: async () => {
      const res: AxiosResponse<ProjectWithMilestones[]> = await axios.get('/api/projects');
      return res.data;
    }
  });

  const { data: stats, isLoading: isLoadingStats } = useQuery<any>({
    queryKey: ["/api/stats"],
    enabled: !!user
  });

  // Excel Export Mutation
  const exportExcelMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/export-excel", {});
      if (!res.ok) throw new Error("Excel export failed");
      return res.json();
    },
    onSuccess: (result) => {
      // Create worksheet from data
      const ws = XLSX.utils.json_to_sheet(result.data);
      // Create workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Projects Report");
      // Generate Excel file and download
      XLSX.writeFile(wb, `project-report-${new Date().toISOString().split('T')[0]}.xlsx`);

      toast({
        title: "Export Successful",
        description: "Excel report downloaded successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Export Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const getOverallProgress = () => {
    if (!projects || projects.length === 0) return 0;
    const totalProgress = projects.reduce((sum, p) => sum + p.progress, 0);
    return Math.round(totalProgress / projects.length);
  };

  const getPhasePercentage = (phase: string) => {
    if (!stats?.projectPhases) return 0;
    // Normalized check usually helps if casing differs, but assuming exact match for now based on stats shape
    const map: Record<string, number> = {
      "Topic Selection": stats.projectPhases.topicSelection,
      "Development": stats.projectPhases.implementation, // Mapping Development to Implementation as per logic
      "Final Review": stats.projectPhases.testing // Mapping Final Review to Testing
    };
    return map[phase] || 0;
  };

  const filterProjects = (projects: ProjectWithMilestones[] | undefined) => {
    if (!projects) return [];
    let filtered = [...projects];



    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(project =>
        project.topic.title.toLowerCase().includes(query) ||
        `${project.student.firstName} ${project.student.lastName}`.toLowerCase().includes(query)
      );
    }

    return filtered;
  };

  const filteredProjects = filterProjects(projects);

  const openDetailsModal = (project: any) => {
    setSelectedProject(project);
    setIsDetailsModalOpen(true);
  };

  const closeDetailsModal = () => {
    setIsDetailsModalOpen(false);
    setSelectedProject(null);
  };

  function getProgressColorClass(progress: number): string {
    if (progress >= 75) return "bg-blue-500";
    if (progress >= 50) return "bg-emerald-500";
    if (progress >= 25) return "bg-amber-500";
    return "bg-destructive";
  }

  function getStatusBadge(progress: number) {
    if (progress >= 100) {
      return (
        <span className="px-2 py-1 bg-blue-500/10 text-blue-500 text-xs rounded-full">
          Completed
        </span>
      );
    } else if (progress >= 60) {
      return (
        <span className="px-2 py-1 bg-emerald-500/10 text-emerald-500 text-xs rounded-full">
          On Track
        </span>
      );
    } else if (progress >= 30) {
      return (
        <span className="px-2 py-1 bg-amber-500/10 text-amber-500 text-xs rounded-full">
          Need Attention
        </span>
      );
    } else {
      return (
        <span className="px-2 py-1 bg-destructive/10 text-destructive text-xs rounded-full">
          At Risk
        </span>
      );
    }
  }

  if (!user || (user.role !== UserRole.COORDINATOR && user.role !== UserRole.ADMIN)) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-full">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Access Denied</CardTitle>
              <CardDescription>
                You don't have permission to access this page.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-center text-muted-foreground">
                This page is only accessible to coordinators and administrators.
              </p>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-1">Progress Tracking</h1>
        <p className="text-muted-foreground">Monitor and track the progress of student projects</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle>Overall Progress</CardTitle>
            <CardDescription>
              Project phase completion across all departments
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingStats ? (
              <div className="space-y-6">
                {Array(4).fill(0).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-2 w-full rounded-full" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                <ProgressBar
                  label="Topic Selection Phase"
                  percentage={getPhasePercentage("Topic Selection")}
                  color="bg-secondary"
                />
                <ProgressBar
                  label="Development Phase"
                  percentage={getPhasePercentage("Development")}
                  color="bg-primary"
                />
                <ProgressBar
                  label="Final Review Phase"
                  percentage={getPhasePercentage("Final Review")}
                  color="bg-accent"
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <Tabs defaultValue="all" className="w-full">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex flex-col gap-2">
                <CardTitle>Projects Overview</CardTitle>
                <CardDescription>Monitor and track all student projects</CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1 md:max-w-xs">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search projects..."
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Button
                  onClick={() => exportExcelMutation.mutate()}
                  disabled={exportExcelMutation.isPending}
                  variant="outline"
                  className="gap-2"
                >
                  <FileDown className="h-4 w-4" />
                  {exportExcelMutation.isPending ? "Exporting..." : "Export as Excel"}
                </Button>
              </div>
            </div>
            <div className="mt-4">
              <TabsList>
                <TabsTrigger value="all">All Projects</TabsTrigger>
                <TabsTrigger value="atRisk">At Risk</TabsTrigger>
                <TabsTrigger value="onTrack">On Track</TabsTrigger>
                <TabsTrigger value="completed">Completed</TabsTrigger>
              </TabsList>
            </div>
          </CardHeader>

          <CardContent>
            <TabsContent value="all" className="mt-0">
              {isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Project Topic</TableHead>
                        <TableHead>Student</TableHead>
                        <TableHead>Enrollment #</TableHead>
                        <TableHead>Progress</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProjects && filteredProjects.length > 0 ? (
                        filteredProjects.map((project) => (
                          <TableRow key={project.id} className="hover:bg-muted/50">
                            <TableCell className="font-medium">{project.topic.title}</TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                  <span className="text-primary font-medium text-sm">
                                    {project.student.firstName.charAt(0)}
                                    {project.student.lastName.charAt(0)}
                                  </span>
                                </div>
                                <span>{`${project.student.firstName} ${project.student.lastName}`}</span>
                              </div>
                            </TableCell>
                            <TableCell>{project.student.enrollmentNumber || 'N/A'}</TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <div className="w-full bg-muted rounded-full h-2 max-w-[100px]">
                                  <div
                                    className={`rounded-full h-2 ${getProgressColorClass(project.progress)}`}
                                    style={{ width: `${project.progress}%` }}
                                  ></div>
                                </div>
                                <span className="text-sm">{project.progress}%</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(project.progress)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openDetailsModal(project)}
                              >
                                View Details
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            {searchQuery
                              ? "No projects match your filters"
                              : "No projects found"}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="atRisk" className="mt-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project Topic</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Enrollment #</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProjects && filteredProjects.length > 0 ? (
                      filteredProjects
                        .filter(project => project.progress < 30)
                        .map((project) => (
                          <TableRow key={project.id} className="hover:bg-muted/50">
                            <TableCell className="font-medium">{project.topic.title}</TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                  <span className="text-primary font-medium text-sm">
                                    {project.student.firstName.charAt(0)}
                                    {project.student.lastName.charAt(0)}
                                  </span>
                                </div>
                                <span>{`${project.student.firstName} ${project.student.lastName}`}</span>
                              </div>
                            </TableCell>
                            <TableCell>{project.student.enrollmentNumber || 'N/A'}</TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <div className="w-full bg-muted rounded-full h-2 max-w-[100px]">
                                  <div
                                    className={`rounded-full h-2 ${getProgressColorClass(project.progress)}`}
                                    style={{ width: `${project.progress}%` }}
                                  ></div>
                                </div>
                                <span className="text-sm">{project.progress}%</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(project.progress)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openDetailsModal(project)}
                              >
                                View Details
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No projects at risk
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="onTrack" className="mt-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project Topic</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Enrollment #</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProjects && filteredProjects.length > 0 ? (
                      filteredProjects
                        .filter(project => project.progress >= 30 && project.progress < 100)
                        .map((project) => (
                          <TableRow key={project.id} className="hover:bg-muted/50">
                            <TableCell className="font-medium">{project.topic.title}</TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                  <span className="text-primary font-medium text-sm">
                                    {project.student.firstName.charAt(0)}
                                    {project.student.lastName.charAt(0)}
                                  </span>
                                </div>
                                <span>{`${project.student.firstName} ${project.student.lastName}`}</span>
                              </div>
                            </TableCell>
                            <TableCell>{project.student.enrollmentNumber || 'N/A'}</TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <div className="w-full bg-muted rounded-full h-2 max-w-[100px]">
                                  <div
                                    className={`rounded-full h-2 ${getProgressColorClass(project.progress)}`}
                                    style={{ width: `${project.progress}%` }}
                                  ></div>
                                </div>
                                <span className="text-sm">{project.progress}%</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(project.progress)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openDetailsModal(project)}
                              >
                                View Details
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No projects on track
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="completed" className="mt-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project Topic</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Enrollment #</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProjects && filteredProjects.length > 0 ? (
                      filteredProjects
                        .filter(project => project.progress === 100)
                        .map((project) => (
                          <TableRow key={project.id} className="hover:bg-muted/50">
                            <TableCell className="font-medium">{project.topic.title}</TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                  <span className="text-primary font-medium text-sm">
                                    {project.student.firstName.charAt(0)}
                                    {project.student.lastName.charAt(0)}
                                  </span>
                                </div>
                                <span>{`${project.student.firstName} ${project.student.lastName}`}</span>
                              </div>
                            </TableCell>
                            <TableCell>{project.student.enrollmentNumber || 'N/A'}</TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <div className="w-full bg-muted rounded-full h-2 max-w-[100px]">
                                  <div
                                    className={`rounded-full h-2 ${getProgressColorClass(project.progress)}`}
                                    style={{ width: `${project.progress}%` }}
                                  ></div>
                                </div>
                                <span className="text-sm">{project.progress}%</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(project.progress)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openDetailsModal(project)}
                              >
                                View Details
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No completed projects
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

      {/* Project Details Modal */}
      {isDetailsModalOpen && selectedProject && (
        <Modal
          isOpen={isDetailsModalOpen}
          onClose={closeDetailsModal}
          title="Project Details"
          description="Detailed information about the selected project"
        >
          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">{selectedProject.topic.title}</h3>
              <p className="text-sm text-muted-foreground">{selectedProject.topic.description}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium">Student</p>
                <p className="text-sm text-muted-foreground">
                  {selectedProject.student.firstName} {selectedProject.student.lastName}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium">Start Date</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(selectedProject.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Complexity</p>
                <p className="text-sm text-muted-foreground">{selectedProject.topic.estimatedComplexity}</p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Overall Progress</p>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <ProgressBar
                    label=""
                    percentage={selectedProject.progress}
                    color={getProgressColorClass(selectedProject.progress)}
                  />
                </div>
                <span className="text-sm font-medium">{selectedProject.progress}%</span>
              </div>
              <div className="mt-2">
                {getStatusBadge(selectedProject.progress)}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Technology Stack</p>
              <p className="text-sm text-muted-foreground">{selectedProject.topic.technology}</p>
            </div>

            {selectedProject?.milestones?.map((milestone: ProjectMilestone) => (
              <div key={milestone.id} className="flex items-center gap-4 mb-4">
                <div>
                  <p className="text-sm font-medium">{milestone.title}</p>
                  <p className="text-xs text-muted-foreground">{milestone.description}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${milestone.status === "completed"
                  ? "bg-blue-500/10 text-blue-500"
                  : "bg-amber-500/10 text-amber-500"
                  }`}>
                  {milestone.status === "completed" ? "Completed" : "Pending"}
                </span>
              </div>
            ))}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeDetailsModal}>Close</Button>
            </div>
          </div>
        </Modal>
      )}
    </MainLayout>
  );
}