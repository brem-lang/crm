import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CRMType {
  id: string;
  code: string;
  name: string;
  description: string | null;
  default_url: string | null;
  request_format: string;
  auth_type: string;
  auth_header_name: string | null;
  required_fields: string[];
  use_forwarder: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateCRMTypeData {
  code: string;
  name: string;
  description?: string;
  default_url?: string;
  request_format: string;
  auth_type: string;
  auth_header_name?: string;
  required_fields?: string[];
  use_forwarder?: boolean;
  is_active?: boolean;
}

export interface UpdateCRMTypeData extends Partial<CreateCRMTypeData> {
  id: string;
}

const QUERY_KEY = ["crm-types"];

function parseRequiredFields(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((item): item is string => typeof item === 'string');
  return [];
}

export function useCRMTypes() {
  return useQuery({
    queryKey: QUERY_KEY,
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_types")
        .select("id, code, name, description, default_url, request_format, auth_type, auth_header_name, required_fields, use_forwarder, is_active, created_at, updated_at")
        .order("created_at", { ascending: true });

      if (error) throw error;

      return (data || []).map((row) => ({
        ...row,
        required_fields: parseRequiredFields(row.required_fields),
      })) as CRMType[];
    },
  });
}

export function useCreateCRMType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateCRMTypeData) => {
      const { error } = await supabase.from("crm_types").insert({
        code: payload.code,
        name: payload.name,
        description: payload.description || null,
        default_url: payload.default_url || null,
        request_format: payload.request_format,
        auth_type: payload.auth_type,
        auth_header_name: payload.auth_header_name || null,
        required_fields: payload.required_fields ?? [],
        use_forwarder: payload.use_forwarder ?? false,
        is_active: payload.is_active ?? true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("CRM type created");
    },
    onError: (e: Error) => toast.error(e.message || "Failed to create CRM type"),
  });
}

export function useUpdateCRMType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateCRMTypeData) => {
      const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (payload.code !== undefined) update.code = payload.code;
      if (payload.name !== undefined) update.name = payload.name;
      if (payload.description !== undefined) update.description = payload.description || null;
      if (payload.default_url !== undefined) update.default_url = payload.default_url || null;
      if (payload.request_format !== undefined) update.request_format = payload.request_format;
      if (payload.auth_type !== undefined) update.auth_type = payload.auth_type;
      if (payload.auth_header_name !== undefined) update.auth_header_name = payload.auth_header_name || null;
      if (payload.required_fields !== undefined) update.required_fields = payload.required_fields;
      if (payload.use_forwarder !== undefined) update.use_forwarder = payload.use_forwarder;
      if (payload.is_active !== undefined) update.is_active = payload.is_active;

      const { error } = await supabase.from("crm_types").update(update).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("CRM type updated");
    },
    onError: (e: Error) => toast.error(e.message || "Failed to update CRM type"),
  });
}

export function useDeleteCRMType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("crm_types").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("CRM type deleted");
    },
    onError: (e: Error) => toast.error(e.message || "Failed to delete CRM type"),
  });
}

export function useToggleCRMType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("crm_types")
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (e: Error) => toast.error(e.message || "Failed to update CRM type"),
  });
}
