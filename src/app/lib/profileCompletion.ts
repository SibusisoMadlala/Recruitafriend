import { UserProfile } from '../types';

/**
 * Calculates profile completion percentage (0–100) based on filled profile fields.
 * Shared utility used by both SeekerLayout and ProfileBuilder.
 */
export function calculateProfileCompletion(profile: Partial<UserProfile> | null): number {
  if (!profile) return 0;

  const checks: boolean[] = [
    Boolean(profile.name?.trim()),
    Boolean(profile.headline?.trim()),
    Boolean(profile.summary?.trim()),
    Boolean(profile.phone?.trim()),
    Boolean(profile.location?.trim()),
    Boolean(profile.avatar_url?.trim()),
    Array.isArray(profile.skills) && profile.skills.length > 0,
    Array.isArray(profile.experience) && profile.experience.length > 0,
    Array.isArray(profile.education) && profile.education.length > 0,
    Boolean(
      (profile.social_links as Record<string, string> | undefined)?.linkedin?.trim()
    ),
  ];

  const filled = checks.filter(Boolean).length;
  return Math.round((filled / checks.length) * 100);
}
