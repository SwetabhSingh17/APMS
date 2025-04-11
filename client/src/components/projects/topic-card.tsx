import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ProjectTopic } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

type TopicCardProps = {
  topic: ProjectTopic;
  onApprove?: (id: number) => void;
  onReject?: (id: number) => void;
  onSelect?: (id: number) => void;
  isStudent?: boolean;
  isCoordinator?: boolean;
};

export default function TopicCard({
  topic,
  onApprove,
  onReject,
  onSelect,
  isStudent = false,
  isCoordinator = false,
}: TopicCardProps) {
  const timeAgo = formatDistanceToNow(new Date(topic.createdAt), { addSuffix: true });
  
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{topic.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-grow">
        <p className="text-sm text-muted-foreground mb-4">{topic.description}</p>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-muted-foreground">Department</p>
            <p className="font-medium">{topic.department}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Complexity</p>
            <p className="font-medium">{topic.estimatedComplexity}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Submitted</p>
            <p className="font-medium">{timeAgo}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Status</p>
            <div>
              {topic.status === 'pending' && (
                <span className="px-2 py-1 bg-accent/20 text-accent-foreground text-xs rounded-full">Pending</span>
              )}
              {topic.status === 'approved' && (
                <span className="px-2 py-1 bg-secondary/20 text-secondary text-xs rounded-full">Approved</span>
              )}
              {topic.status === 'rejected' && (
                <span className="px-2 py-1 bg-destructive/20 text-destructive text-xs rounded-full">Rejected</span>
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
              onClick={() => onReject && onReject(topic.id)}
            >
              Reject
            </Button>
            <Button 
              variant="default" 
              size="sm" 
              className="bg-secondary hover:bg-secondary/90 flex-1"
              onClick={() => onApprove && onApprove(topic.id)}
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
            onClick={() => onSelect && onSelect(topic.id)}
          >
            Select Topic
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
