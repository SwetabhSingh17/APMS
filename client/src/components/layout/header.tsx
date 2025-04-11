import { useAuth } from "@/hooks/use-auth";
import { Bell, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

type HeaderProps = {
  onToggleSidebar: () => void;
};

export default function Header({ onToggleSidebar }: HeaderProps) {
  const { user } = useAuth();
  const [location] = useLocation();
  const [title, setTitle] = useState("Dashboard");

  useEffect(() => {
    // Set title based on current path
    switch (location) {
      case "/":
        setTitle("Dashboard");
        break;
      case "/projects":
        setTitle("Projects");
        break;
      case "/approve-topics":
        setTitle("Approve Topics");
        break;
      case "/track-progress":
        setTitle("Track Progress");
        break;
      case "/user-management":
        setTitle("User Management");
        break;
      case "/settings":
        setTitle("Settings");
        break;
      default:
        setTitle("Dashboard");
    }
  }, [location]);

  const userInitials = user ? 
    `${user.firstName.charAt(0)}${user.lastName.charAt(0)}` : 
    "NA";

  return (
    <header className="bg-card border-b border-border">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center space-x-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onToggleSidebar}
            className="md:hidden"
          >
            <Menu className="w-6 h-6" />
          </Button>
          <div className="md:hidden flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">IU</span>
            </div>
            <span className="font-semibold text-primary">Project Portal</span>
          </div>
          <div className="hidden md:block">
            <h2 className="text-xl font-semibold text-foreground">{title}</h2>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" className="relative text-foreground hover:text-primary">
            <Bell className="w-6 h-6" />
            <span className="absolute top-0 right-0 w-2 h-2 bg-destructive rounded-full"></span>
          </Button>
          
          <div className="md:hidden">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <span className="font-medium text-sm">{userInitials}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
