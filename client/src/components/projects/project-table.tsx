import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ProjectTopic, StudentProject, User } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

type ProjectTableProps = {
  projects: (StudentProject & { 
    topic: ProjectTopic,
    student: User
  })[];
  onViewDetails?: (id: number) => void;
};

export default function ProjectTable({ projects, onViewDetails }: ProjectTableProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Project Topic</TableHead>
            <TableHead>Student</TableHead>
            <TableHead>Department</TableHead>
            <TableHead>Progress</TableHead>
            <TableHead>Started</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((project) => (
            <TableRow key={project.id}>
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
                      className="bg-primary rounded-full h-2" 
                      style={{ width: `${project.progress}%` }}
                    ></div>
                  </div>
                  <span className="text-sm">{project.progress}%</span>
                </div>
              </TableCell>
              <TableCell>{formatDistanceToNow(new Date(project.createdAt), { addSuffix: true })}</TableCell>
              <TableCell className="text-right">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => onViewDetails && onViewDetails(project.id)}
                >
                  View Details
                </Button>
              </TableCell>
            </TableRow>
          ))}
          
          {projects.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                No projects found
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
