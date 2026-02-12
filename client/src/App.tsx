import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import Dashboard from "@/pages/dashboard";
import Projects from "@/pages/projects";
import Topics from "@/pages/topics";
import StudentTopics from "@/pages/student-topics";
import ApproveTopics from "@/pages/approve-topics";
import TrackProgress from "@/pages/track-progress";
import UserManagement from "@/pages/user-management";
import Settings from "@/pages/settings";
import Notifications from "@/pages/notifications";
import { ProtectedRoute } from "./lib/protected-route";
import { AuthProvider } from "@/hooks/use-auth";
import { UserRole } from "@shared/schema";
import { ThemeProvider } from "@/components/theme-provider";
import TeacherEvaluations from "@/pages/teacher-evaluations";
import StudentGroups from "@/pages/student-groups";
import SystemManagement from "@/pages/system-management";
import CreatorInfoPage from "@/pages/creator-info";

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={Dashboard} />
      <ProtectedRoute path="/projects" component={Projects} />
      <ProtectedRoute
        path="/topics"
        component={Topics}
        allowedRoles={[UserRole.TEACHER]}
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
        path="/teacher-evaluations"
        component={TeacherEvaluations}
        allowedRoles={[UserRole.TEACHER]}
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
      <ProtectedRoute path="/settings" component={Settings} />
      <ProtectedRoute path="/notifications" component={Notifications} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/about" component={CreatorInfoPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="integral-ui-theme">
        <AuthProvider>
          <Router />
          <Toaster />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
