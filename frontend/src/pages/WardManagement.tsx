import React from 'react';
import { Navigate } from 'react-router-dom';

/**
 * Ward Management is merged into the unified Constituency & Ward Management screen.
 * This component provides seamless backward compatibility by redirecting to the wards tab.
 */
export const WardManagement: React.FC = () => {
  return <Navigate to="/constituency-management?tab=wards" replace />;
};
