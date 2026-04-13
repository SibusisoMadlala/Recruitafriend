import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { logger } from 'npm:hono/logger';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { SmtpClient } from 'https://deno.land/x/smtp@v0.7.0/mod.ts';

const app = new Hono();

type LegacyWriter = {
  write: (chunk: Uint8Array) => Promise<number> | number;
};

type DenoCompat = typeof Deno & {
  writeAll?: (writer: LegacyWriter, data: Uint8Array) => Promise<void>;
};

const denoCompat = Deno as DenoCompat;

if (typeof denoCompat.writeAll !== 'function') {
  denoCompat.writeAll = async (writer: LegacyWriter, data: Uint8Array) => {
    let written = 0;
    while (written < data.length) {
      const bytesWritten = await writer.write(data.subarray(written));
      if (!Number.isFinite(bytesWritten) || bytesWritten <= 0) {
        throw new Error('Failed to write SMTP payload');
      }
      written += bytesWritten;
    }
  };
}

// Middleware
app.use('*', cors());
app.use('*', logger(console.log));

// Supabase service-role client â€” bypasses RLS (all server-side operations)
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

function getDb() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

function getPublicAuthClient() {
  const anonKey = getEnv('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) {
    throw new Error('SUPABASE_URL or SUPABASE_ANON_KEY is missing for built-in auth email flows');
  }

  return createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

const EXPERIENCE_LEVELS = ['entry', 'junior', 'mid', 'senior'] as const;
type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

const DEFAULT_SMTP = {
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  fromEmail: 'admin@recruitfriend.co.za',
  maxAttempts: 3,
} as const;

type ProductEmailCategory = 'alerts' | 'referrals' | 'employer_communications' | 'auth';

const EMAIL_STATUS_VALUES = ['pending', 'sent', 'failed', 'suppressed'] as const;
const INTERVIEW_NOTES_PREFIX = 'RF_INTERVIEW:';
const EMPLOYER_STATUS_VALUES = ['pending_review', 'needs_info', 'approved', 'rejected', 'suspended'] as const;
const ONBOARDING_REQUIRED_DOC_TYPES = ['registration_proof', 'tax_document'] as const;

type EmployerStatus = (typeof EMPLOYER_STATUS_VALUES)[number];

type ProfileLite = {
  id: string;
  user_type: 'seeker' | 'employer' | 'admin';
  employer_status?: EmployerStatus | null;
  name?: string | null;
  email?: string | null;
};

type ProductEmailRequest = {
  eventType: string;
  eventKey: string;
  recipientEmail: string;
  subject: string;
  templateKey: string;
  template: string;
  templateVars: Record<string, string>;
  category: ProductEmailCategory;
  metadata?: Record<string, unknown>;
  preferenceAllowed?: () => Promise<boolean>;
};

type AuthGeneratedLinkProperties = {
  action_link?: string | null;
  email_otp?: string | null;
  hashed_token?: string | null;
  redirect_to?: string | null;
  verification_type?: string | null;
};

type AuthRelayPayload = {
  token: string;
  type: string;
  redirectTo?: string;
};

type AuthVerificationType = 'email' | 'recovery' | 'invite' | 'email_change';

type SmtpConfig = {
  host: string;
  port: number;
  auth: {
    user: string;
    pass: string;
  };
  fromEmail: string;
  fromName: string;
  secure: boolean;
  maxAttempts: number;
};

const SENDER_POLICY: Record<ProductEmailCategory, { fromNameEnv: string; fallbackFromName: string }> = {
  alerts: {
    fromNameEnv: 'SMTP_FROM_NAME_ALERTS',
    fallbackFromName: 'RecruitFriend Alerts',
  },
  referrals: {
    fromNameEnv: 'SMTP_FROM_NAME_REFERRALS',
    fallbackFromName: 'RecruitFriend Referrals',
  },
  employer_communications: {
    fromNameEnv: 'SMTP_FROM_NAME_EMPLOYER',
    fallbackFromName: 'RecruitFriend Hiring',
  },
  auth: {
    fromNameEnv: 'SMTP_FROM_NAME_AUTH',
    fallbackFromName: 'Recruitfriend Admin',
  },
};

function getEnv(name: string) {
  return String(Deno.env.get(name) || '').trim();
}

function getOptionalNumberEnv(name: string, fallback: number) {
  const raw = getEnv(name);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getOptionalBooleanEnv(name: string, fallback: boolean) {
  const raw = getEnv(name).toLowerCase();
  if (!raw) return fallback;
  if (['true', '1', 'yes', 'on'].includes(raw)) return true;
  if (['false', '0', 'no', 'off'].includes(raw)) return false;
  return fallback;
}

function normalizeSmtpError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || 'Unknown SMTP failure');
  if (/535|username and password not accepted|authentication failed/i.test(message)) {
    return 'SMTP authentication failed. Verify Supabase Edge Function secrets SMTP_USERNAME and SMTP_PASSWORD. For Gmail, use the full mailbox address and an app password.';
  }
  return message;
}

function asDbError(error: unknown) {
  if (!error || typeof error !== 'object') return null;
  return error as { code?: string; message?: string };
}

function isMissingColumnError(error: unknown) {
  const dbError = asDbError(error);
  const msg = String(dbError?.message || '');
  return dbError?.code === '42703' || /column .* does not exist/i.test(msg);
}

function getSenderIdentity(category: ProductEmailCategory) {
  const policy = SENDER_POLICY[category];
  const fromEmail = getEnv('SMTP_FROM_EMAIL') || getEnv('SMTP_USERNAME') || DEFAULT_SMTP.fromEmail;
  const fromName = getEnv(policy.fromNameEnv) || getEnv('SMTP_FROM_NAME') || policy.fallbackFromName;
  return { fromEmail, fromName };
}

function base64UrlEncode(value: string) {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return atob(padded);
}

function getAuthRelayBaseUrl() {
  const explicit = getEnv('SMTP_AUTH_RELAY_BASE_URL');
  if (explicit) {
    try {
      return new URL(explicit).toString().replace(/\/$/, '');
    } catch {
      // ignore invalid explicit base URL and fallback
    }
  }
  return '';
}

function normalizeAuthVerificationType(rawType: string) {
  const normalized = String(rawType || '').trim().toLowerCase();
  if (!normalized) return '';

  if (normalized === 'signup' || normalized === 'magiclink') {
    return 'email';
  }

  return normalized;
}

function getDefaultAuthRedirectUrl() {
  return 'http://localhost:5173/';
}

function buildAuthActionLink(
  properties: AuthGeneratedLinkProperties,
  fallbackType?: AuthVerificationType
) {
  const rawActionLink = String(properties.action_link || '').trim();
  const fallbackUrl = new URL('/auth/v1/verify', supabaseUrl || 'https://recruitfriend.co.za');

  let url = fallbackUrl;
  if (rawActionLink) {
    try {
      url = new URL(rawActionLink);
    } catch {
      url = fallbackUrl;
    }
  }

  if (!/\/auth\/v1\/verify$/i.test(url.pathname)) {
    url = fallbackUrl;
  }

  const existingParams = new URLSearchParams(url.search);
  const verificationTypeFromPayload = normalizeAuthVerificationType(
    String(existingParams.get('type') || properties.verification_type || '').trim()
  );
  const fallbackVerificationType = normalizeAuthVerificationType(String(fallbackType || '').trim());
  const verificationType = verificationTypeFromPayload || fallbackVerificationType;
  const hashedToken = String(properties.hashed_token || existingParams.get('token') || '').trim();
  const redirectTo = String(properties.redirect_to || existingParams.get('redirect_to') || '').trim();

  if (!verificationType) {
    throw new Error('Missing verification type in generated auth link');
  }

  if (!hashedToken) {
    throw new Error('Missing token in generated auth link');
  }

  const normalizedParams = new URLSearchParams();
  normalizedParams.set('token', hashedToken);
  normalizedParams.set('type', verificationType);
  if (redirectTo) {
    normalizedParams.set('redirect_to', redirectTo);
  }

  url.search = normalizedParams.toString();
  return url.toString();
}

function buildAuthRelayLink(
  properties: AuthGeneratedLinkProperties,
  fallbackType?: AuthVerificationType
) {
  const canonicalVerifyUrl = buildAuthActionLink(properties, fallbackType);
  const relayBaseUrl = getAuthRelayBaseUrl();
  if (!relayBaseUrl) {
    return canonicalVerifyUrl;
  }

  const verifyUrl = new URL(canonicalVerifyUrl);
  const payload: AuthRelayPayload = {
    token: String(verifyUrl.searchParams.get('token') || '').trim(),
    type: String(verifyUrl.searchParams.get('type') || '').trim(),
  };

  const redirectTo = String(verifyUrl.searchParams.get('redirect_to') || '').trim();
  if (redirectTo) {
    payload.redirectTo = redirectTo;
  }

  if (!payload.token || !payload.type) {
    throw new Error('Cannot build auth relay link because token or verification type is missing');
  }

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  return `${relayBaseUrl}/auth/verify/${encodedPayload}`;
}

function getSmtpConfig(category: ProductEmailCategory): SmtpConfig {
  const host = getEnv('SMTP_HOST') || DEFAULT_SMTP.host;
  const port = getOptionalNumberEnv('SMTP_PORT', DEFAULT_SMTP.port);
  const username = getEnv('SMTP_USERNAME');
  const password = getEnv('SMTP_PASSWORD');
  const secure = getOptionalBooleanEnv('SMTP_SECURE', DEFAULT_SMTP.secure);
  const maxAttempts = Math.max(1, getOptionalNumberEnv('SMTP_MAX_ATTEMPTS', DEFAULT_SMTP.maxAttempts));

  if (!username || !password) {
    throw new Error('SMTP credentials are missing. Configure Supabase Edge Function secrets SMTP_USERNAME and SMTP_PASSWORD.');
  }

  const sender = getSenderIdentity(category);

  return {
    host,
    port,
    auth: {
      user: username,
      pass: password,
    },
    fromEmail: sender.fromEmail,
    fromName: sender.fromName,
    secure,
    maxAttempts,
  };
}

function extractRequiredTemplateVars(template: string) {
  const requiredVars = new Set<string>();
  const matcher = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  let match: RegExpExecArray | null = null;
  while ((match = matcher.exec(template)) !== null) {
    requiredVars.add(match[1]);
  }
  return [...requiredVars];
}

function renderTemplate(template: string, templateVars: Record<string, string>) {
  const required = extractRequiredTemplateVars(template);
  const missing = required.filter((key) => !String(templateVars[key] || '').trim());
  if (missing.length > 0) {
    throw new Error(`Missing required template variables: ${missing.join(', ')}`);
  }
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_full, key) => String(templateVars[key] || ''));
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getEmailCtaLabel(subject: string) {
  const normalizedSubject = String(subject || '').trim().toLowerCase();
  if (normalizedSubject.includes('confirm')) return 'Confirm email address';
  if (normalizedSubject.includes('reset')) return 'Reset password';
  if (normalizedSubject.includes('invite')) return 'View invitation';
  if (normalizedSubject.includes('onboarding')) return 'View update';
  return 'Open secure link';
}

function renderEmailParagraphHtml(paragraph: string, subject: string) {
  const normalized = paragraph.trim();
  if (!normalized) return '';

  const urlOnlyMatch = normalized.match(/^https?:\/\/\S+$/i);
  if (urlOnlyMatch) {
    const href = urlOnlyMatch[0];
    const safeHref = escapeHtml(href);
    const ctaLabel = escapeHtml(getEmailCtaLabel(subject));
    return [
      '<div style="margin: 28px 0; text-align: center;">',
      `  <a href="${safeHref}" style="display: inline-block; background: #0f766e; color: #ffffff; text-decoration: none; font-weight: 600; padding: 14px 22px; border-radius: 999px;">${ctaLabel}</a>`,
      '</div>',
      `<p style="margin: 0 0 18px; font-size: 13px; line-height: 1.6; color: #475569; word-break: break-word;">If the button does not work, copy and paste this link into your browser:<br /><a href="${safeHref}" style="color: #0f766e; text-decoration: underline;">${safeHref}</a></p>`,
    ].join('');
  }

  const linked = escapeHtml(normalized)
    .replace(
      /(https?:\/\/[^\s<]+)/gi,
      (match) => `<a href="${escapeHtml(match)}" style="color: #0f766e; text-decoration: underline; word-break: break-word;">${escapeHtml(match)}</a>`
    )
    .replace(/\n/g, '<br />');

  return `<p style="margin: 0 0 18px; font-size: 15px; line-height: 1.7; color: #0f172a;">${linked}</p>`;
}

