import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ProjectTopic } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { ChevronDown, ChevronUp } from "lucide-react";

export interface ITopicCardProps {
  topic: ProjectTopic;
  onApprove?: (id: number) => void;
  onReject?: (id: number) => void;
  onSelect?: (id: number) => void;
  isStudent?: boolean;
  isCoordinator?: boolean;
  hideSupervisor?: boolean;
}

/**
 * TopicCard renders an individual project topic with expandable description,
 * badges for metadata, and role-appropriate actions.
 */
export default function TopicCard({
  topic,
  onApprove,
  onReject,
  onSelect,
  isStudent = false,
  isCoordinator = false,
  hideSupervisor = false,
}: ITopicCardProps) {
  // State for toggling between clamped summary view and full unabridged description
  const [isExpanded, setIsExpanded] = useState(false);
  const timeAgo = formatDistanceToNow(new Date(topic.createdAt), { addSuffix: true });
  
  return (
    <Card 
      onClick={() => setIsExpanded(!isExpanded)}
      className={`h-full flex flex-col cursor-pointer transition-all duration-200 hover:shadow-md ${
        isExpanded ? "ring-2 ring-primary/30 shadow-md" : ""
      }`}
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setIsExpanded(!isExpanded);
        }
      }}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2 flex-wrap mb-1.5">
          {topic.topicCode && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
              {topic.topicCode}
            </span>
          )}
          {topic.course && (
            <span className="px-2 py-0.5 bg-accent/10 text-accent text-xs rounded-full border border-accent/20 font-medium">
              {topic.course}
            </span>
          )}
          {topic.projectType && (
            <span className="px-2 py-0.5 bg-muted text-muted-foreground text-xs rounded-full font-medium">
              {topic.projectType}
            </span>
          )}
        </div>
        <CardTitle className="text-lg leading-tight">{topic.title}</CardTitle>
      </CardHeader>
      
      <CardContent className="flex-grow">
        {/* Description block with click-to-expand support */}
        <div className="mb-4">
          <p className={`text-sm text-muted-foreground transition-all duration-200 ${
            isExpanded ? "whitespace-pre-line text-foreground/90 leading-relaxed" : "line-clamp-3"
          }`}>
            {topic.description}
          </p>
          {topic.description && topic.description.length > 120 && (
            <button
              type="button"
              onClick={(e) => {
                // Prevent card-level toggle from firing redundantly
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="text-xs text-primary font-medium hover:underline flex items-center gap-1 mt-1.5 focus:outline-none"
            >
              {isExpanded ? (
                <>
                  <span>Show less</span>
                  <ChevronUp className="h-3 w-3" />
                </>
              ) : (
                <>
                  <span>Read full description</span>
                  <ChevronDown className="h-3 w-3" />
                </>
              )}
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm pt-1 border-t">
          <div>
            <p className="text-xs text-muted-foreground">Technology</p>
            <p className="font-medium text-xs line-clamp-1">{topic.technology || "General"}</p>
          </div>
          {!hideSupervisor && (
            <div>
              <p className="text-xs text-muted-foreground">Supervisor</p>
              <p className="font-medium text-xs line-clamp-1">
                {topic.submittedBy ? `${topic.submittedBy.prefix ? topic.submittedBy.prefix + " " : ""}${topic.submittedBy.firstName} ${topic.submittedBy.lastName || ""}`.trim() : (topic.submittedById ? `Faculty ID: ${topic.submittedById}` : "Supervisor")}
              </p>
            </div>
          )}
          <div>
            <p className="text-xs text-muted-foreground">Submitted</p>
            <p className="font-medium text-xs">{timeAgo}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <div>
              {topic.status === 'pending' && (
                <span className="px-2 py-0.5 bg-accent/20 text-accent-foreground text-xs rounded-full">Pending</span>
              )}
              {topic.status === 'approved' && (
                <span className="px-2 py-0.5 bg-secondary/20 text-secondary text-xs rounded-full">Approved</span>
              )}
              {topic.status === 'rejected' && (
                <span className="px-2 py-0.5 bg-destructive/20 text-destructive text-xs rounded-full">Rejected</span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="pt-2">
        {isCoordinator && topic.status === 'pending' && (
          <div className="flex space-x-2 w-full">
            <Button 
              variant="outline" 
              size="sm" 
              className="border-destructive text-destructive hover:bg-destructive/10 flex-1"
              onClick={(e) => {
                e.stopPropagation();
                onReject && onReject(topic.id);
              }}
            >
              Reject
            </Button>
            <Button 
              variant="default" 
              size="sm" 
              className="bg-secondary hover:bg-secondary/90 flex-1"
              onClick={(e) => {
                e.stopPropagation();
                onApprove && onApprove(topic.id);
              }}
            >
              Approve
            </Button>
          </div>
        )}
        
        {isStudent && topic.status === 'approved' && (
          <Button 
            variant="default" 
            size="sm" 
            className="w-full"
            onClick={(e) => {
              e.stopPropagation();
              onSelect && onSelect(topic.id);
            }}
          >
            Select Topic
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
