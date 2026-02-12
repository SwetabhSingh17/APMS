import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { UserRole } from "@shared/schema";
import { cn } from "@/lib/utils";
import {
  Home,
  FileText,
  CheckCircle,
  BarChart2,
  Users,
  Settings,
  LogOut,
  BookOpen,
  Bell,
  ClipboardCheck,
  Database
} from "lucide-react";

export default function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose?: () => void }) {
  const { user, logoutMutation } = useAuth();
  const [location] = useLocation();

  const userInitials = user ?
    `${user.firstName.charAt(0)}${user.lastName.charAt(0)}` :
    "NA";

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const linkClass = (path: string) => {
    const isActive = window.location.pathname === path;
    return `flex items-center space-x-3 px-3 py-2 rounded-md transition-colors ${isActive
      ? 'bg-primary/10 text-primary'
      : 'text-muted-foreground hover:bg-muted'
      }`;
  };

  const displayRole = (role: string) => {
    switch (role) {
      case UserRole.ADMIN:
        return "Admin";
      case UserRole.COORDINATOR:
        return "Coordinator";
      case UserRole.TEACHER:
        return "Teacher";
      case UserRole.STUDENT:
        return "Student";
      default:
        return role;
    }
  };

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  return (
    <div className={cn(
      "flex flex-col w-64 bg-card border-r border-border h-full fixed md:static z-40 transition-transform duration-300 md:translate-x-0",
      isOpen ? "translate-x-0" : "-translate-x-full"
    )}>
      <div className="p-4 border-b border-border">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-lg">IU</span>
          </div>
          <div>
            <h1 className="font-bold text-primary text-lg">Project Portal</h1>
            <p className="text-xs text-muted-foreground">Integral University</p>
          </div>
        </div>
      </div>

      {user && (
        <div className="p-4 border-b border-border">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <span className="text-foreground font-bold">{userInitials}</span>
            </div>
            <div>
              <p className="font-medium">{`${user.firstName} ${user.lastName}`}</p>
              <span className="inline-block px-2 py-1 text-xs bg-primary text-primary-foreground rounded-full">
                {displayRole(user.role)}
              </span>
            </div>
          </div>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto py-4">
        <div className="px-3 mb-3 text-xs font-semibold text-muted-foreground uppercase">Main Navigation</div>

        <Link href="/" onClick={isMobile ? onClose : undefined} className={linkClass("/")}>
          <Home className="w-5 h-5" />
          <span>Dashboard</span>
        </Link>

        <Link href="/projects" onClick={isMobile ? onClose : undefined} className={linkClass("/projects")}>
          <FileText className="w-5 h-5" />
          <span>Projects</span>
        </Link>

        {user?.role === UserRole.STUDENT && (
          <>
            <Link href="/student-topics" onClick={isMobile ? onClose : undefined} className={linkClass("/student-topics")}>
              <BookOpen className="w-5 h-5" />
              <span>Topics</span>
            </Link>
            <Link href="/student-groups" onClick={isMobile ? onClose : undefined} className={linkClass("/student-groups")}>
              <Users className="w-5 h-5" />
              <span>Groups</span>
            </Link>
          </>
        )}

        {user?.role === UserRole.TEACHER && (
          <>
            <Link href="/topics" onClick={isMobile ? onClose : undefined} className={linkClass("/topics")}>
              <FileText className="w-5 h-5" />
              <span>Topics</span>
            </Link>
            <Link href="/teacher-evaluations" onClick={isMobile ? onClose : undefined} className={linkClass("/teacher-evaluations")}>
              <ClipboardCheck className="w-5 h-5" />
              <span>Evaluations</span>
            </Link>
          </>
        )}

        {(user?.role === UserRole.COORDINATOR || user?.role === UserRole.ADMIN) && (
          <Link href="/approve-topics" onClick={isMobile ? onClose : undefined} className={linkClass("/approve-topics")}>
            <CheckCircle className="w-5 h-5" />
            <span>Approve Topics</span>
          </Link>
        )}

        {(user?.role === UserRole.COORDINATOR || user?.role === UserRole.ADMIN) && (
          <Link href="/track-progress" onClick={isMobile ? onClose : undefined} className={linkClass("/track-progress")}>
            <BarChart2 className="w-5 h-5" />
            <span>Track Progress</span>
          </Link>
        )}

        {(user?.role === UserRole.COORDINATOR || user?.role === UserRole.ADMIN) && (
          <>
            <div className="px-3 mt-6 mb-3 text-xs font-semibold text-muted-foreground uppercase">Management</div>

            <Link href="/user-management" onClick={isMobile ? onClose : undefined} className={linkClass("/user-management")}>
              <Users className="w-5 h-5" />
              <span>User Management</span>
            </Link>

            {user?.role === UserRole.ADMIN && (
              <Link href="/system-management" onClick={isMobile ? onClose : undefined} className={linkClass("/system-management")}>
                <Database className="w-5 h-5" />
                <span>System Management</span>
              </Link>
            )}
          </>
        )}

        <Link href="/settings" onClick={isMobile ? onClose : undefined} className={linkClass("/settings")}>
          <Settings className="w-5 h-5" />
          <span>Settings</span>
        </Link>

        <Link href="/notifications" onClick={isMobile ? onClose : undefined} className={linkClass("/notifications")}>
          <Bell className="w-5 h-5" />
          <span>Notifications</span>
        </Link>
      </nav>

      <div className="p-4 border-t border-border">
        <button
          onClick={handleLogout}
          className="flex items-center space-x-3 text-foreground hover:text-destructive"
          disabled={logoutMutation.isPending}
        >
          <LogOut className="w-5 h-5" />
          <span>{logoutMutation.isPending ? "Logging out..." : "Logout"}</span>
        </button>
      </div>
    </div>
  );
}
