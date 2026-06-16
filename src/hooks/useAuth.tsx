import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

type AppRole = 'super_admin' | 'manager' | 'agent' | 'affiliate';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  customRoleNames: string[];
  loading: boolean;
  username: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithUsername: (usernameOrEmail: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  isSuperAdmin: boolean;
  isManager: boolean;
  isAgent: boolean;
  isAffiliate: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [customRoleNames, setCustomRoleNames] = useState<string[]>([]);
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchUserData = async (userId: string) => {
    try {
      const [rolesRes, customRolesRes, profileRes] = await Promise.all([
        supabase.from('user_roles').select('role').eq('user_id', userId),
        supabase
          .from('user_custom_roles')
          .select('roles(name)')
          .eq('user_id', userId),
        supabase.from('profiles').select('username').eq('id', userId).maybeSingle(),
      ]);

      if (rolesRes.error) throw rolesRes.error;
      setRoles((rolesRes.data?.map(r => r.role) || []) as AppRole[]);

      const names = ((customRolesRes.data || []) as any[])
        .map(r => r.roles?.name)
        .filter(Boolean) as string[];
      setCustomRoleNames(names);

      if (profileRes.error) throw profileRes.error;
      setUsername(profileRes.data?.username || null);
    } catch (error) {
      console.error('Error fetching user data:', error);
      setRoles([]);
      setCustomRoleNames([]);
      setUsername(null);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Use setTimeout to avoid Supabase deadlock
          setTimeout(() => fetchUserData(session.user.id), 0);

          // Log successful login
          if (event === 'SIGNED_IN') {
            setTimeout(async () => {
              try {
                await supabase.from('audit_logs').insert({
                  user_id: session.user.id,
                  user_email: session.user.email ?? null,
                  action: 'login',
                  changes_summary: `User signed in: ${session.user.email}`,
                  request_path: window.location.pathname,
                });
              } catch { /* non-critical */ }
            }, 0);
          }
        } else {
          setRoles([]);
          setCustomRoleNames([]);
          setUsername(null);
        }
        setLoading(false);
      }
    );

    // THEN check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    toast.success("Signed in successfully");
    navigate("/dashboard");
  };

  const toSafeAuthError = (error: unknown) => {
    const message =
      typeof error === "object" && error && "message" in error
        ? String((error as any).message)
        : "";

    // Only surface actionable, non-sensitive auth errors.
    const allowlist = [
      "Email not confirmed",
      "Invalid login credentials",
      "Email rate limit exceeded",
      "Too many requests",
    ];

    const allowed = allowlist.find((m) => message.toLowerCase().includes(m.toLowerCase()));
    return new Error(allowed ?? "Invalid username or password");
  };

  const signInWithUsername = async (usernameOrEmail: string, password: string) => {
    const identifier = usernameOrEmail.trim();
    if (!identifier) throw new Error("Invalid username or password");

    // If user typed an email, skip the username lookup.
    if (identifier.includes("@")) {
      const { error } = await supabase.auth.signInWithPassword({ email: identifier, password });
      if (error) throw toSafeAuthError(error);
      toast.success("Signed in successfully");
      navigate("/dashboard");
      return;
    }

    // Look up email by username using security definer function (bypasses RLS for anon)
    const { data: email, error: lookupError } = await supabase
      .rpc("get_email_by_username", { lookup_username: identifier });

    if (lookupError || !email) {
      throw new Error("Invalid username or password");
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw toSafeAuthError(error);
    toast.success("Signed in successfully");
    navigate("/dashboard");
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName }
      }
    });
    if (error) throw error;
    toast.success("Account created successfully");
    navigate("/dashboard");
  };

  const signOut = async () => {
    // Log before session is destroyed
    if (user) {
      try {
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          user_email: user.email ?? null,
          action: 'logout',
          changes_summary: `User signed out: ${user.email}`,
          request_path: window.location.pathname,
        });
      } catch { /* non-critical */ }
    }
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setRoles([]);
    setCustomRoleNames([]);
    setUsername(null);
    toast.success("Signed out successfully");
    navigate("/login");
  };

  const isSuperAdmin = roles.includes('super_admin');
  const isManager = roles.includes('manager');
  const isAgent = roles.includes('agent');
  const isAffiliate = roles.includes('affiliate');

  return (
    <AuthContext.Provider value={{
      user,
      session,
      roles,
      customRoleNames,
      username,
      loading,
      signIn,
      signInWithUsername,
      signUp,
      signOut,
      isSuperAdmin,
      isManager,
      isAgent,
      isAffiliate,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}