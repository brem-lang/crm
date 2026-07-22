import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": [
    "authorization",
    "x-client-info",
    "apikey",
    "content-type",
    "api-key",
    "x-api-version",
    // Supabase client metadata headers (sent by some environments)
    "x-supabase-client-platform",
    "x-supabase-client-platform-version",
    "x-supabase-client-runtime",
    "x-supabase-client-runtime-version",
  ].join(", "),
};

interface LeadData {
  firstname: string;
  lastname: string;
  email: string;
  mobile: string;
  country_code: string;
  country?: string;
  ip_address?: string;
  custom1?: string;
  custom2?: string;
  custom3?: string;
  offer_name?: string;
  comment?: string;
  // Live lead scoring signals (optional — sent by frontend form)
  click_ip?: string;
  click_ua?: string;
  time_to_click?: number;
  // Tracking fields
  locale?: string;
  click_id?: string;
  // Notion (Jetpack API) Clients endpoint requires these per-lead
  password?: string;
  currency?: string;
}

interface ApiResponse {
  success: boolean;
  message: string;
  data?: {
    lead_id: string;
    request_id: string | null;
  };
  errors?: Record<string, string>;
  api_version: string;
}

const API_VERSION = '2.0';
const RATE_LIMIT_RPM = 100;

const COUNTRY_LOCALE_MAP: Record<string, string> = {
  US: 'en-US', GB: 'en-GB', UK: 'en-GB', CA: 'en-CA', AU: 'en-AU', NZ: 'en-NZ',
  IE: 'en-IE', ZA: 'en-ZA', NG: 'en-NG', IN: 'en-IN', SG: 'en-SG', MY: 'en-MY',
  FR: 'fr-FR', BE: 'fr-BE', CH: 'fr-CH', LU: 'fr-LU',
  DE: 'de-DE', AT: 'de-AT',
  ES: 'es-ES', MX: 'es-MX', AR: 'es-AR', CO: 'es-CO', CL: 'es-CL', PE: 'es-PE',
  IT: 'it-IT',
  PT: 'pt-PT', BR: 'pt-BR',
  NL: 'nl-NL',
  PL: 'pl-PL',
  RU: 'ru-RU',
  TR: 'tr-TR',
  IL: 'he-IL',
  JP: 'ja-JP',
  KR: 'ko-KR',
  CN: 'zh-CN', TW: 'zh-TW', HK: 'zh-HK',
  SE: 'sv-SE', NO: 'nb-NO', DK: 'da-DK', FI: 'fi-FI',
  GR: 'el-GR', CZ: 'cs-CZ', HU: 'hu-HU', RO: 'ro-RO', SK: 'sk-SK',
  HR: 'hr-HR', BG: 'bg-BG', RS: 'sr-RS', SI: 'sl-SI',
  AE: 'ar-AE', SA: 'ar-SA', EG: 'ar-EG',
  TH: 'th-TH', VN: 'vi-VN', ID: 'id-ID', PH: 'fil-PH',
};

const DISPOSABLE_DOMAINS = new Set([
  'tempmail.com', 'throwaway.com', '10minutemail.com', 'guerrillamail.com',
  'mailinator.com', 'yopmail.com', 'sharklasers.com', 'guerrillamail.info',
  'guerrillamail.biz', 'guerrillamail.de', 'guerrillamail.net', 'guerrillamail.org',
  'spam4.me', 'trashmail.com', 'trashmail.at', 'trashmail.io', 'trashmail.me',
  'trashmail.net', 'trashmail.org', 'dispostable.com', 'maildrop.cc',
  'getairmail.com', 'discard.email', 'tempr.email', 'fakeinbox.com',
  'throwam.com', 'mailnesia.com', 'mailzilla.com', 'spambox.us',
  'tempemail.net', 'emailtemporal.org', 'filzmail.com', 'mailsac.com',
  'temp-mail.org', 'temp-mail.io', 'burnermail.io', 'mohmal.com',
  'mintemail.com', 'spamgourmet.com', 'spamfree24.org', 'spamfree.eu',
]);

async function isRateLimited(supabase: any, affiliateId: string): Promise<boolean> {
  const windowStart = new Date(Date.now() - 60_000).toISOString();
  const { count } = await supabase
    .from('affiliate_api_logs')
    .select('*', { count: 'exact', head: true })
    .eq('endpoint', 'submit-lead')
    .eq('affiliate_id', affiliateId)
    .gte('created_at', windowStart);
  return (count ?? 0) >= RATE_LIMIT_RPM;
}

