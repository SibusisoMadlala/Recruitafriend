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

/** Returns the display name for a company, respecting hideCompanyName. */
export function resolveCompanyName(employer: any, fallback = 'Hiring Company'): string {
  const { hideCompanyName } = getHideFlags(employer);
  if (hideCompanyName) return 'Confidential';
  return String(employer?.name || fallback).trim();
}

/** Returns the logo URL for a company, respecting hideCompanyName (hides logo too). */
export function resolveCompanyLogo(employer: any): string {
  const { hideCompanyName } = getHideFlags(employer);
  if (hideCompanyName) return '';
  return String(employer?.avatar_url || '').trim();
}

/** Returns whether the website should be hidden. */
export function resolveHideWebsite(employer: any): boolean {
  return getHideFlags(employer).hideWebsite;
}

/** Returns the display name from a flattened application/interview object.
 *  Falls back to checking the nested job.employer if available. */
export function resolveAppCompanyName(app: { company?: string; job?: { employer?: any } }): string {
  const employer = app.job?.employer;
  if (employer) {
    const { hideCompanyName } = getHideFlags(employer);
    if (hideCompanyName) return 'Confidential';
  }
  return app.company || 'Company';
}
