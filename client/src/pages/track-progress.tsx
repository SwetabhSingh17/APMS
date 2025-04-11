import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ProgressBar from "@/components/dashboard/progress-bar";
import { Search, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserRole } from "@shared/schema";
import Modal from "@/components/ui/modal";

export default function TrackProgress() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("all");
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<any>(null);

  const { data: projects, isLoading } = useQuery({
    queryKey: ["/api/projects"],
    enabled: !!user && (user.role === UserRole.COORDINATOR || user.role === UserRole.ADMIN)
  });

  const { data: departmentStats, isLoading: isLoadingStats } = useQuery({
    queryKey: ["/api/departments/stats"],
    enabled: !!user && (user.role === UserRole.COORDINATOR || user.role === UserRole.ADMIN)
  });

  const filterProjects = (items: any[] | undefined) => {
    if (!items) return [];

    // Filter by department
    let filtered = items;
    if (filterDepartment !== "all") {
      filtered = filtered.filter(item => item.topic.department === filterDepartment);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        item => 
          item.topic.title.toLowerCase().includes(query) || 
          item.student.firstName.toLowerCase().includes(query) ||
          item.student.lastName.toLowerCase().includes(query)
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
                  percentage={85} 
                  color="bg-secondary" 
                />
                <ProgressBar 
                  label="Research & Planning" 
                  percentage={62} 
                  color="bg-primary" 
                />
                <ProgressBar 
                  label="Implementation" 
                  percentage={41} 
                  color="bg-accent" 
                />
                <ProgressBar 
                  label="Testing & Documentation" 
                  percentage={18} 
                  color="bg-destructive" 
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Department Progress</CardTitle>
            <CardDescription>
              Average progress by department
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingStats ? (
              <div className="space-y-4">
                {Array(5).fill(0).map((_, i) => (
                  <div key={i} className="bg-muted p-3 rounded-lg space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-6 w-12" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-muted p-3 rounded-lg">
                  <p className="text-sm text-muted-foreground">Computer Science</p>
                  <p className="text-lg font-semibold text-primary">78%</p>
                </div>
                <div className="bg-muted p-3 rounded-lg">
                  <p className="text-sm text-muted-foreground">Information Technology</p>
                  <p className="text-lg font-semibold text-primary">82%</p>
                </div>
                <div className="bg-muted p-3 rounded-lg">
                  <p className="text-sm text-muted-foreground">Electronics Engineering</p>
                  <p className="text-lg font-semibold text-primary">65%</p>
                </div>
                <div className="bg-muted p-3 rounded-lg">
                  <p className="text-sm text-muted-foreground">Mechanical Engineering</p>
                  <p className="text-lg font-semibold text-primary">53%</p>
                </div>
                <div className="bg-muted p-3 rounded-lg">
                  <p className="text-sm text-muted-foreground">Civil Engineering</p>
                  <p className="text-lg font-semibold text-primary">61%</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <Tabs defaultValue="all">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <TabsList>
                <TabsTrigger value="all">All Projects</TabsTrigger>
                <TabsTrigger value="atRisk">At Risk</TabsTrigger>
                <TabsTrigger value="onTrack">On Track</TabsTrigger>
                <TabsTrigger value="completed">Completed</TabsTrigger>
              </TabsList>
              
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search by project or student..."
                    className="pl-10 w-full md:w-64"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                
                <Select 
                  value={filterDepartment} 
                  onValueChange={setFilterDepartment}
                >
                  <SelectTrigger className="w-full md:w-56">
                    <SelectValue placeholder="Filter by department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    <SelectItem value="Computer Science">Computer Science</SelectItem>
                    <SelectItem value="Information Technology">Information Technology</SelectItem>
                    <SelectItem value="Electronics Engineering">Electronics Engineering</SelectItem>
                    <SelectItem value="Mechanical Engineering">Mechanical Engineering</SelectItem>
                    <SelectItem value="Civil Engineering">Civil Engineering</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Tabs>
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
                      <TableHead>Department</TableHead>
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
                          <TableCell>{project.topic.department}</TableCell>
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
                          {searchQuery || filterDepartment !== "all" 
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
                    <TableHead>Department</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Smart Traffic Management System</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-primary font-medium text-sm">AP</span>
                        </div>
                        <span>Aditya Patel</span>
                      </div>
                    </TableCell>
                    <TableCell>Civil Engineering</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <div className="w-full bg-muted rounded-full h-2 max-w-[100px]">
                          <div 
                            className="bg-destructive rounded-full h-2"
                            style={{ width: "22%" }}
                          ></div>
                        </div>
                        <span className="text-sm">22%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="px-2 py-1 bg-destructive/10 text-destructive text-xs rounded-full">
                        At Risk
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="outline" 
                        size="sm"
                      >
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
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
                    <TableHead>Department</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">AI-Powered Attendance System</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-primary font-medium text-sm">RS</span>
                        </div>
                        <span>Rahul Singh</span>
                      </div>
                    </TableCell>
                    <TableCell>Computer Science</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <div className="w-full bg-muted rounded-full h-2 max-w-[100px]">
                          <div 
                            className="bg-secondary rounded-full h-2"
                            style={{ width: "76%" }}
                          ></div>
                        </div>
                        <span className="text-sm">76%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="px-2 py-1 bg-secondary/10 text-secondary text-xs rounded-full">
                        On Track
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="outline" 
                        size="sm"
                      >
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
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
                    <TableHead>Department</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">E-Waste Management Portal</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-primary font-medium text-sm">PK</span>
                        </div>
                        <span>Priya Kumar</span>
                      </div>
                    </TableCell>
                    <TableCell>Information Technology</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <div className="w-full bg-muted rounded-full h-2 max-w-[100px]">
                          <div 
                            className="bg-primary rounded-full h-2"
                            style={{ width: "100%" }}
                          ></div>
                        </div>
                        <span className="text-sm">100%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">
                        Completed
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="outline" 
                        size="sm"
                      >
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </CardContent>
      </Card>

      {/* Project Details Modal */}
      <Modal
        isOpen={isDetailsModalOpen}
        onClose={closeDetailsModal}
        title="Project Details"
      >
        {selectedProject && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold mb-2">{selectedProject.topic.title}</h3>
              <p className="text-muted-foreground">{selectedProject.topic.description}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Student</p>
                <div className="flex items-center space-x-2 mt-1">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-primary font-medium text-xs">
                      {selectedProject.student.firstName.charAt(0)}
                      {selectedProject.student.lastName.charAt(0)}
                    </span>
                  </div>
                  <span className="font-medium">{selectedProject.student.firstName} {selectedProject.student.lastName}</span>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Department</p>
                <p className="font-medium">{selectedProject.topic.department}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Mentor</p>
                <div className="flex items-center space-x-2 mt-1">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-primary font-medium text-xs">
                      {selectedProject.topic.submittedBy?.firstName?.charAt(0) || ""}
                      {selectedProject.topic.submittedBy?.lastName?.charAt(0) || ""}
                    </span>
                  </div>
                  <span className="font-medium">
                    {selectedProject.topic.submittedBy?.firstName} {selectedProject.topic.submittedBy?.lastName}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Started On</p>
                <p className="font-medium">{new Date(selectedProject.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
            
            <div>
              <p className="text-sm font-medium mb-2">Project Progress: {selectedProject.progress}%</p>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className={`rounded-full h-2 ${getProgressColorClass(selectedProject.progress)}`}
                  style={{ width: `${selectedProject.progress}%` }}
                ></div>
              </div>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Milestones</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-6 h-6 rounded-full bg-secondary/10 flex items-center justify-center mr-2">
                      <FileText className="h-3 w-3 text-secondary" />
                    </div>
                    <span>Project Proposal</span>
                  </div>
                  <span className="text-sm text-secondary">Completed</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-6 h-6 rounded-full bg-secondary/10 flex items-center justify-center mr-2">
                      <FileText className="h-3 w-3 text-secondary" />
                    </div>
                    <span>Literature Review</span>
                  </div>
                  <span className="text-sm text-secondary">Completed</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center mr-2">
                      <FileText className="h-3 w-3 text-accent" />
                    </div>
                    <span>Implementation</span>
                  </div>
                  <span className="text-sm text-accent">In Progress</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center mr-2">
                      <FileText className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <span>Testing & Documentation</span>
                  </div>
                  <span className="text-sm text-muted-foreground">Not Started</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center mr-2">
                      <FileText className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <span>Final Presentation</span>
                  </div>
                  <span className="text-sm text-muted-foreground">Not Started</span>
                </div>
              </div>
            </div>
            
            <div className="pt-2 flex justify-end">
              <Button onClick={closeDetailsModal}>Close</Button>
            </div>
          </div>
        )}
      </Modal>
    </MainLayout>
  );
}

// Helper functions
function getProgressColorClass(progress: number): string {
  if (progress < 30) return "bg-destructive";
  if (progress < 70) return "bg-accent";
  return "bg-secondary";
}

function getStatusBadge(progress: number) {
  if (progress < 30) {
    return (
      <span className="px-2 py-1 bg-destructive/10 text-destructive text-xs rounded-full">
        At Risk
      </span>
    );
  } else if (progress < 70) {
    return (
      <span className="px-2 py-1 bg-accent/10 text-accent text-xs rounded-full">
        In Progress
      </span>
    );
  } else if (progress < 100) {
    return (
      <span className="px-2 py-1 bg-secondary/10 text-secondary text-xs rounded-full">
        On Track
      </span>
    );
  } else {
    return (
      <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">
        Completed
      </span>
    );
  }
}
