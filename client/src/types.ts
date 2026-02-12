import { ProjectMilestone, StudentProject } from "@shared/schema";

export interface ProjectWithMilestones extends StudentProject {
  milestones: ProjectMilestone[];
} 