// Invalid-API-key attempts are logged with affiliate_id: null, so they never
// count against isRateLimited() above — without this, brute-forcing API keys
// is completely unthrottled. Bucket those by request IP instead.
const INVALID_KEY_RATE_LIMIT_PER_IP = 20;
async function isIpRateLimitedForInvalidKeys(supabase: any, clientIp: string): Promise<boolean> {
  const windowStart = new Date(Date.now() - 60_000).toISOString();
  const { count } = await supabase
    .from('affiliate_api_logs')
    .select('*', { count: 'exact', head: true })
    .eq('endpoint', 'submit-lead')
    .is('affiliate_id', null)
    .eq('request_ip', clientIp)
    .gte('created_at', windowStart);
  return (count ?? 0) >= INVALID_KEY_RATE_LIMIT_PER_IP;
}

function getClientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim()
    ?? req.headers.get('cf-connecting-ip')
    ?? req.headers.get('x-real-ip')
    ?? 'unknown';
}

function createResponse(body: ApiResponse, status: number): Response {
  return new Response(
    JSON.stringify(body),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Mirrors submit-lead's validatePhone so v2 enforces the same per-country
// digit-length rules instead of a generic character-class check.
function validatePhone(phone: string, countryCode: string): { valid: boolean; error?: string; cleaned?: string } {
  const cleaned = phone.replace(/\D+/g, '');

  if (cleaned.length < 7) {
    return { valid: false, error: 'Phone number too short (minimum 7 digits)' };
  }
  if (cleaned.length > 15) {
    return { valid: false, error: 'Phone number too long (maximum 15 digits)' };
  }

  const countryPhoneRules: Record<string, { minLength: number; maxLength: number; prefix: string }> = {
    'US': { minLength: 10, maxLength: 10, prefix: '1' },
    'UK': { minLength: 10, maxLength: 10, prefix: '44' },
    'GB': { minLength: 10, maxLength: 10, prefix: '44' },
    'DE': { minLength: 10, maxLength: 11, prefix: '49' },
    'FR': { minLength: 9, maxLength: 9, prefix: '33' },
    'AU': { minLength: 9, maxLength: 9, prefix: '61' },
    'CA': { minLength: 10, maxLength: 10, prefix: '1' },
    'IL': { minLength: 9, maxLength: 9, prefix: '972' },
  };

  const rules = countryPhoneRules[countryCode.toUpperCase()];
  if (rules) {
    let localNumber = cleaned;
    if (cleaned.startsWith(rules.prefix)) {
      localNumber = cleaned.slice(rules.prefix.length);
    }
    if (localNumber.length < rules.minLength) {
      return { valid: false, error: `Phone number too short for ${countryCode} (minimum ${rules.minLength} local digits)` };
    }
    if (localNumber.length > rules.maxLength) {
      return { valid: false, error: `Phone number too long for ${countryCode} (maximum ${rules.maxLength} local digits)` };
    }
    return { valid: true, cleaned };
  }

  return { valid: true, cleaned };
}

function validateLeadData(body: LeadData): Record<string, string> {
  const errors: Record<string, string> = {};

  // Required field validation
  if (!body.firstname?.trim()) errors.firstname = 'First name is required';
  if (!body.lastname?.trim()) errors.lastname = 'Last name is required';
  if (!body.email?.trim()) errors.email = 'Email is required';
  if (!body.mobile?.trim()) errors.mobile = 'Mobile is required';
  if (!body.country_code?.trim()) errors.country_code = 'Country code is required';
  if (!body.ip_address?.trim()) errors.ip_address = 'IP address is required';

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (body.email && !emailRegex.test(body.email.trim())) {
    errors.email = 'Invalid email format';
  }

  // Country code validation (2-letter ISO codes, matching submit-lead)
  const countryCodeRegex = /^[A-Za-z]{2}$/;
  if (body.country_code && !countryCodeRegex.test(body.country_code.trim())) {
    errors.country_code = 'Country code must be a 2-letter ISO code';
  }

  // Mobile validation — same per-country digit-length rules as submit-lead
  if (body.mobile && body.country_code) {
    const phoneValidation = validatePhone(body.mobile, body.country_code.trim());
    if (!phoneValidation.valid) {
      errors.mobile = phoneValidation.error!;
    }
  }

  // Length validations
  if (body.firstname && body.firstname.length > 100) {
    errors.firstname = 'First name must be less than 100 characters';
  }
  if (body.lastname && body.lastname.length > 100) {
    errors.lastname = 'Last name must be less than 100 characters';
  }
  if (body.email && body.email.length > 255) {
    errors.email = 'Email must be less than 255 characters';
  }

  return errors;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return createResponse({
      success: false,
      message: 'Method not allowed',
      api_version: API_VERSION,
    }, 405);
  }

  try {
    // Parse request body
    let body: LeadData | { health_check?: boolean };
    try {
      body = await req.json();
    } catch {
      return createResponse({
        success: false,
        message: 'Invalid JSON body',
        api_version: API_VERSION,
      }, 400);
    }

    // API key is required — even for health checks to prevent unauthenticated probing
    const apiKey = req.headers.get('Api-Key') || req.headers.get('api-key');

    if (!apiKey) {
      return createResponse({
        success: false,
        message: 'API key required. Include Api-Key header.',
        api_version: API_VERSION,
      }, 401);
    }

    // Health check (requires valid API key)
    if ((body as { health_check?: boolean }).health_check === true) {
      return new Response(JSON.stringify({ status: "ok", function: "submit-lead-v2" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create Supabase client with service role for database operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const clientIp = getClientIp(req);
    const submissionUa = req.headers.get('user-agent') || null;

    if (await isIpRateLimitedForInvalidKeys(supabase, clientIp)) {
      return createResponse({
        success: false,
        message: 'Too many invalid API key attempts. Try again later.',
        api_version: API_VERSION,
      }, 429);
    }

    // Validate API key and get affiliate
    const { data: affiliate, error: affiliateError } = await supabase
      .from('affiliates')
      .select('id, name, is_active, allowed_countries, ip_whitelist_required, allowed_ips')
      .eq('api_key', apiKey)
      .eq('is_active', true)
      .is('deleted_at', null)
      .maybeSingle();

    if (affiliateError || !affiliate) {
      try {
        await supabase.from('affiliate_api_logs').insert({
          affiliate_id: null,
          endpoint: 'submit-lead',
          api_key_hint: apiKey.slice(-4),
          request_ip: clientIp,
          payload: null,
          status: 'rejected',
          reason: 'Invalid or inactive API key',
        });
      } catch { /* non-critical */ }
      return createResponse({
        success: false,
        message: 'Invalid or inactive API key',
        api_version: API_VERSION,
      }, 401);
    }

    // IP whitelist check
    if (affiliate.ip_whitelist_required) {
      const allowed = affiliate.allowed_ips ?? [];
      const ipBlocked = allowed.length === 0 || !allowed.includes(clientIp);
      if (ipBlocked) {
        const reason = allowed.length === 0
          ? 'IP whitelist is enabled but no IPs are configured'
          : `IP not whitelisted: ${clientIp}`;
        try {
          await supabase.from('affiliate_api_logs').insert({
            affiliate_id: affiliate.id,
            endpoint: 'submit-lead',
            api_key_hint: apiKey.slice(-4),
            request_ip: clientIp,
            payload: null,
            status: 'rejected',
            reason,
          });
        } catch { /* non-critical */ }
        return new Response(
          JSON.stringify({
            success: false,
            message: 'IP not authorized',
            rejection: {
              code: 'IP_NOT_WHITELISTED',
              message: reason,
              detected_ip: clientIp,
            },
            api_version: API_VERSION,
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Rate limiting: max 100 requests per minute per affiliate
    if (await isRateLimited(supabase, affiliate.id)) {
      return createResponse({
        success: false,
        message: 'Rate limit exceeded. Maximum 100 requests per minute.',
        api_version: API_VERSION,
      }, 429);
    }

    // Body already parsed above for health check - cast to LeadData
    const leadData = body as LeadData;
    
    // Validate lead data
    const errors = validateLeadData(leadData);

    if (Object.keys(errors).length > 0) {
      return createResponse({
        success: false,
        message: 'Validation failed',
        errors,
        api_version: API_VERSION,
      }, 422);
    }

    // Disposable email check
    const emailDomain = leadData.email.trim().split('@')[1]?.toLowerCase();
    if (emailDomain && DISPOSABLE_DOMAINS.has(emailDomain)) {
      return createResponse({
        success: false,
        message: 'Disposable email addresses are not accepted',
        errors: { email: 'Disposable email not allowed' },
        api_version: API_VERSION,
      }, 422);
    }

    // Check if affiliate is allowed to send leads from this country
    // allowed_countries: null = all countries, [] = none, ['US', 'UK'] = only these
    const normalizedCountryCode = leadData.country_code.trim().toUpperCase();
    if (affiliate.allowed_countries !== null) {
      const allowedCountries = Array.isArray(affiliate.allowed_countries) ? affiliate.allowed_countries : [];
      if (!allowedCountries.includes(normalizedCountryCode)) {
        return createResponse({
          success: false,
          message: `Country '${normalizedCountryCode}' is not allowed for your affiliate account`,
          rejection: {
            code: 'COUNTRY_NOT_ALLOWED',
            message: `Your affiliate account is not authorized to send leads from country '${normalizedCountryCode}'`,
            details: allowedCountries.length > 0 ? `Allowed countries: ${allowedCountries.join(', ')}` : 'No countries are configured for this affiliate. Contact support.',
          },
          api_version: API_VERSION,
        }, 422);
      }
    }

    // Check for duplicate email
    const normalizedEmail = leadData.email.trim().toLowerCase();
    const { data: existingLead } = await supabase
      .from('leads')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existingLead) {
      return createResponse({
        success: false,
        message: 'Email already exists',
        errors: { email: 'Duplicate email' },
        api_version: API_VERSION,
      }, 409);
    }

    // Check for duplicate IP address (client-supplied, required by validateLeadData above)
    const submittedIp = leadData.ip_address!.trim();
    const { data: existingIpLead } = await supabase
      .from('leads')
      .select('id')
      .eq('ip_address', submittedIp)
      .maybeSingle();

    if (existingIpLead) {
      return createResponse({
        success: false,
        message: 'IP address already exists',
        errors: { ip_address: 'Duplicate IP address' },
        api_version: API_VERSION,
      }, 409);
    }

    // Generate request_id here so the API response and DB value are guaranteed identical
    const requestId = crypto.randomUUID();

    // Create the lead
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert({
        firstname: leadData.firstname.trim(),
        lastname: leadData.lastname.trim(),
        email: normalizedEmail,
        mobile: leadData.mobile.replace(/\D+/g, ''), // Strip non-digits
        country_code: leadData.country_code.trim().toUpperCase(),
        country: leadData.country?.trim() || null,
        ip_address: submittedIp,
        affiliate_id: affiliate.id,
        custom1: leadData.custom1?.substring(0, 255) || null,
        custom2: leadData.custom2?.substring(0, 255) || null,
        custom3: leadData.custom3?.substring(0, 255) || null,
        offer_name: leadData.offer_name?.substring(0, 100) || null,
        comment: leadData.comment?.substring(0, 500) || null,
        status: 'new',
        request_id: requestId,
        click_ip: leadData.click_ip?.trim() || null,
        click_ua: leadData.click_ua?.substring(0, 500) || null,
        time_to_click: typeof leadData.time_to_click === 'number' ? Math.round(leadData.time_to_click) : null,
        locale: leadData.locale?.substring(0, 20) || COUNTRY_LOCALE_MAP[leadData.country_code.trim().toUpperCase()] || null,
        click_id: leadData.click_id?.substring(0, 255) || null,
        submission_ua: submissionUa?.substring(0, 500) || null,
        password: leadData.password?.substring(0, 255) || null,
        currency: leadData.currency?.substring(0, 10) || null,
      })
      .select('id')
      .single();

    if (leadError) {
      // Unique violation on the email index means a concurrent request for the
      // same email won the race between the duplicate check above and this
      // insert — treat it the same as the earlier duplicate check.
      if (leadError.code === '23505') {
        return createResponse({
          success: false,
          message: 'Email already exists',
          errors: { email: 'Duplicate email' },
          api_version: API_VERSION,
        }, 409);
      }

      console.error('Lead creation error:', leadError);
      return createResponse({
        success: false,
        message: 'Failed to create lead',
        errors: { database: leadError.message },
        api_version: API_VERSION,
      }, 500);
    }

    // Log accepted request
    try {
      await supabase.from('affiliate_api_logs').insert({
        affiliate_id: affiliate.id,
        endpoint: 'submit-lead',
        api_key_hint: apiKey.slice(-4),
        request_ip: clientIp,
        payload: body,
        status: 'accepted',
        reason: null,
      });
    } catch { /* non-critical */ }

    // Queue for async distribution. Inserting to lead_queue decouples submission
    // throughput from distribution latency — the API returns instantly and the
    // processor handles distribution in the background with automatic retries.
    try {
      await supabase.from('lead_queue').insert({ lead_id: lead.id });
      // Fire-and-forget: trigger the processor without blocking the response
      fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/process-lead-queue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({ batch_size: 10 }),
      }).catch(() => { /* processor will pick it up on next invocation */ });
    } catch { /* lead is saved — queue insertion is best-effort */ }

    // Return success response
    return createResponse({
      success: true,
      message: 'Lead submitted successfully',
      data: {
        lead_id: lead.id,
        request_id: requestId,
      },
      api_version: API_VERSION,
    }, 201);

  } catch (error) {
    console.error('Unexpected error:', error);
    return createResponse({
      success: false,
      message: 'An unexpected error occurred',
      api_version: API_VERSION,
    }, 500);
  }
});