function renderEmailHtml(subject: string, body: string) {
  const normalizedBody = String(body || '').replace(/\r\n/g, '\n').trim();
  const safeSubject = escapeHtml(String(subject || 'RecruitFriend update').trim() || 'RecruitFriend update');
  const paragraphs = normalizedBody
    .split(/\n\s*\n/g)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const contentHtml = paragraphs.map((paragraph) => renderEmailParagraphHtml(paragraph, subject)).join('');

  return [
    '<!doctype html>',
    '<html lang="en">',
    '  <body style="margin: 0; padding: 24px 12px; background: #f8fafc; font-family: Inter, Segoe UI, Arial, sans-serif; color: #0f172a;">',
    '    <div style="max-width: 640px; margin: 0 auto;">',
    '      <div style="padding: 20px 24px 12px; text-align: center;">',
    '        <div style="display: inline-block; padding: 8px 14px; border-radius: 999px; background: #ecfeff; color: #0f766e; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;">RecruitFriend</div>',
    '      </div>',
    '      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 24px; padding: 32px 28px; box-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);">',
    `        <h1 style="margin: 0 0 24px; font-size: 24px; line-height: 1.3; color: #020617;">${safeSubject}</h1>`,
    `        ${contentHtml}`,
    '      </div>',
    '      <p style="margin: 18px 0 0; text-align: center; font-size: 12px; line-height: 1.6; color: #64748b;">This email was sent by RecruitFriend, your career wingman for South African talent.</p>',
    '    </div>',
    '  </body>',
    '</html>',
  ].join('\n');
}

async function writeEmailLog(
  db: ReturnType<typeof getDb>,
  payload: {
    eventType: string;
    eventKey: string;
    category: ProductEmailCategory;
    recipientEmail: string;
    subject: string;
    templateKey: string;
    templateVars: Record<string, string>;
    status: (typeof EMAIL_STATUS_VALUES)[number];
    attemptCount?: number;
    errorMessage?: string | null;
    providerMessageId?: string | null;
  }
) {
  const now = new Date().toISOString();
  const logRow = {
    event_type: payload.eventType,
    event_key: payload.eventKey,
    category: payload.category,
    recipient_email: payload.recipientEmail,
    subject: payload.subject,
    template_key: payload.templateKey,
    template_vars: payload.templateVars,
    status: payload.status,
    attempt_count: payload.attemptCount || 0,
    last_error: payload.errorMessage || null,
    provider_message_id: payload.providerMessageId || null,
    sent_at: payload.status === 'sent' ? now : null,
    updated_at: now,
  };

  const { error } = await db
    .from('email_delivery_logs')
    .upsert(logRow, { onConflict: 'event_key' });

  if (error && !isMissingColumnError(error)) {
    console.error('Failed to write email delivery log:', error);
  }
}

async function sendSmtpEmail(
  config: SmtpConfig,
  to: string,
  subject: string,
  body: string,
  html: string
) {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    const client = new SmtpClient();
    try {
      if (config.secure) {
        await client.connectTLS({
          hostname: config.host,
          port: config.port,
          username: config.auth.user,
          password: config.auth.pass,
        });
      } else {
        await client.connect({
          hostname: config.host,
          port: config.port,
          username: config.auth.user,
          password: config.auth.pass,
        });
      }

      await client.send({
        from: `${config.fromName} <${config.fromEmail}>`,
        to,
        subject,
        content: body,
        html,
      });

      await client.close();
      return { ok: true as const, attempt, providerMessageId: `${Date.now()}-${attempt}` };
    } catch (error) {
      lastError = error;
      try {
        await client.close();
      } catch {
        // ignore close failures
      }

      if (attempt < config.maxAttempts) {
        const backoffMs = Math.min(1500, attempt * 250);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
  }

  return {
    ok: false as const,
    error: normalizeSmtpError(lastError),
  };
}

async function resolveEmployerSettings(db: ReturnType<typeof getDb>, employerId: string) {
  const { data: profile } = await db
    .from('profiles')
    .select('social_links')
    .eq('id', employerId)
    .maybeSingle();

  const social = (profile?.social_links && typeof profile.social_links === 'object')
    ? profile.social_links as Record<string, unknown>
    : {};

  const employerSettings = (social.employerSettings && typeof social.employerSettings === 'object')
    ? social.employerSettings as Record<string, unknown>
    : {};

  const notifications = (employerSettings.notifications && typeof employerSettings.notifications === 'object')
    ? employerSettings.notifications as Record<string, unknown>
    : {};

  const templates = (employerSettings.templates && typeof employerSettings.templates === 'object')
    ? employerSettings.templates as Record<string, unknown>
    : {};

  return { notifications, templates };
}

function parseInterviewNotes(notes: unknown) {
  if (typeof notes !== 'string' || !notes.startsWith(INTERVIEW_NOTES_PREFIX)) return null;
  try {
    const parsed = JSON.parse(notes.slice(INTERVIEW_NOTES_PREFIX.length)) as {
      scheduled_at?: string;
      link?: string;
      completed_at?: string;
    };
    return parsed;
  } catch {
    return null;
  }
}

function normalizeEmployerStatus(rawStatus: unknown): EmployerStatus {
  const normalized = String(rawStatus || '').trim().toLowerCase();
  if ((EMPLOYER_STATUS_VALUES as readonly string[]).includes(normalized)) {
    return normalized as EmployerStatus;
  }
  return 'pending_review';
}

function statusGuidanceForEmployer(status: EmployerStatus) {
  switch (status) {
    case 'needs_info':
      return {
        code: 'EMPLOYER_ONBOARDING_NEEDS_INFO',
        message: 'Your onboarding requires additional information before access can be granted.',
        guidance: 'Please open your onboarding status page, review remediation notes, and resubmit the requested details.',
      };
    case 'rejected':
      return {
        code: 'EMPLOYER_ONBOARDING_REJECTED',
        message: 'Your onboarding submission was rejected.',
        guidance: 'Review the rejection reason in your onboarding status page and submit a revised application when ready.',
      };
    case 'suspended':
      return {
        code: 'EMPLOYER_ACCOUNT_SUSPENDED',
        message: 'Your employer account is currently suspended.',
        guidance: 'Contact support or your account reviewer for reactivation guidance.',
      };
    default:
      return {
        code: 'EMPLOYER_ONBOARDING_PENDING',
        message: 'Your onboarding is pending review.',
        guidance: 'You will gain access to employer operations once an admin approves your onboarding.',
      };
  }
}

async function getProfileLite(db: ReturnType<typeof getDb>, userId: string) {
  const { data } = await db
    .from('profiles')
    .select('id, user_type, employer_status, name, email')
    .eq('id', userId)
    .maybeSingle();

  return data as ProfileLite | null;
}

async function dispatchProductEmail(db: ReturnType<typeof getDb>, request: ProductEmailRequest) {
  const email = String(request.recipientEmail || '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw new Error('Recipient email is invalid');
  }

  const { data: existing } = await db
    .from('email_delivery_logs')
    .select('status')
    .eq('event_key', request.eventKey)
    .maybeSingle();

  if (existing?.status === 'sent') {
    return { status: 'deduplicated' as const };
  }

  if (request.preferenceAllowed) {
    const allowed = await request.preferenceAllowed();
    if (!allowed) {
      await writeEmailLog(db, {
        eventType: request.eventType,
        eventKey: request.eventKey,
        category: request.category,
        recipientEmail: email,
        subject: request.subject,
        templateKey: request.templateKey,
        templateVars: request.templateVars,
        status: 'suppressed',
      });
      return { status: 'suppressed' as const };
    }
  }

  const body = renderTemplate(request.template, request.templateVars);
  const html = renderEmailHtml(request.subject, body);
  const smtpConfig = getSmtpConfig(request.category);

  await writeEmailLog(db, {
    eventType: request.eventType,
    eventKey: request.eventKey,
    category: request.category,
    recipientEmail: email,
    subject: request.subject,
    templateKey: request.templateKey,
    templateVars: request.templateVars,
    status: 'pending',
  });

  const result = await sendSmtpEmail(smtpConfig, email, request.subject, body, html);
  if (!result.ok) {
    await writeEmailLog(db, {
      eventType: request.eventType,
      eventKey: request.eventKey,
      category: request.category,
      recipientEmail: email,
      subject: request.subject,
      templateKey: request.templateKey,
      templateVars: request.templateVars,
      status: 'failed',
      attemptCount: smtpConfig.maxAttempts,
      errorMessage: result.error,
    });
    throw new Error(result.error);
  }

  await writeEmailLog(db, {
    eventType: request.eventType,
    eventKey: request.eventKey,
    category: request.category,
    recipientEmail: email,
    subject: request.subject,
    templateKey: request.templateKey,
    templateVars: request.templateVars,
    status: 'sent',
    attemptCount: result.attempt,
    providerMessageId: result.providerMessageId,
  });

  return { status: 'sent' as const, attempts: result.attempt };
}

async function sendSignupConfirmationEmail(
  db: ReturnType<typeof getDb>,
  payload: {
    userId: string;
    email: string;
    name: string;
    userType: 'seeker' | 'employer';
    confirmationLink: string;
  }
) {
  const displayName = String(payload.name || payload.email.split('@')[0] || 'there').trim();
  const roleLabel = payload.userType === 'employer' ? 'employer' : 'job seeker';

  return dispatchProductEmail(db, {
    eventType: 'auth_signup_confirmation',
    eventKey: `auth-signup-confirmation:${payload.userId}`,
    recipientEmail: payload.email,
    subject: 'Confirm your RecruitFriend account',
    templateKey: 'auth-signup-confirmation',
    category: 'auth',
    templateVars: {
      name: displayName,
      role_label: roleLabel,
      confirmation_link: payload.confirmationLink,
    },
    template: [
      'Hi {{name}},',
      '',
      'Welcome to RecruitFriend! Your {{role_label}} account is almost ready.',
      '',
      'Please confirm your email address by opening the link below:',
      '{{confirmation_link}}',
      '',
      'If you did not create this account, you can safely ignore this email.',
      '',
      '— The RecruitFriend team',
    ].join('\n'),
  });
}

async function sendPasswordRecoveryEmail(
  db: ReturnType<typeof getDb>,
  payload: {
    email: string;
    recoveryLink: string;
  }
) {
  return dispatchProductEmail(db, {
    eventType: 'auth_password_recovery',
    eventKey: `auth-password-recovery:${payload.email}:${new Date().toISOString().slice(0, 10)}`,
    recipientEmail: payload.email,
    subject: 'Reset your RecruitFriend password',
    templateKey: 'auth-password-recovery',
    category: 'auth',
    templateVars: {
      recovery_link: payload.recoveryLink,
    },
    template: [
      'Hi there,',
      '',
      'We received a request to reset your RecruitFriend password. Click the link below to set a new password:',
      '{{recovery_link}}',
      '',
      'This link will expire in 24 hours.',
      '',
      'If you did not request a password reset, you can safely ignore this email.',
      '',
      '— The RecruitFriend team',
    ].join('\n'),
  });
}

function toCandidateVideoUrl(socialLinks: unknown) {
  if (!socialLinks || typeof socialLinks !== 'object') return null;
  const links = socialLinks as Record<string, unknown>;
  const maybeUrl = links.video_introduction ?? links.videoIntroduction;
  return typeof maybeUrl === 'string' && maybeUrl.trim() ? maybeUrl.trim() : null;
}

function estimateYearsOfExperience(rawExperience: unknown) {
  if (!Array.isArray(rawExperience) || rawExperience.length === 0) return 0;

  const parseMonth = (value: unknown) => {
    if (!value || typeof value !== 'string') return null;
    const month = Date.parse(`${value}-01`);
    if (Number.isNaN(month)) return null;
    return month;
  };

  let totalMonths = 0;
  const now = Date.now();

  for (const entry of rawExperience) {
    if (!entry || typeof entry !== 'object') continue;
    const role = entry as Record<string, unknown>;
    const start = parseMonth(role.startDate);
    const end = parseMonth(role.endDate) ?? now;

    if (!start || end < start) {
      totalMonths += 12;
      continue;
    }

    totalMonths += Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24 * 30.4375)));
  }

  return Math.max(0, Math.round((totalMonths / 12) * 10) / 10);
}

