import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { UserRole } from '../../types/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
  allowedRoles,
}) => {
  const { isAuthenticated, user, isSuperAdmin, isAdmin, isAdministrative, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-8">
        <LoadingSpinner label="Verifying authentication & permissions..." />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const normalizedUserRole = (user.role === ('superadmin' as any) ? 'super_admin' : user.role) as UserRole;

  // Enforce Single Screen access for standard User role
  if (normalizedUserRole === 'user' && location.pathname !== '/voter-verification' && location.pathname !== '/verify') {
    return <Navigate to="/voter-verification" replace />;
  }

  // Determine authorized roles
  let permitted = true;
  let requiredRoleLabel = 'Administrator';

  if (allowedRoles && allowedRoles.length > 0) {
    permitted = allowedRoles.includes(normalizedUserRole);
    requiredRoleLabel = allowedRoles.map(r => r === 'super_admin' ? 'Super Admin' : (r === 'admin' ? 'Admin' : 'User')).join(' or ');
  } else if (requiredRole) {
    if (requiredRole === 'super_admin') {
      permitted = isSuperAdmin;
      requiredRoleLabel = 'Super Administrator';
    } else if (requiredRole === 'admin') {
      permitted = isAdministrative; // Both Super Admin and Admin can access standard admin routes
      requiredRoleLabel = 'Administrator';
    } else if (requiredRole === 'user') {
      permitted = true; // All authenticated users
    }
  }

  if (!permitted) {
    const returnDashboard = isAdministrative ? '/admin/dashboard' : '/user/dashboard';
    return (
      <div className="max-w-lg mx-auto my-12 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/40 rounded-3xl p-8 text-center shadow-lg">
        <div className="w-16 h-16 bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Access Denied</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
          Your current account role (<span className="font-semibold text-rose-600 dark:text-rose-400 uppercase">{user.role}</span>) does not have authorization to access this module.
        </p>
        <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-6">
          Required access level: <span className="font-medium text-slate-700 dark:text-slate-300">{requiredRoleLabel}</span>
        </p>
        <Link
          to={returnDashboard}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-brand-500/20"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Authorized Dashboard</span>
        </Link>
      </div>
    );
  }

  return <>{children}</>;
};
