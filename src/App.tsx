import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { RoleHomeRedirect } from "@/components/auth/RoleHomeRedirect";
import { isTeachingEnabled } from "@/config/featureMode";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Activation from "./pages/Activation";
import Admin from "./pages/Admin";
import LoginPage from "./pages/LoginPage";
import ForbiddenPage from "./pages/ForbiddenPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import TeacherDashboardPage from "./pages/TeacherDashboardPage";
import TeacherStudioPage from "./pages/TeacherStudioPage";
import TeacherSubmissionCanvasPage from "./pages/TeacherSubmissionCanvasPage";
import StudentDashboardPage from "./pages/StudentDashboardPage";
import StudentWorkspacePage from "./pages/StudentWorkspacePage";
import { LicenseGuard } from "./components/LicenseGuard";

const queryClient = new QueryClient();

const App = () => {
  const teachingEnabled = isTeachingEnabled();

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {teachingEnabled ? (
              <>
                <Route path="/" element={<RoleHomeRedirect />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/403" element={<ForbiddenPage />} />
                <Route path="/simulator" element={<Index />} />
                <Route
                  path="/admin"
                  element={
                    <RequireAuth allowedRoles={["admin"]}>
                      <AdminDashboardPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/teacher"
                  element={
                    <RequireAuth allowedRoles={["teacher"]}>
                      <TeacherDashboardPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/teacher/studio"
                  element={
                    <RequireAuth allowedRoles={["teacher"]}>
                      <TeacherStudioPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/teacher/submissions/:submissionId/canvas"
                  element={
                    <RequireAuth allowedRoles={["teacher"]}>
                      <TeacherSubmissionCanvasPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/student"
                  element={
                    <RequireAuth allowedRoles={["student"]}>
                      <StudentDashboardPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/student/workspace/:assignmentId"
                  element={
                    <RequireAuth allowedRoles={["student"]}>
                      <StudentWorkspacePage />
                    </RequireAuth>
                  }
                />
                <Route path="/activation" element={<Activation />} />
                <Route path="/license-admin" element={<Admin />} />
              </>
            ) : (
              <>
                <Route
                  path="/"
                  element={
                    <LicenseGuard>
                      <Index />
                    </LicenseGuard>
                  }
                />
                <Route path="/activation" element={<Activation />} />
                <Route path="/admin" element={<Admin />} />
              </>
            )}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