function getExperienceLevel(years: number): ExperienceLevel {
  if (years <= 1) return 'entry';
  if (years <= 2) return 'junior';
  if (years <= 5) return 'mid';
  return 'senior';
}

function nextDispatchForFrequency(frequency: string, from = new Date()) {
  const normalized = String(frequency || 'daily').toLowerCase();
  const next = new Date(from.getTime());
  if (normalized === 'weekly') {
    next.setDate(next.getDate() + 7);
    return next.toISOString();
  }
  if (normalized === 'immediately') {
    return new Date(from.getTime()).toISOString();
  }
  next.setDate(next.getDate() + 1);
  return next.toISOString();
}

// Helper to get authenticated user
async function getAuthUser(authHeader: string | null) {
  if (!authHeader) return null;
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  if (!token || token.split('.').length !== 3) return null;

  const db = getDb();
  const { data: { user }, error } = await db.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

async function requireSeeker(authHeader: string | null) {
  const user = await getAuthUser(authHeader);
  if (!user) return { error: 'Unauthorized', code: 401 as const, user: null };

  const db = getDb();
  const { data: profile } = await db.from('profiles').select('user_type').eq('id', user.id).single();
  if (!profile || profile.user_type !== 'seeker') {
    return { error: 'Forbidden', code: 403 as const, user: null };
  }

  return { error: null, code: 200 as const, user };
}

async function requireEmployer(authHeader: string | null) {
  const user = await getAuthUser(authHeader);
  if (!user) return { error: 'Unauthorized', code: 401 as const, user: null };

  const db = getDb();
  const { data: profile } = await db.from('profiles').select('user_type').eq('id', user.id).single();
  if (!profile || profile.user_type !== 'employer') {
    return { error: 'Forbidden', code: 403 as const, user: null };
  }

  return { error: null, code: 200 as const, user };
}

async function requireAdmin(authHeader: string | null) {
  const user = await getAuthUser(authHeader);
  if (!user) return { error: 'Unauthorized', code: 401 as const, user: null, profile: null };

  const db = getDb();
  const profile = await getProfileLite(db, user.id);
  if (!profile || profile.user_type !== 'admin') {
    return { error: 'Forbidden', code: 403 as const, user: null, profile: null };
  }

  return { error: null, code: 200 as const, user, profile };
}

async function requireApprovedEmployer(authHeader: string | null) {
  const user = await getAuthUser(authHeader);
  if (!user) {
    return {
      error: 'Unauthorized',
      code: 401 as const,
      user: null,
      profile: null,
      deniedPayload: null,
    };
  }

  const db = getDb();
  const profile = await getProfileLite(db, user.id);
  if (!profile || profile.user_type !== 'employer') {
    return {
      error: 'Forbidden',
      code: 403 as const,
      user: null,
      profile: null,
      deniedPayload: null,
    };
  }

  const status = normalizeEmployerStatus(profile.employer_status);
  if (status !== 'approved') {
    return {
      error: 'Employer access requires approved onboarding',
      code: 403 as const,
      user: null,
      profile,
      deniedPayload: {
        ...statusGuidanceForEmployer(status),
        employer_status: status,
      },
    };
  }

  return {
    error: null,
    code: 200 as const,
    user,
    profile,
    deniedPayload: null,
  };
}

async function writeOnboardingAuditEvent(
  db: ReturnType<typeof getDb>,
  payload: {
    actorId: string;
    targetEmployerId: string;
    submissionId?: string | null;
    action: 'submit' | 'resubmit' | 'approve' | 'reject' | 'request_info' | 'suspend' | 'reactivate';
    reason?: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  const { error } = await db
    .from('admin_onboarding_audit_log')
    .insert({
      actor_id: payload.actorId,
      target_employer_id: payload.targetEmployerId,
      submission_id: payload.submissionId || null,
      action: payload.action,
      reason: payload.reason || null,
      metadata: payload.metadata || {},
    });

  if (error) {
    console.error('Failed to persist onboarding audit event:', error);
  }
}

// ============== AUTH ROUTES ==============

// Sign up — profile row created automatically by handle_new_user() DB trigger
app.post('/make-server-bca21fd3/auth/signup', async (c) => {
  try {
    const { email, password, name, userType, emailRedirectTo } = await c.req.json();

    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedName = String(name || '').trim();
    const normalizedUserType = String(userType || '').trim().toLowerCase() === 'employer' ? 'employer' : 'seeker';
    const redirectTo = typeof emailRedirectTo === 'string' && emailRedirectTo.trim()
      ? emailRedirectTo.trim()
      : getDefaultAuthRedirectUrl();

    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      return c.json({ error: 'A valid email address is required' }, 400);
    }

    if (typeof password !== 'string' || password.length < 6) {
      return c.json({ error: 'Password must be at least 6 characters long' }, 400);
    }

    if (!normalizedName) {
      return c.json({ error: 'Name is required' }, 400);
    }

    const authClient = getPublicAuthClient();
    const db = getDb();
    const { data, error } = await authClient.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: { name: normalizedName, userType: normalizedUserType },
        emailRedirectTo: redirectTo,
      }
    });

    if (error) {
      console.error('Signup error:', error);
      return c.json({ error: error.message }, 400);
    }

    if (normalizedUserType === 'employer' && data.user?.id) {
      await db
        .from('profiles')
        .update({ employer_status: 'pending_review', reviewed_at: null, reviewed_by: null, live_at: null, updated_at: new Date().toISOString() })
        .eq('id', data.user.id);
    }

    return c.json({
      user: data.user,
      requiresEmailVerification: true,
    });
  } catch (error) {
    console.error('Signup error:', error);
    return c.json({ error: 'Signup failed' }, 500);
  }
});

// Request password recovery email
app.post('/make-server-bca21fd3/auth/recover-password', async (c) => {
  try {
    const { email, redirectTo } = await c.req.json();

    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      return c.json({ error: 'A valid email address is required' }, 400);
    }

    const authClient = getPublicAuthClient();

    const { error } = await authClient.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: (typeof redirectTo === 'string' && redirectTo.trim())
        ? redirectTo.trim()
        : getDefaultAuthRedirectUrl(),
    });

    if (error) {
      console.error('Password recovery error:', error);
      // Always return success for security (avoid email enumeration)
      return c.json({ success: true, message: 'If an account exists for this email, a recovery link has been sent' }, 200);
    }

    // Always return success to avoid email enumeration attacks
    return c.json({ success: true, message: 'If an account exists for this email, a recovery link has been sent' });
  } catch (error) {
    console.error('Password recovery error:', error);
    return c.json({ success: true, message: 'If an account exists for this email, a recovery link has been sent' });
  }
});

// Relay short auth links from email to canonical Supabase verify endpoint.
app.get('/make-server-bca21fd3/auth/verify/:payload', async (c) => {
  try {
    const encodedPayload = String(c.req.param('payload') || '').trim();
    if (!encodedPayload) {
      return c.json({ error: 'Invalid verification payload' }, 400);
    }

    let parsed: AuthRelayPayload;
    try {
      parsed = JSON.parse(base64UrlDecode(encodedPayload)) as AuthRelayPayload;
    } catch {
      return c.json({ error: 'Invalid verification payload' }, 400);
    }

    const token = String(parsed.token || '').trim();
    const type = String(parsed.type || '').trim();
    const redirectTo = String(parsed.redirectTo || '').trim();

    if (!token || !type) {
      return c.json({ error: 'Invalid verification payload' }, 400);
    }

    const target = new URL('/auth/v1/verify', supabaseUrl || 'https://recruitfriend.co.za');
    target.searchParams.set('token', token);
    target.searchParams.set('type', type);
    if (redirectTo) {
      target.searchParams.set('redirect_to', redirectTo);
    }

    return c.redirect(target.toString(), 302);
  } catch (error) {
    console.error('Auth verify relay error:', error);
    return c.json({ error: 'Failed to process verification link' }, 500);
  }
});

// Get current user profile
app.get('/make-server-bca21fd3/auth/profile', async (c) => {
  try {
    const user = await getAuthUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const db = getDb();
    const { data: profile, error } = await db
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;

    if (profile) return c.json({ profile });

    const fallbackProfile = {
      id: user.id,
      email: user.email || '',
      name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
      user_type: (user.user_metadata?.userType || 'seeker') as 'seeker' | 'employer' | 'admin',
      employer_status: user.user_metadata?.userType === 'employer' ? 'pending_review' : null,
      subscription: user.user_metadata?.userType === 'employer' ? 'starter' : 'free',
      updated_at: new Date().toISOString(),
    };

    const { data: createdProfile, error: createError } = await db
      .from('profiles')
      .upsert(fallbackProfile, { onConflict: 'id' })
      .select('*')
      .single();

    if (createError) throw createError;
    return c.json({ profile: createdProfile });
  } catch (error) {
    console.error('Get profile error:', error);
    return c.json({ error: 'Failed to get profile' }, 500);
  }
});

// Update user profile
app.put('/make-server-bca21fd3/auth/profile', async (c) => {
  try {
    const user = await getAuthUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const updates = await c.req.json();
    const db = getDb();

    const { data: existingProfile } = await db
      .from('profiles')
      .select('id, email, user_type')
      .eq('id', user.id)
      .maybeSingle();

    if (!existingProfile) {
      const { error: ensureError } = await db
        .from('profiles')
        .upsert({
          id: user.id,
          email: user.email || '',
          name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
          user_type: (user.user_metadata?.userType || 'seeker') as 'seeker' | 'employer' | 'admin',
          employer_status: user.user_metadata?.userType === 'employer' ? 'pending_review' : null,
          subscription: user.user_metadata?.userType === 'employer' ? 'starter' : 'free',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });

      if (ensureError) throw ensureError;
    }

    const { data: profile, error } = await db
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select()
      .single();

    if (error) throw error;
    return c.json({ profile });
  } catch (error) {
    console.error('Update profile error:', error);
    return c.json({ error: 'Failed to update profile' }, 500);
  }
});

// ============== JOB ROUTES ==============

