-- Fix all three audit trigger functions to populate user_email via auth.email()
-- Previously user_email was always NULL for trigger-generated rows.

CREATE OR REPLACE FUNCTION public.fn_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_data  jsonb;
  v_new_data  jsonb;
  v_record_id text;
  v_summary   text;
  v_row_json  jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_row_json := to_jsonb(OLD);
    v_old_data := v_row_json - 'password' - 'api_key' - 'service_key' - 'secret';
    v_new_data := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    v_row_json := to_jsonb(NEW);
    v_old_data := NULL;
    v_new_data := v_row_json - 'password' - 'api_key' - 'service_key' - 'secret';
  ELSE
    v_old_data := to_jsonb(OLD) - 'password' - 'api_key' - 'service_key' - 'secret';
    v_new_data := to_jsonb(NEW) - 'password' - 'api_key' - 'service_key' - 'secret';
    v_row_json := to_jsonb(NEW);
  END IF;

  v_record_id := v_row_json ->> 'id';

  v_summary := CASE TG_OP
    WHEN 'INSERT' THEN 'Created record in ' || TG_TABLE_NAME
    WHEN 'UPDATE' THEN 'Updated record in ' || TG_TABLE_NAME
    WHEN 'DELETE' THEN 'Deleted record from ' || TG_TABLE_NAME
  END;

  INSERT INTO public.audit_logs (
    user_id, user_email, action, table_name, record_id, old_data, new_data, changes_summary
  ) VALUES (
    auth.uid(),
    auth.email(),
    lower(TG_OP),
    TG_TABLE_NAME,
    v_record_id,
    v_old_data,
    v_new_data,
    v_summary
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_audit_log_user_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    user_id, user_email, action, table_name, record_id, old_data, new_data, changes_summary
  ) VALUES (
    auth.uid(),
    auth.email(),
    lower(TG_OP),
    'user_roles',
    CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id::text ELSE NEW.user_id::text END,
    CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP != 'DELETE' THEN to_jsonb(NEW) ELSE NULL END,
    CASE TG_OP
      WHEN 'INSERT' THEN 'Assigned role ' || NEW.role || ' to user ' || NEW.user_id::text
      WHEN 'DELETE' THEN 'Removed role ' || OLD.role || ' from user ' || OLD.user_id::text
    END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_audit_log_user_custom_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    user_id, user_email, action, table_name, record_id, old_data, new_data, changes_summary
  ) VALUES (
    auth.uid(),
    auth.email(),
    lower(TG_OP),
    'user_custom_roles',
    CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id::text ELSE NEW.user_id::text END,
    CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP != 'DELETE' THEN to_jsonb(NEW) ELSE NULL END,
    CASE TG_OP
      WHEN 'INSERT' THEN 'Assigned custom role ' || NEW.role_id::text || ' to user ' || NEW.user_id::text
      WHEN 'DELETE' THEN 'Removed custom role ' || OLD.role_id::text || ' from user ' || OLD.user_id::text
    END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;
