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
import { ExtractedData } from './pages/ExtractedData';
import { VoterEntriesPage } from './pages/VoterEntriesPage';
import { PaymentsDashboard } from './pages/PaymentsDashboard';
import { Settings } from './pages/Settings';

const RootRedirect: React.FC = () => {
  const { isAuthenticated, isAdmin, isLoading } = useAuth();
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
  return <Navigate to={isAdmin ? '/admin/dashboard' : '/user/dashboard'} replace />;
};

function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { isAuthenticated, isLoading } = useAuth();
  const isLoginPage = location.pathname === '/login';

  // If loading session state, show centered spinner
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-xs text-slate-400">
        Loading VMS workspace...
      </div>
    );
  }

  // Dedicated standalone layout for Login page or unauthenticated state (no sidebar, no navbar, full screen centered)
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
      {/* Sidebar Navigation */}
      <AppSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Layout Area */}
      <div className="flex-1 flex flex-col lg:pl-64 min-w-0 transition-all">
        <TopNavbar onOpenSidebar={() => setSidebarOpen(true)} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Routes>
            {/* Root routing */}
            <Route path="/" element={<RootRedirect />} />
            <Route path="/dashboard" element={<RootRedirect />} />

            {/* Public Auth Route */}
            <Route path="/login" element={<LoginPage />} />

            {/* Role-Based Dashboards */}
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/user/dashboard"
              element={
                <ProtectedRoute>
                  <UserDashboard />
                </ProtectedRoute>
              }
            />

            {/* Admin-only User Management */}
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute requiredRole="admin">
                  <UserManagement />
                </ProtectedRoute>
              }
            />

            {/* User Profile & Password Change */}
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />

            {/* Core Telugu PDF Processing & Extraction Features */}
            <Route
              path="/upload"
              element={
                <ProtectedRoute>
                  <UploadPDF />
                </ProtectedRoute>
              }
            />
            <Route
              path="/extracted-data"
              element={
                <ProtectedRoute>
                  <ExtractedData />
                </ProtectedRoute>
              }
            />
            <Route
              path="/voter-entries"
              element={
                <ProtectedRoute>
                  <VoterEntriesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/payments"
              element={
                <ProtectedRoute>
                  <PaymentsDashboard />
                </ProtectedRoute>
              }
            />

            {/* Redirect legacy removed routes to Voter Records */}
            <Route path="/documents" element={<Navigate to="/extracted-data" replace />} />
            <Route path="/reader" element={<Navigate to="/extracted-data" replace />} />
            <Route path="/text" element={<Navigate to="/extracted-data" replace />} />
            <Route path="/tables" element={<Navigate to="/extracted-data" replace />} />
            <Route path="/ocr" element={<Navigate to="/extracted-data" replace />} />

            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        <footer className="py-4 px-6 border-t border-slate-200/80 dark:border-slate-800 text-center text-xs text-slate-400">
          VMS · Voter Management System · Smart Voter Data Extraction & Management · Role-Based Access Control (RBAC)
        </footer>
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