// Get all jobs (with filters + pagination)
app.get('/make-server-bca21fd3/jobs', async (c) => {
  try {
    const { search, location, jobType, minSalary, maxSalary, industry } = c.req.query();
    const page = Math.max(1, parseInt(c.req.query('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '20')));
    const offset = (page - 1) * limit;

    const db = getDb();
    let query = db
      .from('jobs')
      .select('*', { count: 'exact' })
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }
    if (location) {
      query = query.or(`city.ilike.%${location}%,province.ilike.%${location}%`);
    }
    if (jobType) {
      query = query.eq('employment_type', jobType);
    }
    if (industry) {
      query = query.eq('industry', industry);
    }
    if (minSalary) {
      query = query.gte('salary_max', parseInt(minSalary));
    }
    if (maxSalary) {
      query = query.lte('salary_min', parseInt(maxSalary));
    }

    const { data: jobs, error, count } = await query;
    if (error) throw error;

    const rows = jobs || [];
    const employerIds = [...new Set(rows.map((job: Record<string, unknown>) => String(job.employer_id || '')).filter(Boolean))];

    let employerMap: Record<string, Record<string, unknown>> = {};
    if (employerIds.length > 0) {
      const { data: employerProfiles, error: employerError } = await db
        .from('profiles')
        .select('id, name, avatar_url, location, headline, summary, social_links')
        .in('id', employerIds);

      if (employerError) {
        console.error('Get jobs employer profile join fallback error:', employerError);
      } else {
        employerMap = (employerProfiles || []).reduce((acc: Record<string, Record<string, unknown>>, profile: Record<string, unknown>) => {
          acc[String(profile.id)] = profile;
          return acc;
        }, {});
      }
    }

    const enriched = rows.map((job: Record<string, unknown>) => ({
      ...job,
      employer: employerMap[String(job.employer_id || '')] || null,
    }));

    return c.json({ jobs: enriched, count: enriched.length, totalCount: count || 0 });
  } catch (error) {
    console.error('Get jobs error:', error);
    return c.json({ error: 'Failed to get jobs' }, 500);
  }
});

// Get job by ID
app.get('/make-server-bca21fd3/jobs/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const db = getDb();

    const { data: job, error } = await db
      .from('jobs')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !job) return c.json({ error: 'Job not found' }, 404);

    let employer: Record<string, unknown> | null = null;
    if (job.employer_id) {
      const { data: employerProfile, error: employerError } = await db
        .from('profiles')
        .select('id, name, avatar_url, location, headline, summary, social_links')
        .eq('id', job.employer_id)
        .maybeSingle();

      if (employerError) {
        console.error('Get job employer profile error:', employerError);
      } else {
        employer = (employerProfile as Record<string, unknown> | null) || null;
      }
    }

    // Increment views
    await db.from('jobs').update({ views: (job.views || 0) + 1 }).eq('id', id);

    return c.json({ job: { ...job, employer } });
  } catch (error) {
    console.error('Get job error:', error);
    return c.json({ error: 'Failed to get job' }, 500);
  }
});

// Create job (employer only)
app.post('/make-server-bca21fd3/jobs', async (c) => {
  try {
    const auth = await requireApprovedEmployer(c.req.header('Authorization'));
    if (!auth.user) {
      if (auth.deniedPayload) {
        return c.json({ error: auth.error, ...auth.deniedPayload }, auth.code);
      }
      return c.json({ error: auth.error }, auth.code);
    }

    const db = getDb();
    const jobData = await c.req.json();
    const screeningQuestions = Array.isArray(jobData?.screening_questions)
      ? (jobData.screening_questions as Array<Record<string, unknown>>)
          .map((question, index) => ({
            id: String(question?.id ?? index),
            prompt: String(question?.prompt || '').trim(),
            duration: String(question?.duration || '1min').trim(),
          }))
          .filter((question) => question.prompt.length > 0)
      : [];

    const { data: job, error } = await db
      .from('jobs')
      .insert({
        ...jobData,
        screening_questions: screeningQuestions,
        employer_id: auth.user.id,
        status: 'active',
        views: 0,
      })
      .select()
      .single();

    if (error) throw error;
    return c.json({ job });
  } catch (error) {
    console.error('Create job error:', error);
    return c.json({ error: 'Failed to create job' }, 500);
  }
});

// Update job
app.put('/make-server-bca21fd3/jobs/:id', async (c) => {
  try {
    const user = await getAuthUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const id = c.req.param('id');
    const updates = await c.req.json();
    const db = getDb();

    const { data: job, error } = await db
      .from('jobs')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('employer_id', user.id)
      .select()
      .single();

    if (error) throw error;
    if (!job) return c.json({ error: 'Job not found or not authorized' }, 404);
    return c.json({ job });
  } catch (error) {
    console.error('Update job error:', error);
    return c.json({ error: 'Failed to update job' }, 500);
  }
});

// Get employer's jobs
app.get('/make-server-bca21fd3/employer/jobs', async (c) => {
  try {
    const auth = await requireApprovedEmployer(c.req.header('Authorization'));
    if (!auth.user) {
      if (auth.deniedPayload) {
        return c.json({ error: auth.error, ...auth.deniedPayload }, auth.code);
      }
      return c.json({ error: auth.error }, auth.code);
    }

    const db = getDb();
    const { data: jobs, error } = await db
      .from('jobs')
      .select('*')
      .eq('employer_id', auth.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return c.json({ jobs: jobs || [] });
  } catch (error) {
    console.error('Get employer jobs error:', error);
    return c.json({ error: 'Failed to get jobs' }, 500);
  }
});

// Get employer stats
app.get('/make-server-bca21fd3/employer/stats', async (c) => {
  try {
    const auth = await requireApprovedEmployer(c.req.header('Authorization'));
    if (!auth.user) {
      if (auth.deniedPayload) {
        return c.json({ error: auth.error, ...auth.deniedPayload }, auth.code);
      }
      return c.json({ error: auth.error }, auth.code);
    }

    const db = getDb();

    const { count: activeListings } = await db
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .eq('employer_id', auth.user.id)
      .eq('status', 'active');

    const { data: employerJobs } = await db
      .from('jobs')
      .select('id')
      .eq('employer_id', auth.user.id);

    const jobIds = (employerJobs || []).map((j: { id: string }) => j.id);
    const safeIds = jobIds.length ? jobIds : ['00000000-0000-0000-0000-000000000000'];

    const { count: totalApplications } = await db
      .from('applications')
      .select('*', { count: 'exact', head: true })
      .in('job_id', safeIds);

    const { count: shortlisted } = await db
      .from('applications')
      .select('*', { count: 'exact', head: true })
      .in('job_id', safeIds)
      .eq('status', 'shortlisted');

    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

    const { count: interviewsToday } = await db
      .from('applications')
      .select('*', { count: 'exact', head: true })
      .in('job_id', safeIds)
      .eq('status', 'interview')
      .gte('updated_at', todayStart.toISOString())
      .lte('updated_at', todayEnd.toISOString());

    return c.json({
      activeListings: activeListings || 0,
      totalApplications: totalApplications || 0,
      shortlisted: shortlisted || 0,
      interviewsToday: interviewsToday || 0,
      cvViews: 0,
    });
  } catch (error) {
    console.error('Get employer stats error:', error);
    return c.json({ error: 'Failed to get stats' }, 500);
  }
});

// ============== APPLICATION ROUTES ==============

// Apply to job
app.post('/make-server-bca21fd3/applications', async (c) => {
  try {
    const user = await getAuthUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const { jobId, coverLetter, customLetter, screeningAnswers } = await c.req.json();
    const db = getDb();
    const normalizedScreeningAnswers = Array.isArray(screeningAnswers)
      ? (screeningAnswers as Array<Record<string, unknown>>)
          .map((entry, index) => ({
            question_id: String(entry?.question_id ?? entry?.id ?? index),
            question: String(entry?.question || entry?.prompt || '').trim(),
            answer: String(entry?.answer || '').trim(),
            duration: String(entry?.duration || '').trim() || null,
          }))
          .filter((entry) => entry.question.length > 0 || entry.answer.length > 0)
      : [];

    const { data: application, error } = await db
      .from('applications')
      .insert({
        job_id: jobId,
        seeker_id: user.id,
        cover_letter: coverLetter,
        custom_letter: customLetter,
        screening_answers: normalizedScreeningAnswers,
        status: 'applied',
      })
      .select()
      .single();

    if (error) throw error;
    return c.json({ application });
  } catch (error) {
    console.error('Apply to job error:', error);
    return c.json({ error: 'Failed to apply to job' }, 500);
  }
});

// Get user's applications
app.get('/make-server-bca21fd3/applications/my', async (c) => {
  try {
    const user = await getAuthUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const db = getDb();
    const { data: applications, error } = await db
      .from('applications')
      .select('*, job:jobs(id, title, city, province, employment_type, employer:profiles!jobs_employer_id_fkey(name, avatar_url))')
      .eq('seeker_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const normalized = (applications || []).map((app: Record<string, unknown>) => {
      const job = app.job as Record<string, unknown> | null;
      const employer = (job?.employer as Record<string, unknown> | null);
      return { ...app, job_title: job?.title || '', company: employer?.name || '' };
    });

    return c.json({ applications: normalized });
  } catch (error) {
    console.error('Get applications error:', error);
    return c.json({ error: 'Failed to get applications' }, 500);
  }
});

// Get applications for a job (employer)
app.get('/make-server-bca21fd3/jobs/:jobId/applications', async (c) => {
  try {
    const auth = await requireApprovedEmployer(c.req.header('Authorization'));
    if (!auth.user) {
      if (auth.deniedPayload) {
        return c.json({ error: auth.error, ...auth.deniedPayload }, auth.code);
      }
      return c.json({ error: auth.error }, auth.code);
    }

    const jobId = c.req.param('jobId');
    const db = getDb();

    const { data: job } = await db.from('jobs').select('employer_id').eq('id', jobId).single();
    if (!job || job.employer_id !== auth.user.id) return c.json({ error: 'Not authorized' }, 403);

    // Step 1: fetch applications (no join — avoid FK hint ambiguity)
    const { data: applications, error } = await db
      .from('applications')
      .select('id, job_id, seeker_id, cover_letter, custom_letter, status, notes, created_at, updated_at')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!applications || applications.length === 0) return c.json({ applications: [] });

    // Step 2: fetch seeker profiles for all applicants in one query
    const seekerIds = [...new Set(applications.map((a: any) => a.seeker_id))];
    console.log('Fetching profiles for seekerIds:', seekerIds);

    const { data: profiles, error: profilesErr } = await db
      .from('profiles')
      .select('id, name, email, headline, avatar_url, skills, location, phone, summary, experience, education, social_links')
      .in('id', seekerIds);

    if (profilesErr) {
      console.error('Error fetching profiles:', profilesErr);
      throw profilesErr;
    }

    console.log('Fetched profiles count:', (profiles || []).length);

    const profileMap: Record<string, any> = {};
    (profiles || []).forEach((p: any) => { profileMap[p.id] = p; });
    
    console.log('ProfileMap keys:', Object.keys(profileMap));

    // Enrich applications with seeker profiles; fallback to minimal profile if missing
    const enriched = applications.map((a: any) => {
      let seeker = profileMap[a.seeker_id];
      
      if (!seeker) {
        console.warn(`Seeker profile missing for ID ${a.seeker_id}, will be fetched separately by client`);
      }
      
      return {
        ...a,
        seeker: seeker || null,
      };
    });

    return c.json({ applications: enriched });
  } catch (error) {
    console.error('Get job applications error:', error);
    return c.json({ error: 'Failed to get applications' }, 500);
  }
});

// Get a seeker's profile by ID (employer use — to populate applicant profile dialog)
app.get('/make-server-bca21fd3/employer/seeker/:seekerId', async (c) => {
  try {
    const auth = await requireApprovedEmployer(c.req.header('Authorization'));
    if (!auth.user) {
      if (auth.deniedPayload) {
        return c.json({ error: auth.error, ...auth.deniedPayload }, auth.code);
      }
      return c.json({ error: auth.error }, auth.code);
    }

    const seekerId = c.req.param('seekerId');
    const db = getDb();

    const { data: profile, error } = await db
      .from('profiles')
      .select('id, name, email, headline, avatar_url, skills, location, phone, summary, experience, education, social_links')
      .eq('id', seekerId)
      .single();

    if (error || !profile) return c.json({ error: 'Profile not found' }, 404);
    return c.json({ profile });
  } catch (error) {
    console.error('Get seeker profile error:', error);
    return c.json({ error: 'Failed to get seeker profile' }, 500);
  }
});

