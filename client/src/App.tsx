import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import Dashboard from "@/pages/dashboard";
import Projects from "@/pages/projects";
import ApproveTopics from "@/pages/approve-topics";
import TrackProgress from "@/pages/track-progress";
import UserManagement from "@/pages/user-management";
import Settings from "@/pages/settings";
import { ProtectedRoute } from "./lib/protected-route";
import { AuthProvider } from "@/hooks/use-auth";
import { UserRole } from "@shared/schema";

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={Dashboard} />
      <ProtectedRoute path="/projects" component={Projects} />
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
        allowedRoles={[UserRole.ADMIN]}
      />
      <ProtectedRoute path="/settings" component={Settings} />
      <Route path="/auth" component={AuthPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
