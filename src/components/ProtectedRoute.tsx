import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth, AppRole } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

export const ProtectedRoute = ({
  children,
  roles,
}: {
  children: ReactNode;
  roles?: AppRole[];
}) => {
  const { user, loading, hasRole } = useAuth();
  const loc = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" state={{ from: loc }} replace />;

  if (roles && roles.length > 0 && !roles.some((r) => hasRole(r))) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