// Talent search for employers
app.get('/make-server-bca21fd3/employer/talent-search', async (c) => {
  try {
    const auth = await requireApprovedEmployer(c.req.header('Authorization'));
    if (!auth.user) {
      if (auth.deniedPayload) {
        return c.json({ error: auth.error, ...auth.deniedPayload }, auth.code);
      }
      return c.json({ error: auth.error }, auth.code);
    }

    const db = getDb();

    const search = String(c.req.query('search') || '').trim();
    const location = String(c.req.query('location') || '').trim();
    const hasVideoOnly = ['true', '1', 'yes'].includes(String(c.req.query('hasVideo') || '').toLowerCase());
    const sortBy = String(c.req.query('sort') || 'relevance').toLowerCase();
    const levelsRaw = String(c.req.query('levels') || '');
    const levels = levelsRaw
      .split(',')
      .map((level) => level.trim().toLowerCase())
      .filter((level): level is ExperienceLevel => (EXPERIENCE_LEVELS as readonly string[]).includes(level));

    const page = Math.max(1, Number.parseInt(String(c.req.query('page') || '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(String(c.req.query('limit') || '50'), 10) || 50));

    let query = db
      .from('profiles')
      .select('id, name, email, headline, summary, location, avatar_url, skills, experience, social_links, updated_at')
      .eq('user_type', 'seeker');

    if (search) {
      query = query.or(`name.ilike.%${search}%,headline.ilike.%${search}%,summary.ilike.%${search}%`);
    }

    if (location) {
      query = query.ilike('location', `%${location}%`);
    }

    const { data: profiles, error } = await query;
    if (error) throw error;

    const normalized = (profiles || []).map((profile: any) => {
      const yearsOfExperience = estimateYearsOfExperience(profile.experience);
      const normalizedSkills = Array.isArray(profile.skills)
        ? profile.skills.filter((s: unknown) => typeof s === 'string' && s.trim())
        : [];
      const videoIntroduction = toCandidateVideoUrl(profile.social_links);

      return {
        id: profile.id,
        name: profile.name || 'Candidate',
        email: profile.email || '',
        headline: profile.headline || '',
        summary: profile.summary || '',
        location: profile.location || '',
        avatar_url: profile.avatar_url || null,
        skills: normalizedSkills,
        yearsOfExperience,
        experienceLevel: getExperienceLevel(yearsOfExperience),
        video_introduction: videoIntroduction,
        updated_at: profile.updated_at,
      };
    });

    const filtered = normalized.filter((candidate) => {
      const matchesVideo = !hasVideoOnly || !!candidate.video_introduction;
      const matchesLevels = levels.length === 0 || levels.includes(candidate.experienceLevel);
      const matchesSearchSkills =
        !search ||
        candidate.skills.some((skill: string) => skill.toLowerCase().includes(search.toLowerCase()));

      return matchesVideo && matchesLevels && matchesSearchSkills;
    });

    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'newest') {
        return Date.parse(b.updated_at || '') - Date.parse(a.updated_at || '');
      }
      if (sortBy === 'name') {
        return String(a.name).localeCompare(String(b.name));
      }

      // relevance (default): prefer candidates matching more skills and recent updates
      const aScore = (search ? a.skills.filter((s: string) => s.toLowerCase().includes(search.toLowerCase())).length : 0) + (a.yearsOfExperience / 10);
      const bScore = (search ? b.skills.filter((s: string) => s.toLowerCase().includes(search.toLowerCase())).length : 0) + (b.yearsOfExperience / 10);
      if (bScore !== aScore) return bScore - aScore;
      return Date.parse(b.updated_at || '') - Date.parse(a.updated_at || '');
    });

    const totalCount = sorted.length;
    const start = (page - 1) * limit;
    const end = start + limit;
    const candidates = sorted.slice(start, end);

    return c.json({ candidates, count: candidates.length, totalCount, page, limit });
  } catch (error) {
    console.error('Talent search error:', error);
    return c.json({ error: 'Failed to search candidates' }, 500);
  }
});

