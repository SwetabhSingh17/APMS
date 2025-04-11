import { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatsCardProps = {
  title: string;
  value: string | number;
  icon: ReactNode;
  iconBgColor: string;
  borderColor: string;
  change?: {
    value: string;
    label: string;
    positive?: boolean;
  };
};

export default function StatsCard({
  title,
  value,
  icon,
  iconBgColor,
  borderColor,
  change,
}: StatsCardProps) {
  return (
    <Card className={cn("p-4 border-l-4", `border-l-${borderColor}`)}>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-muted-foreground text-sm">{title}</p>
          <h3 className="text-2xl font-bold text-foreground">{value}</h3>
        </div>
        <div className={cn("p-2 rounded-lg", iconBgColor)}>
          {icon}
        </div>
      </div>
      {change && (
        <div className="mt-2">
          <span className={cn(
            "text-sm",
            change.positive ? "text-secondary" : "text-accent"
          )}>
            <span className="font-medium">{change.value}</span> {change.label}
          </span>
        </div>
      )}
    </Card>
  );
}
