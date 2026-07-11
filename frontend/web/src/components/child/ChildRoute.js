import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useChildAuth } from '../../contexts/ChildAuthContext';

const ChildRoute = () => {
  const { status } = useChildAuth();
  const location = useLocation();

  if (status !== 'authenticated') {
    return <Navigate to="/child/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
};

export default ChildRoute;
