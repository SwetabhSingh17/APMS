type ProgressBarProps = {
  label: string;
  percentage: number;
  color?: string;
};

export default function ProgressBar({ 
  label, 
  percentage, 
  color = "bg-primary" 
}: ProgressBarProps) {
  return (
    <div className="flex flex-col">
      <div className="flex justify-between mb-1">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm text-muted-foreground">{percentage}%</span>
      </div>
      <div className="w-full bg-muted rounded-full h-2">
        <div 
          className={`${color} rounded-full h-2`} 
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
}
