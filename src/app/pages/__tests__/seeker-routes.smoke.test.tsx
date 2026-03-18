import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import SeekerDashboard from '../SeekerDashboard';
import SeekerApplications from '../SeekerApplications';
import SeekerSavedJobs from '../SeekerSavedJobs';
import SeekerAlerts from '../SeekerAlerts';
import SeekerCV from '../SeekerCV';
import VideoInterviews from '../VideoInterviews';
import Networking from '../Networking';
import SeekerSubscriptions from '../SeekerSubscriptions';

const apiCallMock = vi.fn(async (endpoint: string) => {
  if (endpoint.includes('/applications/my')) {
    return { applications: [] };
  }
  if (endpoint.includes('/saved-jobs/count')) {
    return { count: 0 };
  }
  if (endpoint.includes('/saved-jobs')) {
    return { jobs: [] };
  }
  if (endpoint.includes('/profile/views')) {
    return { views: 0 };
  }
  if (endpoint.includes('/jobs')) {
    return { jobs: [] };
  }
  if (endpoint.includes('/alerts')) {
    return { alerts: [] };
  }
  if (endpoint.includes('/cv/settings')) {
    return { settings: { template: 'classic', visibility: true, last_synced_at: null } };
  }
  if (endpoint.includes('/cv/files')) {
    return { files: [] };
  }
  if (endpoint.includes('/referrals/my')) {
    return { referrals: [], referralLink: 'https://recruitfriend.co.za/ref/test', earnings: { total: 0, pending: 0, available: 0 }, stats: { active: 0 } };
  }
  return {};
});

vi.mock('../../context/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
    profile: { id: 'user-1', name: 'Test User', email: 'test@example.com', subscription: 'free' },
    loading: false,
    refreshProfile: vi.fn(),
  }),
}));

vi.mock('../../lib/supabase', () => ({
  apiCall: (...args: unknown[]) => apiCallMock(...args),
}));

function renderPage(node: ReactNode) {
  return render(<MemoryRouter>{node}</MemoryRouter>);
}

describe('Seeker routes smoke tests', () => {
  beforeEach(() => {
    apiCallMock.mockClear();
  });

  it('renders all seeker pages without crashing', async () => {
    renderPage(<SeekerDashboard />);
    expect(await screen.findByText(/Application Pipeline/i)).toBeInTheDocument();
    cleanup();

    renderPage(<SeekerApplications />);
    expect(await screen.findByRole('heading', { name: /My Applications/i })).toBeInTheDocument();
    cleanup();

    renderPage(<SeekerSavedJobs />);
    expect(await screen.findByRole('heading', { name: /^Saved Jobs$/i })).toBeInTheDocument();
    cleanup();

    renderPage(<SeekerAlerts />);
    expect(await screen.findByRole('heading', { name: /Job Alerts/i })).toBeInTheDocument();
    cleanup();

    renderPage(<SeekerCV />);
    expect(await screen.findByText(/Download Options/i)).toBeInTheDocument();
    cleanup();

    renderPage(<VideoInterviews />);
    expect(await screen.findByRole('heading', { name: /Video Interviews/i })).toBeInTheDocument();
    cleanup();

    renderPage(<Networking />);
    expect(await screen.findByRole('heading', { name: /My RecruitFriend Network/i })).toBeInTheDocument();
    cleanup();

    renderPage(<SeekerSubscriptions />);
    expect(await screen.findByRole('heading', { name: /Upgrade Your Career/i })).toBeInTheDocument();
  });

  it('does not render dead # anchors in seeker alerts panel', async () => {
    const { container } = renderPage(<SeekerAlerts />);
    await screen.findByText(/Recent Alert Emails/i);
    const deadAnchors = container.querySelectorAll('a[href="#"]');
    expect(deadAnchors.length).toBe(0);
  });
});
