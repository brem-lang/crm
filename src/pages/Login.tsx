import { LoginForm } from "@/components/auth/LoginForm";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";

export default function Login() {
  const { user, loading, isChatSupport } = useAuth();

  if (loading) return null;
  if (user && isChatSupport) return <Navigate to="/agent/dashboard" replace />;
  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
      <LoginForm />
    </div>
  );
}