// Update application status
app.put('/make-server-bca21fd3/applications/:id', async (c) => {
  try {
    const user = await getAuthUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const id = c.req.param('id');
    const { status, notes } = await c.req.json();
    const db = getDb();

    const { data: appRecord } = await db.from('applications').select('job_id, seeker_id, status').eq('id', id).single();
    if (!appRecord) return c.json({ error: 'Application not found' }, 404);

    const { data: job } = await db.from('jobs').select('employer_id').eq('id', appRecord.job_id).single();

    const isEmployer = !!job && job.employer_id === user.id;
    const isSeekerOwner = appRecord.seeker_id === user.id;

    if (!isEmployer && !isSeekerOwner) return c.json({ error: 'Not authorized' }, 403);

    if (isEmployer) {
      const employerAuth = await requireApprovedEmployer(c.req.header('Authorization'));
      if (!employerAuth.user) {
        if (employerAuth.deniedPayload) {
          return c.json({ error: employerAuth.error, ...employerAuth.deniedPayload }, employerAuth.code);
        }
        return c.json({ error: employerAuth.error }, employerAuth.code);
      }
    }

    if (isSeekerOwner && status !== 'rejected') {
      return c.json({ error: 'Seekers can only withdraw applications' }, 403);
    }

    const { data: application, error } = await db
      .from('applications')
      .update({ status, notes, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    const previousStatus = String(appRecord.status || '').trim().toLowerCase();
    const nextStatus = String(status || '').trim().toLowerCase();
    const stageChanged = previousStatus !== nextStatus;

    let emailSent = false;

    if (isEmployer && stageChanged) {
      try {
        const interviewMeta = parseInterviewNotes(notes);
        const statusLabels: Record<string, string> = {
          applied: 'Applied',
          viewed: 'Reviewed',
          shortlisted: 'Shortlisted',
          interview: 'Interview',
          offer: 'Offer',
          rejected: 'Rejected',
        };

        const [{ data: seekerProfile }, { data: jobProfile }, { data: employerProfile }] = await Promise.all([
          db.from('profiles').select('id, name, email').eq('id', appRecord.seeker_id).maybeSingle(),
          db.from('jobs').select('id, title').eq('id', appRecord.job_id).maybeSingle(),
          db.from('profiles').select('id, name').eq('id', user.id).maybeSingle(),
        ]);

        let seekerEmail = String(seekerProfile?.email || '').trim().toLowerCase();
        if (!/^\S+@\S+\.\S+$/.test(seekerEmail)) {
          try {
            const { data: authUserData, error: authUserError } = await db.auth.admin.getUserById(appRecord.seeker_id);
            if (authUserError) {
              console.error('Failed to resolve seeker email from auth user:', authUserError);
            }
            seekerEmail = String(authUserData?.user?.email || '').trim().toLowerCase();
          } catch (authLookupError) {
            console.error('Auth user email lookup failed for seeker notification:', authLookupError);
          }
        }

        if (/^\S+@\S+\.\S+$/.test(seekerEmail)) {
          const { templates } = await resolveEmployerSettings(db, user.id);

          if (nextStatus === 'interview') {
            const interviewTemplate = String(
              templates.interviewInvite ||
              'Hi {{candidate_name}}, we would like to invite you to interview for {{job_title}} at {{company_name}}. Scheduled time: {{scheduled_at}}. Join link: {{meeting_link}}'
            );

            await dispatchProductEmail(db, {
              eventType: 'employer.interview_invite',
              eventKey: `interview:${application.id}:${application.updated_at || new Date().toISOString()}`,
              recipientEmail: seekerEmail,
              subject: `Interview invitation for ${String(jobProfile?.title || 'your application')}`,
              templateKey: 'interview_invite',
              category: 'employer_communications',
              template: interviewTemplate,
              templateVars: {
                candidate_name: String(seekerProfile?.name || 'Candidate'),
                job_title: String(jobProfile?.title || 'the role'),
                company_name: String(employerProfile?.name || 'RecruitFriend employer'),
                scheduled_at: String(interviewMeta?.scheduled_at || 'TBD'),
                meeting_link: String(interviewMeta?.link || 'Will be shared separately'),
              },
            });
            emailSent = true;
          } else {
            const stageTemplate = nextStatus === 'rejected'
              ? String(
                templates.rejectionNote ||
                'Hi {{candidate_name}}, thank you for your interest in {{job_title}} at {{company_name}}. We are moving forward with other applicants at this stage.'
              )
              : 'Hi {{candidate_name}}, your application for {{job_title}} at {{company_name}} has moved from {{from_stage}} to {{to_stage}}. We will contact you with next steps if needed.';

            await dispatchProductEmail(db, {
              eventType: 'employer.application_stage_update',
              eventKey: `application-stage:${application.id}:${application.updated_at || new Date().toISOString()}:${nextStatus}`,
              recipientEmail: seekerEmail,
              subject: `Update on your application for ${String(jobProfile?.title || 'this role')}`,
              templateKey: nextStatus === 'rejected' ? 'application_rejection' : 'application_stage_update',
              category: 'employer_communications',
              template: stageTemplate,
              templateVars: {
                candidate_name: String(seekerProfile?.name || 'Candidate'),
                job_title: String(jobProfile?.title || 'the role'),
                company_name: String(employerProfile?.name || 'RecruitFriend employer'),
                from_stage: statusLabels[previousStatus] || previousStatus || 'Previous stage',
                to_stage: statusLabels[nextStatus] || nextStatus || 'Next stage',
              },
            });
            emailSent = true;
          }
        } else {
          console.warn('Skipping application status email due to missing recipient email', {
            applicationId: application.id,
            seekerId: appRecord.seeker_id,
            nextStatus,
          });
        }
      } catch (inviteError) {
        console.error('Application status email dispatch failed:', inviteError);
      }
    }

    return c.json({ application, emailSent });
  } catch (error) {
    console.error('Update application error:', error);
    return c.json({ error: 'Failed to update application' }, 500);
  }
});

// ============== EMPLOYER ONBOARDING ==============

app.post('/make-server-bca21fd3/employer/onboarding/submissions', async (c) => {
  try {
    const auth = await requireEmployer(c.req.header('Authorization'));
    if (!auth.user) return c.json({ error: auth.error }, auth.code);

    const db = getDb();
    const body = await c.req.json();

    const requiredTextFields = [
      ['companyName', body.companyName],
      ['contactName', body.contactName],
      ['contactEmail', body.contactEmail],
      ['contactPhone', body.contactPhone],
      ['addressLine1', body.addressLine1],
      ['city', body.city],
      ['province', body.province],
    ] as const;

    const missingFields = requiredTextFields
      .filter(([, value]) => !String(value || '').trim())
      .map(([field]) => field);

    const documentsInput = Array.isArray(body.documents) ? body.documents : [];
    const missingDocuments = ONBOARDING_REQUIRED_DOC_TYPES.filter((requiredType) =>
      !documentsInput.some((doc: Record<string, unknown>) => String(doc?.docType || '') === requiredType && String(doc?.storagePath || '').trim())
    );

    if (missingFields.length > 0 || missingDocuments.length > 0) {
      return c.json({
        error: 'Onboarding submission validation failed',
        code: 'ONBOARDING_VALIDATION_ERROR',
        missingFields,
        missingDocuments,
      }, 400);
    }

    const { data: profile } = await db
      .from('profiles')
      .select('id, employer_status, email, name')
      .eq('id', auth.user.id)
      .single();

    const { data: previous } = await db
      .from('employer_onboarding_submissions')
      .select('revision_no')
      .eq('employer_id', auth.user.id)
      .order('revision_no', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextRevision = Number(previous?.revision_no || 0) + 1;
    const action = nextRevision > 1 ? 'resubmit' as const : 'submit' as const;

    const { data: submission, error: submissionError } = await db
      .from('employer_onboarding_submissions')
      .insert({
        employer_id: auth.user.id,
        revision_no: nextRevision,
        status: 'pending_review',
        company_name: String(body.companyName).trim(),
        registration_number: body.registrationNumber ? String(body.registrationNumber).trim() : null,
        tax_number: body.taxNumber ? String(body.taxNumber).trim() : null,
        company_website: body.companyWebsite ? String(body.companyWebsite).trim() : null,
        business_overview: body.businessOverview ? String(body.businessOverview).trim() : null,
        contact_name: String(body.contactName).trim(),
        contact_email: String(body.contactEmail).trim().toLowerCase(),
        contact_phone: String(body.contactPhone).trim(),
        address_line1: String(body.addressLine1).trim(),
        address_line2: body.addressLine2 ? String(body.addressLine2).trim() : null,
        city: String(body.city).trim(),
        province: String(body.province).trim(),
        postal_code: body.postalCode ? String(body.postalCode).trim() : null,
        country: body.country ? String(body.country).trim() : 'South Africa',
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (submissionError) throw submissionError;

    const documentRows = documentsInput.map((doc: Record<string, unknown>) => ({
      submission_id: submission.id,
      employer_id: auth.user.id,
      doc_type: String(doc.docType || '').trim(),
      storage_bucket: String(doc.storageBucket || 'employer-onboarding').trim(),
      storage_path: String(doc.storagePath || '').trim(),
      original_file_name: doc.originalFileName ? String(doc.originalFileName) : null,
      mime_type: doc.mimeType ? String(doc.mimeType) : null,
      file_size_bytes: Number(doc.fileSizeBytes || 0) || null,
      verification_status: 'pending',
      updated_at: new Date().toISOString(),
    }));

    if (documentRows.length > 0) {
      const { error: documentsError } = await db
        .from('employer_onboarding_documents')
        .upsert(documentRows, { onConflict: 'submission_id,doc_type' });

      if (documentsError) throw documentsError;
    }

    await db
      .from('profiles')
      .update({
        employer_status: 'pending_review',
        reviewed_at: null,
        reviewed_by: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', auth.user.id);

    await writeOnboardingAuditEvent(db, {
      actorId: auth.user.id,
      targetEmployerId: auth.user.id,
      submissionId: submission.id,
      action,
      metadata: {
        revision_no: nextRevision,
        status_from: normalizeEmployerStatus(profile?.employer_status),
        status_to: 'pending_review',
      },
    });

    const employerEmail = String(profile?.email || auth.user.email || '').trim().toLowerCase();
    if (/^\S+@\S+\.\S+$/.test(employerEmail)) {
      try {
        await dispatchProductEmail(db, {
          eventType: 'onboarding.submission_received',
          eventKey: `onboarding:${auth.user.id}:submission:${submission.id}`,
          recipientEmail: employerEmail,
          subject: 'We received your employer onboarding submission',
          templateKey: 'employer_onboarding_submission_received',
          category: 'employer_communications',
          template: 'Hi {{company_name}}, we received your onboarding submission and it is now pending review. We will notify you once a decision is made.',
          templateVars: {
            company_name: String(profile?.name || body.companyName || 'Employer'),
          },
        });
      } catch (notifyError) {
        console.error('Onboarding submission notification failed:', notifyError);
      }
    }

    return c.json({
      submission,
      status: 'pending_review',
      missingFields: [],
      missingDocuments: [],
    });
  } catch (error) {
    console.error('Create onboarding submission error:', error);
    return c.json({ error: 'Failed to create onboarding submission' }, 500);
  }
});

app.get('/make-server-bca21fd3/employer/onboarding/status', async (c) => {
  try {
    const auth = await requireEmployer(c.req.header('Authorization'));
    if (!auth.user) return c.json({ error: auth.error }, auth.code);

    const db = getDb();
    const [{ data: profile }, { data: latestSubmission }, { data: latestAudit }] = await Promise.all([
      db
        .from('profiles')
        .select('id, name, email, employer_status, reviewed_at, reviewed_by, live_at')
        .eq('id', auth.user.id)
        .single(),
      db
        .from('employer_onboarding_submissions')
        .select('*')
        .eq('employer_id', auth.user.id)
        .order('revision_no', { ascending: false })
        .limit(1)
        .maybeSingle(),
      db
        .from('admin_onboarding_audit_log')
        .select('id, action, reason, metadata, created_at')
        .eq('target_employer_id', auth.user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const currentStatus = normalizeEmployerStatus(profile?.employer_status);
    const guidance = statusGuidanceForEmployer(currentStatus);

    return c.json({
      employer_status: currentStatus,
      reviewed_at: profile?.reviewed_at || null,
      reviewed_by: profile?.reviewed_by || null,
      live_at: profile?.live_at || null,
      latest_submission: latestSubmission || null,
      latest_decision: latestAudit || null,
      guidance,
      remediation: {
        reviewer_notes: latestSubmission?.reviewer_notes || null,
        instructions: latestSubmission?.remediation_instructions || guidance.guidance,
      },
    });
  } catch (error) {
    console.error('Get onboarding status error:', error);
    return c.json({ error: 'Failed to get onboarding status' }, 500);
  }
});

// ============== ADMIN ONBOARDING ==============

app.get('/make-server-bca21fd3/admin/onboarding/queue', async (c) => {
  try {
    const auth = await requireAdmin(c.req.header('Authorization'));
    if (!auth.user) return c.json({ error: auth.error }, auth.code);

    const statusFilter = String(c.req.query('status') || '').trim().toLowerCase();
    const minAgeHours = Math.max(0, Number.parseInt(String(c.req.query('minAgeHours') || '0'), 10) || 0);
    const db = getDb();

    let query = db
      .from('employer_onboarding_submissions')
      .select('id, employer_id, revision_no, status, company_name, contact_name, contact_email, submitted_at, updated_at, reviewer_notes, remediation_instructions')
      .order('submitted_at', { ascending: true });

    if ((EMPLOYER_STATUS_VALUES as readonly string[]).includes(statusFilter)) {
      query = query.eq('status', statusFilter);
    }

    const { data: rows, error } = await query;
    if (error) throw error;

    const now = Date.now();
    const filtered = (rows || []).filter((row: Record<string, unknown>) => {
      const submittedAt = Date.parse(String(row.submitted_at || ''));
      if (Number.isNaN(submittedAt)) return minAgeHours === 0;
      const ageHours = Math.floor((now - submittedAt) / (1000 * 60 * 60));
      return ageHours >= minAgeHours;
    });

    const employerIds = [...new Set(filtered.map((row: Record<string, unknown>) => String(row.employer_id || '')))].filter(Boolean);
    const { data: employerProfiles } = employerIds.length > 0
      ? await db.from('profiles').select('id, name, email, employer_status').in('id', employerIds)
      : { data: [] as Record<string, unknown>[] };

    const employerMap: Record<string, Record<string, unknown>> = {};
    (employerProfiles || []).forEach((profile: Record<string, unknown>) => {
      employerMap[String(profile.id)] = profile;
    });

    const queue = filtered.map((row: Record<string, unknown>) => {
      const submittedAt = Date.parse(String(row.submitted_at || ''));
      const ageHours = Number.isNaN(submittedAt) ? null : Math.floor((now - submittedAt) / (1000 * 60 * 60));
      const employer = employerMap[String(row.employer_id)] || {};
      return {
        ...row,
        age_hours: ageHours,
        employer_name: employer.name || row.company_name || 'Employer',
        employer_email: employer.email || row.contact_email || null,
        employer_status: employer.employer_status || row.status,
      };
    });

    return c.json({ queue, count: queue.length });
  } catch (error) {
    console.error('Admin onboarding queue error:', error);
    return c.json({ error: 'Failed to load onboarding queue' }, 500);
  }
});

app.get('/make-server-bca21fd3/admin/onboarding/queue/:employerId', async (c) => {
  try {
    const auth = await requireAdmin(c.req.header('Authorization'));
    if (!auth.user) return c.json({ error: auth.error }, auth.code);

    const employerId = c.req.param('employerId');
    const db = getDb();

    const [{ data: submission }, { data: documents }, { data: employer }] = await Promise.all([
      db
        .from('employer_onboarding_submissions')
        .select('*')
        .eq('employer_id', employerId)
        .order('revision_no', { ascending: false })
        .limit(1)
        .maybeSingle(),
      db
        .from('employer_onboarding_documents')
        .select('*')
        .eq('employer_id', employerId)
        .order('created_at', { ascending: false }),
      db
        .from('profiles')
        .select('id, name, email, employer_status, reviewed_at, reviewed_by')
        .eq('id', employerId)
        .maybeSingle(),
    ]);

    if (!submission) return c.json({ error: 'Onboarding submission not found' }, 404);

    return c.json({
      submission,
      documents: documents || [],
      employer: employer || null,
    });
  } catch (error) {
    console.error('Admin onboarding detail error:', error);
    return c.json({ error: 'Failed to load onboarding detail' }, 500);
  }
});

app.post('/make-server-bca21fd3/admin/onboarding/:employerId/decision', async (c) => {
  try {
    const auth = await requireAdmin(c.req.header('Authorization'));
    if (!auth.user) return c.json({ error: auth.error }, auth.code);

    const employerId = c.req.param('employerId');
    const body = await c.req.json();
    const action = String(body.action || '').trim().toLowerCase();
    const reason = String(body.reason || '').trim();
    const reviewerNotes = body.reviewerNotes ? String(body.reviewerNotes).trim() : null;
    const remediationInstructions = body.remediationInstructions ? String(body.remediationInstructions).trim() : null;

    const actionToStatus: Record<string, EmployerStatus> = {
      approve: 'approved',
      reject: 'rejected',
      request_info: 'needs_info',
      suspend: 'suspended',
      reactivate: 'approved',
    };

    if (!Object.prototype.hasOwnProperty.call(actionToStatus, action)) {
      return c.json({ error: 'Invalid onboarding action' }, 400);
    }

    if (['reject', 'request_info', 'suspend'].includes(action) && !reason) {
      return c.json({ error: 'Reason is required for this action' }, 400);
    }

    const db = getDb();
    const [{ data: targetProfile }, { data: latestSubmission }] = await Promise.all([
      db.from('profiles').select('id, email, name, employer_status').eq('id', employerId).maybeSingle(),
      db
        .from('employer_onboarding_submissions')
        .select('*')
        .eq('employer_id', employerId)
        .order('revision_no', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (!targetProfile) return c.json({ error: 'Employer not found' }, 404);
    if (!latestSubmission) return c.json({ error: 'No onboarding submission found for employer' }, 400);

    const statusTo = actionToStatus[action];
    const statusFrom = normalizeEmployerStatus(targetProfile.employer_status);
    const nowIso = new Date().toISOString();

    const profileUpdate: Record<string, unknown> = {
      employer_status: statusTo,
      reviewed_at: nowIso,
      reviewed_by: auth.user.id,
      updated_at: nowIso,
    };

    if (statusTo === 'approved') {
      profileUpdate.live_at = nowIso;
    }

    const { data: updatedProfile, error: profileError } = await db
      .from('profiles')
      .update(profileUpdate)
      .eq('id', employerId)
      .select('id, employer_status, reviewed_at, reviewed_by, live_at')
      .single();

    if (profileError) throw profileError;

    const { data: updatedSubmission, error: submissionError } = await db
      .from('employer_onboarding_submissions')
      .update({
        status: statusTo,
        reviewer_notes: reviewerNotes,
        remediation_instructions: remediationInstructions,
        decision_reason: reason || null,
        updated_at: nowIso,
      })
      .eq('id', latestSubmission.id)
      .select('*')
      .single();

    if (submissionError) throw submissionError;

    await writeOnboardingAuditEvent(db, {
      actorId: auth.user.id,
      targetEmployerId: employerId,
      submissionId: latestSubmission.id,
      action: action as 'approve' | 'reject' | 'request_info' | 'suspend' | 'reactivate',
      reason: reason || null,
      metadata: {
        status_from: statusFrom,
        status_to: statusTo,
        reviewer_notes: reviewerNotes,
        remediation_instructions: remediationInstructions,
      },
    });

    const targetEmail = String(targetProfile.email || '').trim().toLowerCase();
    if (/^\S+@\S+\.\S+$/.test(targetEmail)) {
      try {
        const eventKey = `onboarding:${employerId}:decision:${action}:${nowIso}`;
        const templateConfig: Record<string, { subject: string; templateKey: string; template: string }> = {
          approve: {
            subject: 'Your employer onboarding has been approved',
            templateKey: 'employer_onboarding_approved',
            template: 'Hi {{company_name}}, great news! Your onboarding has been approved and your employer account is now active.',
          },
          reject: {
            subject: 'Your employer onboarding was rejected',
            templateKey: 'employer_onboarding_rejected',
            template: 'Hi {{company_name}}, your onboarding was rejected. Reason: {{reason}}. Please review guidance and resubmit if eligible.',
          },
          request_info: {
            subject: 'More information is required for onboarding',
            templateKey: 'employer_onboarding_needs_info',
            template: 'Hi {{company_name}}, we need additional information to continue onboarding. Guidance: {{guidance}}',
          },
          suspend: {
            subject: 'Your employer account has been suspended',
            templateKey: 'employer_onboarding_suspended',
            template: 'Hi {{company_name}}, your employer account has been suspended. Reason: {{reason}}',
          },
          reactivate: {
            subject: 'Your employer account has been reactivated',
            templateKey: 'employer_onboarding_reactivated',
            template: 'Hi {{company_name}}, your employer account has been reactivated and employer operations are available again.',
          },
        };

        const selectedTemplate = templateConfig[action];

        await dispatchProductEmail(db, {
          eventType: `onboarding.${action}`,
          eventKey,
          recipientEmail: targetEmail,
          subject: selectedTemplate.subject,
          templateKey: selectedTemplate.templateKey,
          category: 'employer_communications',
          template: selectedTemplate.template,
          templateVars: {
            company_name: String(targetProfile.name || 'Employer'),
            reason: reason || 'Not specified',
            guidance: remediationInstructions || reviewerNotes || statusGuidanceForEmployer(statusTo).guidance,
          },
        });
      } catch (notifyError) {
        console.error('Onboarding decision notification failed:', notifyError);
      }
    }

    return c.json({
      profile: updatedProfile,
      submission: updatedSubmission,
      transition: { from: statusFrom, to: statusTo, action },
    });
  } catch (error) {
    console.error('Admin onboarding decision error:', error);
    return c.json({ error: 'Failed to apply onboarding decision' }, 500);
  }
});

// ============== REFERRAL ROUTES (stub â€” future migration) ==============

app.post('/make-server-bca21fd3/referrals', async (c) => {
  try {
    const auth = await requireSeeker(c.req.header('Authorization'));
    if (!auth.user) return c.json({ error: auth.error }, auth.code);

    const { refereeEmail } = await c.req.json();
    const db = getDb();

    if (refereeEmail && !/^\S+@\S+\.\S+$/.test(String(refereeEmail).trim())) {
      return c.json({ error: 'Invalid referee email' }, 400);
    }

    const { data: referral, error } = await db
      .from('referrals')
      .insert({ referrer_id: auth.user.id, referee_email: refereeEmail || null, status: 'invited', payout: 0 })
      .select()
      .single();

    if (error) throw error;

    let inviteEmailStatus: 'not_sent' | 'sent' | 'failed' = 'not_sent';
    let inviteEmailError: string | null = null;

    if (refereeEmail) {
      try {
        const referralLink = `https://recruitfriend.co.za/ref/${auth.user.id.slice(0, 8)}`;
        const result = await dispatchProductEmail(db, {
          eventType: 'referral.invite',
          eventKey: `referral:${referral.id}:invite:${String(refereeEmail).trim().toLowerCase()}`,
          recipientEmail: String(refereeEmail).trim().toLowerCase(),
          subject: 'You have been invited to join RecruitFriend',
          templateKey: 'referral_invite',
          category: 'referrals',
          template: 'Hi {{candidate_name}}, {{referrer_name}} invited you to join RecruitFriend. Use this referral link: {{referral_link}}',
          templateVars: {
            candidate_name: String(refereeEmail).split('@')[0],
            referrer_name: String(auth.user.user_metadata?.name || 'A friend'),
            referral_link: referralLink,
          },
        });

        inviteEmailStatus = result.status === 'sent' || result.status === 'deduplicated' ? 'sent' : 'not_sent';
      } catch (emailError) {
        inviteEmailStatus = 'failed';
        inviteEmailError = emailError instanceof Error ? emailError.message : String(emailError || 'Failed to send referral invite email');
      }

      const { error: inviteUpdateError } = await db
        .from('referrals')
        .update({
          invite_email_status: inviteEmailStatus,
          invite_email_last_error: inviteEmailError,
          invite_email_sent_at: inviteEmailStatus === 'sent' ? new Date().toISOString() : null,
          invite_email_attempt_count: 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', referral.id);

      if (inviteUpdateError && !isMissingColumnError(inviteUpdateError)) {
        console.error('Failed to update referral invite email status:', inviteUpdateError);
      }
    }

    return c.json({ referral });
  } catch (error) {
    console.error('Create referral error:', error);
    return c.json({ error: 'Failed to create referral' }, 500);
  }
});

app.get('/make-server-bca21fd3/referrals/my', async (c) => {
  try {
    const auth = await requireSeeker(c.req.header('Authorization'));
    if (!auth.user) return c.json({ error: auth.error }, auth.code);

    const db = getDb();
    const { data: referrals, error } = await db
      .from('referrals')
      .select('*')
      .eq('referrer_id', auth.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const rows = referrals || [];
    const total = rows.reduce((sum: number, r: Record<string, unknown>) => sum + Number(r.payout || 0), 0);
    const pending = rows
      .filter((r: Record<string, unknown>) => r.status !== 'hired')
      .reduce((sum: number, r: Record<string, unknown>) => sum + Number(r.payout || 0), 0);
    const available = Math.max(0, total - pending);

    return c.json({
      referralLink: `https://recruitfriend.co.za/ref/${auth.user.id.slice(0, 8)}`,
      referrals: rows,
      stats: { active: rows.filter((r: Record<string, unknown>) => r.status !== 'hired').length },
      earnings: { total, pending, available },
    });
  } catch (error) {
    console.error('Get referrals error:', error);
    return c.json({ error: 'Failed to get referrals' }, 500);
  }
});

app.post('/make-server-bca21fd3/email/team-invites/send', async (c) => {
  try {
    const auth = await requireApprovedEmployer(c.req.header('Authorization'));
    if (!auth.user) return c.json({ error: auth.error }, auth.code);

    const body = await c.req.json();
    const inviteEmails = Array.isArray(body?.emails) ? body.emails : [];
    const normalizedEmails = [...new Set(inviteEmails
      .map((email: unknown) => String(email || '').trim().toLowerCase())
      .filter((email: string) => /^\S+@\S+\.\S+$/.test(email)))];

    if (normalizedEmails.length === 0) {
      return c.json({ error: 'At least one valid invite email is required' }, 400);
    }

    const db = getDb();
    const { data: employerProfile } = await db
      .from('profiles')
      .select('name')
      .eq('id', auth.user.id)
      .maybeSingle();

    let sent = 0;
    let failed = 0;

    for (const email of normalizedEmails) {
      try {
        const result = await dispatchProductEmail(db, {
          eventType: 'employer.team_invite',
          eventKey: `team-invite:${auth.user.id}:${email}:${new Date().toISOString()}`,
          recipientEmail: email,
          subject: `${String(employerProfile?.name || 'RecruitFriend employer')} invited you to collaborate`,
          templateKey: 'team_invite',
          category: 'employer_communications',
          template: 'Hi {{candidate_name}}, {{company_name}} invited you to join their RecruitFriend hiring workspace.',
          templateVars: {
            candidate_name: email.split('@')[0],
            company_name: String(employerProfile?.name || 'RecruitFriend employer'),
          },
        });

        if (result.status === 'sent' || result.status === 'deduplicated') {
          sent += 1;
        }
      } catch (error) {
        failed += 1;
        console.error('Team invite email send failed:', error);
      }
    }

    return c.json({ sent, failed, total: normalizedEmails.length });
  } catch (error) {
    console.error('Send team invites error:', error);
    return c.json({ error: 'Failed to send team invites' }, 500);
  }
});

// ============== ALERTS ==============

app.get('/make-server-bca21fd3/alerts', async (c) => {
  try {
    const auth = await requireSeeker(c.req.header('Authorization'));
    if (!auth.user) return c.json({ error: auth.error }, auth.code);

    const db = getDb();
    const { data: alerts, error } = await db
      .from('job_alerts')
      .select('*')
      .eq('seeker_id', auth.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return c.json({ alerts: alerts || [] });
  } catch (error) {
    console.error('Get alerts error:', error);
    return c.json({ error: 'Failed to get alerts' }, 500);
  }
});

app.post('/make-server-bca21fd3/alerts', async (c) => {
  try {
    const auth = await requireSeeker(c.req.header('Authorization'));
    if (!auth.user) return c.json({ error: auth.error }, auth.code);

    const { keywords, location, minSalary, frequency, types, active } = await c.req.json();
    if (!keywords || typeof keywords !== 'string' || !keywords.trim()) {
      return c.json({ error: 'Keywords are required' }, 400);
    }

    const db = getDb();
    const normalizedFrequency = (frequency || 'daily').toLowerCase();
    const nowIso = new Date().toISOString();
    const { data: alert, error } = await db
      .from('job_alerts')
      .insert({
        seeker_id: auth.user.id,
        keywords: keywords.trim(),
        location: location || null,
        min_salary: minSalary || null,
        frequency: normalizedFrequency,
        types: Array.isArray(types) ? types : [],
        active: active ?? true,
        next_dispatch_at: nextDispatchForFrequency(normalizedFrequency),
        last_dispatch_status: 'pending',
        updated_at: nowIso,
      })
      .select()
      .single();

    if (error) throw error;
    return c.json({ alert });
  } catch (error) {
    console.error('Create alert error:', error);
    return c.json({ error: 'Failed to create alert' }, 500);
  }
});

app.put('/make-server-bca21fd3/alerts/:id', async (c) => {
  try {
    const auth = await requireSeeker(c.req.header('Authorization'));
    if (!auth.user) return c.json({ error: auth.error }, auth.code);

    const id = c.req.param('id');
    const { keywords, location, minSalary, frequency, types, active } = await c.req.json();
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (keywords !== undefined) payload.keywords = String(keywords).trim();
    if (location !== undefined) payload.location = location || null;
    if (minSalary !== undefined) payload.min_salary = minSalary || null;
    if (frequency !== undefined) {
      const normalizedFrequency = String(frequency).toLowerCase();
      payload.frequency = normalizedFrequency;
      payload.next_dispatch_at = nextDispatchForFrequency(normalizedFrequency);
    }
    if (types !== undefined) payload.types = Array.isArray(types) ? types : [];
    if (active !== undefined) {
      payload.active = !!active;
      if (active) {
        payload.next_dispatch_at = nextDispatchForFrequency(String(payload.frequency || 'daily'));
      }
    }

    const db = getDb();
    const { data: alert, error } = await db
      .from('job_alerts')
      .update(payload)
      .eq('id', id)
      .eq('seeker_id', auth.user.id)
      .select()
      .single();

    if (error) throw error;
    return c.json({ alert });
  } catch (error) {
    console.error('Update alert error:', error);
    return c.json({ error: 'Failed to update alert' }, 500);
  }
});

app.delete('/make-server-bca21fd3/alerts/:id', async (c) => {
  try {
    const auth = await requireSeeker(c.req.header('Authorization'));
    if (!auth.user) return c.json({ error: auth.error }, auth.code);

    const id = c.req.param('id');
    const db = getDb();
    const { error } = await db.from('job_alerts').delete().eq('id', id).eq('seeker_id', auth.user.id);
    if (error) throw error;

    return c.json({ success: true });
  } catch (error) {
    console.error('Delete alert error:', error);
    return c.json({ error: 'Failed to delete alert' }, 500);
  }
});

app.post('/make-server-bca21fd3/alerts/dispatch', async (c) => {
  try {
    const auth = await requireSeeker(c.req.header('Authorization'));
    if (!auth.user) return c.json({ error: auth.error }, auth.code);

    const db = getDb();
    const now = new Date();
    const nowIso = now.toISOString();

    const { data: profile } = await db
      .from('profiles')
      .select('email, name')
      .eq('id', auth.user.id)
      .maybeSingle();

    const seekerEmail = String(profile?.email || auth.user.email || '').trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(seekerEmail)) {
      return c.json({ error: 'No valid seeker email found for alert dispatch' }, 400);
    }

    const { data: alerts, error } = await db
      .from('job_alerts')
      .select('*')
      .eq('seeker_id', auth.user.id)
      .eq('active', true)
      .lte('next_dispatch_at', nowIso)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const rows = alerts || [];
    let sent = 0;
    let failed = 0;

    for (const alert of rows) {
      try {
        const frequency = String(alert.frequency || 'daily').toLowerCase();
        const keyword = String(alert.keywords || 'your saved search');
        const location = String(alert.location || 'South Africa');

        await dispatchProductEmail(db, {
          eventType: 'alerts.dispatch',
          eventKey: `alert:${alert.id}:${new Date(now).toISOString().slice(0, 10)}:${frequency}`,
          recipientEmail: seekerEmail,
          subject: `New job alert matches for ${keyword}`,
          templateKey: 'seeker_alert_digest',
          category: 'alerts',
          template: 'Hi {{candidate_name}}, we found new job matches for {{keywords}} in {{location}}. Open RecruitFriend to view matches.',
          templateVars: {
            candidate_name: String(profile?.name || 'there'),
            keywords: keyword,
            location,
          },
          preferenceAllowed: async () => Boolean(alert.active),
        });

        sent += 1;

        const { error: updateError } = await db
          .from('job_alerts')
          .update({
            last_dispatched_at: nowIso,
            last_dispatch_status: 'sent',
            last_dispatch_error: null,
            next_dispatch_at: nextDispatchForFrequency(frequency, now),
            updated_at: nowIso,
          })
          .eq('id', alert.id)
          .eq('seeker_id', auth.user.id);

        if (updateError && !isMissingColumnError(updateError)) {
          console.error('Failed to update alert dispatch success metadata:', updateError);
        }
      } catch (dispatchError) {
        failed += 1;
        const errorMessage = dispatchError instanceof Error ? dispatchError.message : String(dispatchError || 'Alert dispatch failed');

        const { error: updateError } = await db
          .from('job_alerts')
          .update({
            last_dispatch_status: 'failed',
            last_dispatch_error: errorMessage,
            next_dispatch_at: nextDispatchForFrequency(String(alert.frequency || 'daily'), now),
            updated_at: nowIso,
          })
          .eq('id', alert.id)
          .eq('seeker_id', auth.user.id);

        if (updateError && !isMissingColumnError(updateError)) {
          console.error('Failed to update alert dispatch failure metadata:', updateError);
        }
      }
    }

    return c.json({ dispatched: rows.length, sent, failed });
  } catch (error) {
    console.error('Dispatch alerts error:', error);
    return c.json({ error: 'Failed to dispatch alerts' }, 500);
  }
});

// ============== CV SETTINGS & FILES ==============

app.get('/make-server-bca21fd3/cv/settings', async (c) => {
  try {
    const auth = await requireSeeker(c.req.header('Authorization'));
    if (!auth.user) return c.json({ error: auth.error }, auth.code);

    const db = getDb();
    const { data, error } = await db.from('cv_settings').select('*').eq('seeker_id', auth.user.id).single();
    if (error && error.code !== 'PGRST116') throw error;

    return c.json({ settings: data || { template: 'classic', visibility: true, last_synced_at: null } });
  } catch (error) {
    console.error('Get cv settings error:', error);
    return c.json({ error: 'Failed to get CV settings' }, 500);
  }
});

app.put('/make-server-bca21fd3/cv/settings', async (c) => {
  try {
    const auth = await requireSeeker(c.req.header('Authorization'));
    if (!auth.user) return c.json({ error: auth.error }, auth.code);

    const { template, visibility } = await c.req.json();
    const db = getDb();
    const { data, error } = await db
      .from('cv_settings')
      .upsert({
        seeker_id: auth.user.id,
        template: template || 'classic',
        visibility: visibility ?? true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'seeker_id' })
      .select()
      .single();

    if (error) throw error;
    return c.json({ settings: data });
  } catch (error) {
    console.error('Update cv settings error:', error);
    return c.json({ error: 'Failed to update CV settings' }, 500);
  }
});

app.post('/make-server-bca21fd3/cv/settings/sync', async (c) => {
  try {
    const auth = await requireSeeker(c.req.header('Authorization'));
    if (!auth.user) return c.json({ error: auth.error }, auth.code);

    const now = new Date().toISOString();
    const db = getDb();
    const { data, error } = await db
      .from('cv_settings')
      .upsert({
        seeker_id: auth.user.id,
        last_synced_at: now,
        updated_at: now,
      }, { onConflict: 'seeker_id' })
      .select()
      .single();

    if (error) throw error;
    return c.json({ synced: true, settings: data });
  } catch (error) {
    console.error('Sync cv settings error:', error);
    return c.json({ error: 'Failed to sync CV settings' }, 500);
  }
});

app.get('/make-server-bca21fd3/cv/files', async (c) => {
  try {
    const auth = await requireSeeker(c.req.header('Authorization'));
    if (!auth.user) return c.json({ error: auth.error }, auth.code);

    const db = getDb();
    const { data, error } = await db
      .from('cv_files')
      .select('*')
      .eq('seeker_id', auth.user.id)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return c.json({ files: data || [] });
  } catch (error) {
    console.error('Get cv files error:', error);
    return c.json({ error: 'Failed to get CV files' }, 500);
  }
});

app.post('/make-server-bca21fd3/cv/files', async (c) => {
  try {
    const auth = await requireSeeker(c.req.header('Authorization'));
    if (!auth.user) return c.json({ error: auth.error }, auth.code);

    const { fileName, size } = await c.req.json();
    if (!fileName || typeof fileName !== 'string') {
      return c.json({ error: 'fileName is required' }, 400);
    }

    const db = getDb();
    const { data, error } = await db
      .from('cv_files')
      .insert({ seeker_id: auth.user.id, file_name: fileName, file_size: Number(size) || 0 })
      .select()
      .single();

    if (error) throw error;
    return c.json({ file: data });
  } catch (error) {
    console.error('Create cv file error:', error);
    return c.json({ error: 'Failed to create CV file' }, 500);
  }
});

app.put('/make-server-bca21fd3/cv/files/:id', async (c) => {
  try {
    const auth = await requireSeeker(c.req.header('Authorization'));
    if (!auth.user) return c.json({ error: auth.error }, auth.code);

    const id = c.req.param('id');
    const { fileName, size } = await c.req.json();
    const db = getDb();
    const { data, error } = await db
      .from('cv_files')
      .update({
        file_name: fileName,
        file_size: Number(size) || 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('seeker_id', auth.user.id)
      .select()
      .single();

    if (error) throw error;
    return c.json({ file: data });
  } catch (error) {
    console.error('Update cv file error:', error);
    return c.json({ error: 'Failed to update CV file' }, 500);
  }
});

app.delete('/make-server-bca21fd3/cv/files/:id', async (c) => {
  try {
    const auth = await requireSeeker(c.req.header('Authorization'));
    if (!auth.user) return c.json({ error: auth.error }, auth.code);

    const id = c.req.param('id');
    const db = getDb();
    const { error } = await db
      .from('cv_files')
      .delete()
      .eq('id', id)
      .eq('seeker_id', auth.user.id);

    if (error) throw error;
    return c.json({ success: true });
  } catch (error) {
    console.error('Delete cv file error:', error);
    return c.json({ error: 'Failed to delete CV file' }, 500);
  }
});

// ============== SUBSCRIPTIONS ==============

app.post('/make-server-bca21fd3/subscriptions/change', async (c) => {
  try {
    const auth = await requireSeeker(c.req.header('Authorization'));
    if (!auth.user) return c.json({ error: auth.error }, auth.code);

    const { plan } = await c.req.json();
    const allowed = ['free', 'premium', 'professional'];
    const normalizedPlan = String(plan || '').toLowerCase();

    if (!allowed.includes(normalizedPlan)) {
      return c.json({ error: 'Invalid plan' }, 400);
    }

    const db = getDb();
    const { data: profile, error } = await db
      .from('profiles')
      .update({ subscription: normalizedPlan, updated_at: new Date().toISOString() })
      .eq('id', auth.user.id)
      .select('subscription')
      .single();

    if (error) throw error;
    return c.json({ subscription: profile.subscription, effectiveAt: new Date().toISOString() });
  } catch (error) {
    console.error('Change subscription error:', error);
    return c.json({ error: 'Failed to change subscription' }, 500);
  }
});

app.post('/make-server-bca21fd3/subscriptions/trial', async (c) => {
  try {
    const auth = await requireSeeker(c.req.header('Authorization'));
    if (!auth.user) return c.json({ error: auth.error }, auth.code);

    const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const db = getDb();
    const { data: profile, error } = await db
      .from('profiles')
      .update({ subscription: 'premium_trial', updated_at: new Date().toISOString() })
      .eq('id', auth.user.id)
      .select('subscription')
      .single();

    if (error) throw error;
    return c.json({ subscription: profile.subscription, trialEndsAt });
  } catch (error) {
    console.error('Start subscription trial error:', error);
    return c.json({ error: 'Failed to start trial' }, 500);
  }
});

// ============== SAVED JOBS ==============

// Save job
app.post('/make-server-bca21fd3/saved-jobs', async (c) => {
  try {
    const user = await getAuthUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const { jobId } = await c.req.json();
    const db = getDb();

    const { error } = await db.from('saved_jobs').insert({ seeker_id: user.id, job_id: jobId });
    if (error) throw error;
    return c.json({ success: true });
  } catch (error) {
    console.error('Save job error:', error);
    return c.json({ error: 'Failed to save job' }, 500);
  }
});

// Get saved jobs
app.get('/make-server-bca21fd3/saved-jobs', async (c) => {
  try {
    const user = await getAuthUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const db = getDb();
    const { data, error } = await db
      .from('saved_jobs')
      .select('*, job:jobs(*)')
      .eq('seeker_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    const jobs = (data || []).map((s: Record<string, unknown>) => s.job).filter(Boolean);
    return c.json({ jobs });
  } catch (error) {
    console.error('Get saved jobs error:', error);
    return c.json({ error: 'Failed to get saved jobs' }, 500);
  }
});

// Get saved jobs count
app.get('/make-server-bca21fd3/saved-jobs/count', async (c) => {
  try {
    const user = await getAuthUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const db = getDb();
    const { count, error } = await db
      .from('saved_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('seeker_id', user.id);

    if (error) throw error;
    return c.json({ count: count || 0 });
  } catch (error) {
    console.error('Get saved jobs count error:', error);
    return c.json({ error: 'Failed to get count' }, 500);
  }
});

// Delete saved job
app.delete('/make-server-bca21fd3/saved-jobs/:jobId', async (c) => {
  try {
    const user = await getAuthUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const jobId = c.req.param('jobId');
    const db = getDb();

    const { error } = await db.from('saved_jobs').delete().eq('seeker_id', user.id).eq('job_id', jobId);
    if (error) throw error;
    return c.json({ success: true });
  } catch (error) {
    console.error('Delete saved job error:', error);
    return c.json({ error: 'Failed to delete saved job' }, 500);
  }
});

// ============== PROFILE VIEWS (stub) ==============

app.get('/make-server-bca21fd3/profile/views', async (c) => {
  const user = await getAuthUser(c.req.header('Authorization'));
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  return c.json({ views: 0 });
});

// ============== PLATFORM STATS ==============

app.get('/make-server-bca21fd3/stats', async (c) => {
  try {
    const db = getDb();

    const [
      { count: activeJobs },
      { count: seekers },
      { count: employers },
      { count: totalApplications },
    ] = await Promise.all([
      db.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      db.from('profiles').select('*', { count: 'exact', head: true }).eq('user_type', 'seeker'),
      db.from('profiles').select('*', { count: 'exact', head: true }).eq('user_type', 'employer'),
      db.from('applications').select('*', { count: 'exact', head: true }),
    ]);

    return c.json({
      activeJobs: activeJobs || 0,
      seekers: seekers || 0,
      employers: employers || 0,
      companies: employers || 0,
      totalApplications: totalApplications || 0,
    });
  } catch (error) {
    console.error('Get stats error:', error);
    return c.json({ error: 'Failed to get stats' }, 500);
  }
});

console.log('RecruitFriend server starting...');
Deno.serve(app.fetch);

