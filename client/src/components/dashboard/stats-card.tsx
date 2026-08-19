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
  onClick?: () => void;
};

export default function StatsCard({
  title,
  value,
  icon,
  iconBgColor,
  borderColor,
  change,
  onClick,
}: StatsCardProps) {
  const getBorderColorClass = (color: string) => {
    switch (color) {
      case 'primary':
        return 'border-primary';
      case 'secondary':
        return 'border-secondary';
      case 'accent':
        return 'border-accent';
      case 'destructive':
        return 'border-destructive';
      default:
        return 'border-primary';
    }
  };

  return (
    <Card 
      className={cn(
        "p-4 border-l-4", 
        getBorderColorClass(borderColor),
        onClick && "cursor-pointer hover:shadow-md transition-shadow duration-200 hover:opacity-90"
      )}
      onClick={onClick}
    >
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
            "text-sm text-muted-foreground"
          )}>
            <span className="font-medium">{change.value}</span> {change.label}
          </span>
        </div>
      )}
    </Card>
  );
}
