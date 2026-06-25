/** Returns whether the employer has enabled the hideCompanyName or hideWebsite flags. */
function getHideFlags(employer: any): { hideCompanyName: boolean; hideWebsite: boolean } {
  const social =
    employer?.social_links && typeof employer.social_links === 'object'
      ? (employer.social_links as Record<string, any>)
      : {};
  const meta =
    social.employer && typeof social.employer === 'object'
      ? (social.employer as Record<string, any>)
      : {};
  return {
    hideCompanyName: Boolean(meta.hideCompanyName),
    hideWebsite: Boolean(meta.hideWebsite),
  };
}

/** Returns the display name for a company, respecting hideCompanyName (employer-level) and hide_company (job-level). */
export function resolveCompanyName(employer: any, fallback = 'Hiring Company', jobHideCompany = false): string {
  const { hideCompanyName } = getHideFlags(employer);
  if (hideCompanyName || jobHideCompany) return 'Confidential';
  return String(employer?.name || fallback).trim();
}

/** Returns the logo URL for a company, hiding it when company name is hidden. */
export function resolveCompanyLogo(employer: any, jobHideCompany = false): string {
  const { hideCompanyName } = getHideFlags(employer);
  if (hideCompanyName || jobHideCompany) return '';
  return String(employer?.avatar_url || '').trim();
}

/** Returns whether the website should be hidden. */
export function resolveHideWebsite(employer: any): boolean {
  return getHideFlags(employer).hideWebsite;
}

/** Returns the display name from a flattened application/interview object. */
export function resolveAppCompanyName(app: { company?: string; job?: { employer?: any; hide_company?: boolean } }): string {
  const employer = app.job?.employer;
  const jobHideCompany = Boolean(app.job?.hide_company);
  if (employer) {
    const { hideCompanyName } = getHideFlags(employer);
    if (hideCompanyName || jobHideCompany) return 'Confidential';
  }
  return app.company || 'Company';
}
