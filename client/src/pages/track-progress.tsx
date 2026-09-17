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
import { useCourseFilter } from "@/hooks/course-filter-context";

interface ProjectWithMilestones extends StudentProject {
  topic: ProjectTopic;
  student: User;
  supervisor?: User;
  milestones: ProjectMilestone[];
}

export default function TrackProgress() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");

  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectWithMilestones | null>(null);

  const { courseFilter, getCourseQuery } = useCourseFilter();

  const { data: projects = [], isLoading } = useQuery<ProjectWithMilestones[]>({
    queryKey: [`/api/projects${getCourseQuery() ? `?${getCourseQuery()}` : ''}`],
    enabled: !!user && (user.role === UserRole.COORDINATOR || user.role === UserRole.ADMIN),
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/projects?${getCourseQuery() ? `${getCourseQuery()}&` : ''}limit=all`);
      const data = await res.json();
      return Array.isArray(data) ? data : (data.data || []);
    }
  });

  const { data: stats, isLoading: isLoadingStats } = useQuery<any>({
    queryKey: [`/api/stats${getCourseQuery() ? `?${getCourseQuery()}` : ''}`],
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

  const filterProjects = (projectsList: ProjectWithMilestones[] | undefined) => {
    if (!projectsList) return [];
    let filtered = [...projectsList];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(project => {
        const sup = project.supervisor || (project.topic as any)?.submittedBy;
        const supName = sup ? `${sup.firstName} ${sup.lastName}`.toLowerCase() : "";
        return (
          project.topic?.title?.toLowerCase().includes(query) ||
          project.topic?.topicCode?.toLowerCase().includes(query) ||
          `${project.student?.firstName} ${project.student?.lastName}`.toLowerCase().includes(query) ||
          project.student?.enrollmentNumber?.toLowerCase().includes(query) ||
          project.topic?.technology?.toLowerCase().includes(query) ||
          supName.includes(query)
        );
      });
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

  const renderProjectTable = (list: ProjectWithMilestones[], emptyMessage: string) => {
    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project Topic</TableHead>
              <TableHead>Course</TableHead>
              <TableHead>Student</TableHead>
              <TableHead>Enrollment #</TableHead>
              <TableHead>Supervisor</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list && list.length > 0 ? (
              list.map((project) => {
                const supervisor = project.supervisor || (project.topic as any)?.submittedBy;
                const supervisorName = supervisor 
                  ? `${supervisor.prefix ? `${supervisor.prefix} ` : ""}${supervisor.firstName} ${supervisor.lastName}`.trim()
                  : null;

                return (
                  <TableRow key={project.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">
                      <div className="space-y-1 max-w-xs">
                        {project.topic?.topicCode && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                            {project.topic.topicCode}
                          </span>
                        )}
                        <p className="line-clamp-2 text-sm">{project.topic?.title || "Unknown Topic"}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="px-2 py-1 bg-accent/10 text-accent text-xs rounded-full border border-accent/20">
                        {project.student?.course || project.topic?.course || "N/A"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                          {project.student?.firstName?.charAt(0) || ""}
                          {project.student?.lastName?.charAt(0) || ""}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm text-foreground truncate">
                            {project.student ? `${project.student.firstName} ${project.student.lastName}` : "Unknown Student"}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate">{project.student?.email || ""}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{project.student?.enrollmentNumber || "N/A"}</TableCell>
                    <TableCell>
                      {supervisorName ? (
                        <div className="flex items-center space-x-2">
                          <div className="w-7 h-7 rounded-full bg-secondary/10 text-secondary border border-secondary/20 flex items-center justify-center text-xs font-bold shrink-0">
                            {supervisor.firstName?.charAt(0) || ""}{supervisor.lastName?.charAt(0) || ""}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-xs text-foreground truncate">{supervisorName}</p>
                            {supervisor.department && (
                              <p className="text-[10px] text-muted-foreground truncate">{supervisor.department}</p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not Assigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <div className="w-full bg-muted rounded-full h-2 max-w-[100px]">
                          <div
                            className={`rounded-full h-2 ${getProgressColorClass(project.progress)}`}
                            style={{ width: `${project.progress}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-semibold">{project.progress}%</span>
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
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p>{searchQuery ? "No projects match your search query." : emptyMessage}</p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    );
  };

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
                    aria-label="Search progress reports"
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
              {isLoading ? <Skeleton className="h-64 w-full" /> : renderProjectTable(filteredProjects, "No student projects found.")}
            </TabsContent>

            <TabsContent value="atRisk" className="mt-0">
              {isLoading ? <Skeleton className="h-64 w-full" /> : renderProjectTable(filteredProjects.filter(p => p.progress < 30), "No projects currently at risk.")}
            </TabsContent>

            <TabsContent value="onTrack" className="mt-0">
              {isLoading ? <Skeleton className="h-64 w-full" /> : renderProjectTable(filteredProjects.filter(p => p.progress >= 30 && p.progress < 100), "No projects currently in progress.")}
            </TabsContent>

            <TabsContent value="completed" className="mt-0">
              {isLoading ? <Skeleton className="h-64 w-full" /> : renderProjectTable(filteredProjects.filter(p => p.progress === 100), "No completed projects yet.")}
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
            <div className="space-y-2 bg-card/50 p-4 rounded-lg border">
              {selectedProject.topic?.topicCode && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                  {selectedProject.topic.topicCode}
                </span>
              )}
              <h3 className="text-lg font-semibold text-foreground">{selectedProject.topic.title}</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{selectedProject.topic.description}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 rounded-lg border bg-muted/20 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Student</p>
                <p className="text-sm font-bold text-foreground">
                  {selectedProject.student.firstName} {selectedProject.student.lastName}
                </p>
                <p className="text-xs text-muted-foreground">{selectedProject.student.enrollmentNumber || selectedProject.student.email}</p>
              </div>

              <div className="p-3 rounded-lg border bg-muted/20 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Assigned Supervisor</p>
                {(() => {
                  const supervisor = selectedProject.supervisor || (selectedProject.topic as any)?.submittedBy;
                  if (!supervisor) return <p className="text-sm text-muted-foreground">Not Assigned</p>;
                  const name = `${supervisor.prefix ? `${supervisor.prefix} ` : ""}${supervisor.firstName} ${supervisor.lastName}`.trim();
                  return (
                    <div>
                      <p className="text-sm font-bold text-foreground">{name}</p>
                      {supervisor.department && <p className="text-xs text-muted-foreground">{supervisor.department}</p>}
                      {supervisor.email && <p className="text-xs text-muted-foreground">{supervisor.email}</p>}
                    </div>
                  );
                })()}
              </div>

              <div className="p-3 rounded-lg border bg-muted/20 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Course & Complexity</p>
                <p className="text-sm font-medium text-foreground">
                  {selectedProject.student.course || selectedProject.topic.course || "BCA"} • {selectedProject.topic.estimatedComplexity} Complexity
                </p>
              </div>

              <div className="p-3 rounded-lg border bg-muted/20 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Start Date</p>
                <p className="text-sm font-medium text-foreground">
                  {new Date(selectedProject.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-lg border bg-muted/10 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Project Milestone Progress</p>
                <span className="text-sm font-bold text-primary">{selectedProject.progress}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${getProgressColorClass(selectedProject.progress)}`}
                  style={{ width: `${selectedProject.progress}%` }}
                />
              </div>
              <div className="pt-1">
                {getStatusBadge(selectedProject.progress)}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Technology Stack</p>
              <p className="text-sm text-foreground bg-muted/30 p-2.5 rounded-md border font-mono text-xs">{selectedProject.topic.technology}</p>
            </div>

            {selectedProject?.milestones && selectedProject.milestones.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Milestone Breakdown</p>
                {selectedProject.milestones.map((milestone: ProjectMilestone) => (
                  <div key={milestone.id} className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/20 text-sm">
                    <div>
                      <p className="font-medium text-xs text-foreground">{milestone.title}</p>
                      <p className="text-[11px] text-muted-foreground">{milestone.description}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${milestone.status === "completed"
                      ? "bg-blue-500/10 text-blue-500 font-medium"
                      : "bg-amber-500/10 text-amber-500 font-medium"
                      }`}>
                      {milestone.status === "completed" ? "Completed" : "Pending"}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={closeDetailsModal}>Close</Button>
            </div>
          </div>
        </Modal>
      )}
    </MainLayout>
  );
}