import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { DocumentProvider } from './contexts/DocumentContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AppSidebar } from './components/layout/AppSidebar';
import { TopNavbar } from './components/layout/TopNavbar';

// Pages
import { LoginPage } from './pages/LoginPage';
import { AdminDashboard } from './pages/AdminDashboard';
import { UserDashboard } from './pages/UserDashboard';
import { UserManagement } from './pages/UserManagement';
import { ProfilePage } from './pages/ProfilePage';
import { UploadPDF } from './pages/UploadPDF';
import { DocumentsPage } from './pages/Documents';
import { ExtractedData } from './pages/ExtractedData';
import { VoterEntriesPage } from './pages/VoterEntriesPage';
import { PaymentsDashboard } from './pages/PaymentsDashboard';
import { Settings } from './pages/Settings';
import { ConstituencyManagement } from './pages/ConstituencyManagement';
import { UserAssignmentsPage } from './pages/UserAssignmentsPage';
import { ReportsExportPage } from './pages/ReportsExportPage';
import { VoterVerificationPage } from './pages/VoterVerificationPage';

const RootRedirect: React.FC = () => {
  const { isAuthenticated, isUser, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-xs text-slate-400">
        Loading workspace...
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to={isUser ? '/voter-verification' : '/admin/dashboard'} replace />;
};

function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { isAuthenticated, isUser, isLoading } = useAuth();
  const isLoginPage = location.pathname === '/login';

  // If loading session state, show centered spinner
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-xs text-slate-400">
        Loading VMS workspace...
      </div>
    );
  }

  // Standalone layout for Login page or unauthenticated state
  if (isLoginPage || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-center items-center font-sans transition-colors duration-200">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      {/* Sidebar Navigation (Hidden for standard User role) */}
      {!isUser && <AppSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />}

      {/* Main Layout Area */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all ${isUser ? '' : 'lg:pl-64'}`}>
        <TopNavbar onOpenSidebar={() => setSidebarOpen(true)} />

        <main className={`flex-1 p-4 sm:p-6 lg:p-8 ${isUser ? 'max-w-4xl' : 'max-w-7xl'} w-full mx-auto`}>
          <Routes>
            {/* Root routing */}
            <Route path="/" element={<RootRedirect />} />
            <Route path="/dashboard" element={<RootRedirect />} />

            {/* Public Auth Route */}
            <Route path="/login" element={<LoginPage />} />

            {/* Voter Verification (Single Screen for User role, also accessible to Admins) */}
            <Route
              path="/voter-verification"
              element={
                <ProtectedRoute allowedRoles={['user', 'admin', 'super_admin']}>
                  <VoterVerificationPage />
                </ProtectedRoute>
              }
            />
            <Route path="/verify" element={<Navigate to="/voter-verification" replace />} />

            {/* Role-Based Dashboards */}
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin']}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/user/dashboard"
              element={
                <Navigate to="/voter-verification" replace />
              }
            />

            {/* Administrative User & Role Management */}
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin']}>
                  <UserManagement />
                </ProtectedRoute>
              }
            />
            <Route path="/users" element={<Navigate to="/admin/users" replace />} />
            <Route path="/admin/roles" element={<Navigate to="/admin/users?tab=roles" replace />} />
            <Route path="/roles" element={<Navigate to="/admin/users?tab=roles" replace />} />

            {/* Geographic Master Management & Assignments */}
            <Route
              path="/constituency-management"
              element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin']}>
                  <ConstituencyManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ward-management"
              element={<Navigate to="/constituency-management?tab=wards" replace />}
            />
            <Route
              path="/user-assignments"
              element={<Navigate to="/constituency-management?tab=assignments" replace />}
            />
            <Route
              path="/geographic-assignments"
              element={<Navigate to="/constituency-management?tab=assignments" replace />}
            />

            {/* Document Management (Super Admin & Admin Only) */}
            <Route
              path="/upload"
              element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin']}>
                  <UploadPDF />
                </ProtectedRoute>
              }
            />
            <Route
              path="/documents"
              element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin']}>
                  <DocumentsPage />
                </ProtectedRoute>
              }
            />

            {/* Voter Records & Entry Management (Administrative Roles) */}
            <Route
              path="/extracted-data"
              element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin']}>
                  <ExtractedData />
                </ProtectedRoute>
              }
            />
            <Route path="/voters" element={<Navigate to="/extracted-data" replace />} />

            <Route
              path="/voter-entries"
              element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin']}>
                  <VoterEntriesPage />
                </ProtectedRoute>
              }
            />
            <Route path="/voter-entry" element={<Navigate to="/voter-entries" replace />} />
            <Route path="/voter-search" element={<Navigate to="/voter-entries" replace />} />

            {/* Payments Dashboard (Super Admin & Admin) */}
            <Route
              path="/payments"
              element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin']}>
                  <PaymentsDashboard />
                </ProtectedRoute>
              }
            />

            {/* Reports & Export redirect to unified Payments & Reports tab */}
            <Route
              path="/reports"
              element={<Navigate to="/payments?tab=reports" replace />}
            />

            {/* User Profile */}
            <Route
              path="/profile"
              element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin']}>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />

            {/* Settings (Super Admin Only) */}
            <Route
              path="/settings"
              element={
                <ProtectedRoute allowedRoles={['super_admin']}>
                  <Settings />
                </ProtectedRoute>
              }
            />

            {/* Legacy aliases */}
            <Route path="/reader" element={<Navigate to="/extracted-data" replace />} />
            <Route path="/text" element={<Navigate to="/extracted-data" replace />} />
            <Route path="/tables" element={<Navigate to="/extracted-data" replace />} />
            <Route path="/ocr" element={<Navigate to="/extracted-data" replace />} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <DocumentProvider>
          <BrowserRouter>
            <AppLayout />
          </BrowserRouter>
        </DocumentProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
