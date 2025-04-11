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
        <Tabs defaultValue="all">
          <CardHeader>
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
                      <TableCell className="font-medium">AI-Enhanced Academic Advisor</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-primary font-medium text-sm">RS</span>
                          </div>
                          <span>Rahul Sharma</span>
                        </div>
                      </TableCell>
                      <TableCell>Computer Science</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <div className="w-full bg-muted rounded-full h-2 max-w-[100px]">
                            <div 
                              className="bg-emerald-500 rounded-full h-2"
                              style={{ width: "65%" }}
                            ></div>
                          </div>
                          <span className="text-sm">65%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="px-2 py-1 bg-emerald-500/10 text-emerald-500 text-xs rounded-full">
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
                      <TableCell className="font-medium">IoT Weather Monitoring System</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-primary font-medium text-sm">PK</span>
                          </div>
                          <span>Priya Khan</span>
                        </div>
                      </TableCell>
                      <TableCell>Electronics Engineering</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <div className="w-full bg-muted rounded-full h-2 max-w-[100px]">
                            <div 
                              className="bg-blue-500 rounded-full h-2"
                              style={{ width: "100%" }}
                            ></div>
                          </div>
                          <span className="text-sm">100%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="px-2 py-1 bg-blue-500/10 text-blue-500 text-xs rounded-full">
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
        </Tabs>
      </Card>

      {/* Project Details Modal */}
      {isDetailsModalOpen && selectedProject && (
        <Modal 
          isOpen={isDetailsModalOpen} 
          onClose={closeDetailsModal}
          title={selectedProject.topic.title}
          size="lg"
        >
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div className="md:w-1/3 space-y-2">
                <div className="text-sm text-muted-foreground">Progress</div>
                <div className="flex items-center space-x-2">
                  <div className="w-full bg-muted rounded-full h-2.5">
                    <div 
                      className={`rounded-full h-2.5 ${getProgressColorClass(selectedProject.progress)}`}
                      style={{ width: `${selectedProject.progress}%` }}
                    ></div>
                  </div>
                  <span className="text-lg font-semibold">{selectedProject.progress}%</span>
                </div>
                <div>{getStatusBadge(selectedProject.progress)}</div>
              </div>
              
              <div className="md:w-2/3 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Student</div>
                  <div className="flex items-center space-x-2 mt-1">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-primary font-medium text-sm">
                        {selectedProject.student.firstName.charAt(0)}
                        {selectedProject.student.lastName.charAt(0)}
                      </span>
                    </div>
                    <span className="font-medium">{`${selectedProject.student.firstName} ${selectedProject.student.lastName}`}</span>
                  </div>
                </div>
                
                <div>
                  <div className="text-sm text-muted-foreground">Department</div>
                  <div className="font-medium mt-1">{selectedProject.topic.department}</div>
                </div>
                
                <div>
                  <div className="text-sm text-muted-foreground">Started</div>
                  <div className="font-medium mt-1">{new Date(selectedProject.createdAt).toLocaleDateString()}</div>
                </div>
                
                <div>
                  <div className="text-sm text-muted-foreground">Complexity</div>
                  <div className="font-medium mt-1">{selectedProject.topic.estimatedComplexity}</div>
                </div>
              </div>
            </div>
            
            <div>
              <div className="text-sm text-muted-foreground mb-2">Project Description</div>
              <p className="text-foreground">{selectedProject.topic.description}</p>
            </div>
            
            <div>
              <div className="text-sm text-muted-foreground mb-2">Milestones</div>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span>Project proposal submission</span>
                </div>
                
                <div className="flex items-center space-x-2">
                  <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span>Literature review completion</span>
                </div>
                
                <div className="flex items-center space-x-2">
                  <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center">
                    <span className="text-xs text-muted-foreground">3</span>
                  </div>
                  <span className="text-muted-foreground">Implementation of core features</span>
                </div>
                
                <div className="flex items-center space-x-2">
                  <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center">
                    <span className="text-xs text-muted-foreground">4</span>
                  </div>
                  <span className="text-muted-foreground">Testing and validation</span>
                </div>
                
                <div className="flex items-center space-x-2">
                  <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center">
                    <span className="text-xs text-muted-foreground">5</span>
                  </div>
                  <span className="text-muted-foreground">Final presentation and report submission</span>
                </div>
              </div>
            </div>
            
            <div className="pt-4 border-t border-border flex justify-end space-x-4">
              <Button variant="outline">Download Report</Button>
              <Button>Contact Student</Button>
            </div>
          </div>
        </Modal>
      )}
    </MainLayout>
  );
}