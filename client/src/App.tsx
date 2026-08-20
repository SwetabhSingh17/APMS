import { Switch, Route } from "wouter";
import { lazy, Suspense } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import { ProtectedRoute } from "./lib/protected-route";
import { useAuth } from "./hooks/use-auth";
import { useNotifications } from "./hooks/use-notifications";
import { AuthProvider } from "@/hooks/use-auth";
import { UserRole } from "@shared/schema";
import { ThemeProvider } from "@/components/theme-provider";
import { Loader2 } from "lucide-react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { CourseFilterProvider } from "@/hooks/course-filter-context";

// Lazy-loaded routes
const AuthPage = lazy(() => import("@/pages/auth-page"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const Projects = lazy(() => import("@/pages/projects"));
const Topics = lazy(() => import("@/pages/topics"));
const StudentTopics = lazy(() => import("@/pages/student-topics"));
const ApproveTopics = lazy(() => import("@/pages/approve-topics"));
const TrackProgress = lazy(() => import("@/pages/track-progress"));
const UserManagement = lazy(() => import("@/pages/user-management"));
const Settings = lazy(() => import("@/pages/settings"));
const Notifications = lazy(() => import("@/pages/notifications"));
const SupervisorEvaluations = lazy(() => import("@/pages/supervisor-evaluations"));
const StudentGroups = lazy(() => import("@/pages/student-groups"));
const SystemManagement = lazy(() => import("@/pages/system-management"));
const ManageProject = lazy(() => import("@/pages/manage-project"));
const CreatorInfoPage = lazy(() => import("@/pages/creator-info"));

function PageLoader() {
  return (
    <div className="flex h-screen w-full items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function Router() {
  useNotifications();
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <ProtectedRoute path="/" component={Dashboard} />
        <ProtectedRoute path="/projects" component={Projects} />
        <ProtectedRoute
          path="/topics"
          component={Topics}
          allowedRoles={[UserRole.SUPERVISOR]}
        />
        <ProtectedRoute
          path="/student-topics"
          component={StudentTopics}
          allowedRoles={[UserRole.STUDENT]}
        />
        <ProtectedRoute
          path="/approve-topics"
          component={ApproveTopics}
          allowedRoles={[UserRole.COORDINATOR, UserRole.ADMIN]}
        />
        <ProtectedRoute
          path="/track-progress"
          component={TrackProgress}
          allowedRoles={[UserRole.COORDINATOR, UserRole.ADMIN]}
        />
        <ProtectedRoute
          path="/user-management"
          component={UserManagement}
          allowedRoles={[UserRole.ADMIN, UserRole.COORDINATOR]}
        />
        <ProtectedRoute
          path="/supervisor-evaluations"
          component={SupervisorEvaluations}
          allowedRoles={[UserRole.SUPERVISOR]}
        />
        <ProtectedRoute
          path="/student-groups"
          component={StudentGroups}
          allowedRoles={[UserRole.STUDENT]}
        />
        <ProtectedRoute
          path="/system-management"
          component={SystemManagement}
          allowedRoles={[UserRole.ADMIN]}
        />
        <ProtectedRoute
          path="/manage-project"
          component={ManageProject}
          allowedRoles={[UserRole.COORDINATOR, UserRole.ADMIN]}
        />
        <ProtectedRoute path="/settings" component={Settings} />
        <ProtectedRoute path="/notifications" component={Notifications} />
        <Route path="/auth" component={AuthPage} />
        <Route path="/about" component={CreatorInfoPage} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="system" storageKey="integral-ui-theme">
          <AuthProvider>
            <CourseFilterProvider>
              <Router />
            </CourseFilterProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
