import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type ActivityItemProps = {
  icon: ReactNode;
  iconBgColor: string;
  message: string;
  timestamp: string;
};

export default function ActivityItem({
  icon,
  iconBgColor,
  message,
  timestamp,
}: ActivityItemProps) {
  return (
    <div className="flex items-start space-x-3 pb-4 border-b border-border">
      <div className={cn("p-2 rounded-full", iconBgColor)}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium">{message}</p>
        <p className="text-xs text-muted-foreground">{timestamp}</p>
      </div>
    </div>
  );
}
