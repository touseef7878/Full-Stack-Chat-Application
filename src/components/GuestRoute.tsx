import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useSession } from '@/components/SessionContextProvider';

interface GuestRouteProps {
  children?: React.ReactNode;
}

const GuestRoute: React.FC<GuestRouteProps> = ({ children }) => {
  const { session, isGuest } = useSession();

  // If user has a normal authenticated session, redirect to chat
  if (session && !isGuest) {
    return <Navigate to="/chat" replace />;
  }

  // Allow access for both guest and non-authenticated users
  return children ? <>{children}</> : <Outlet />;
};

export default GuestRoute;