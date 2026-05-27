import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { RoleHomeRedirect } from "@/components/auth/RoleHomeRedirect";
import { isLicenseRequired, isOpenClassEnabled, isTeachingEnabled } from "@/config/featureMode";
import { LicenseGuard } from "./components/LicenseGuard";

const queryClient = new QueryClient();

const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Activation = lazy(() => import("./pages/Activation"));
const Admin = lazy(() => import("./pages/Admin"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const ForbiddenPage = lazy(() => import("./pages/ForbiddenPage"));
const AdminDashboardPage = lazy(() => import("./pages/AdminDashboardPage"));
const TeacherDashboardPage = lazy(() => import("./pages/TeacherDashboardPage"));
const TeacherStudioPage = lazy(() => import("./pages/TeacherStudioPage"));
const TeacherSubmissionCanvasPage = lazy(() => import("./pages/TeacherSubmissionCanvasPage"));
const StudentDashboardPage = lazy(() => import("./pages/StudentDashboardPage"));
const StudentWorkspacePage = lazy(() => import("./pages/StudentWorkspacePage"));
const OpenClassEntryPage = lazy(() => import("./pages/OpenClassEntryPage"));
const TeacherBlankCanvasEntryPage = lazy(() => import("./pages/TeacherBlankCanvasEntryPage"));

function RouteFallback() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
      <div className="rounded-md border bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
        正在加载工作区...
      </div>
    </div>
  );
}

const App = () => {
  const teachingEnabled = isTeachingEnabled();
  const openClassEnabled = isOpenClassEnabled();
  const licenseRequired = isLicenseRequired();
  const routerBasename = import.meta.env.BASE_URL === '/'
    ? undefined
    : import.meta.env.BASE_URL.replace(/\/$/, '');

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter basename={routerBasename}>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              {teachingEnabled ? (
                <>
                  <Route path="/" element={<RoleHomeRedirect />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/teacher-demo-blank" element={<TeacherBlankCanvasEntryPage />} />
                  <Route path="/demo-blank" element={<TeacherBlankCanvasEntryPage />} />
                  {openClassEnabled && (
                    <>
                      <Route path="/openclass" element={<OpenClassEntryPage />} />
                      <Route path="/open-class" element={<OpenClassEntryPage />} />
                    </>
                  )}
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
                      <LicenseGuard requireActivation={licenseRequired}>
                        <Index />
                      </LicenseGuard>
                    }
                  />
                  {openClassEnabled && (
                    <>
                      <Route path="/teacher-demo-blank" element={<TeacherBlankCanvasEntryPage />} />
                      <Route path="/demo-blank" element={<TeacherBlankCanvasEntryPage />} />
                      <Route path="/openclass" element={<OpenClassEntryPage />} />
                      <Route path="/open-class" element={<OpenClassEntryPage />} />
                    </>
                  )}
                  <Route path="/activation" element={<Activation />} />
                  <Route path="/admin" element={<Admin />} />
                </>
              )}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
