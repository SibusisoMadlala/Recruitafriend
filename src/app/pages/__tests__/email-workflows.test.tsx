import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import SeekerAlerts from '../SeekerAlerts';
import Networking from '../Networking';

const apiCallMock = vi.fn(async (endpoint: string, options?: RequestInit & { requireAuth?: boolean }) => {
  if (endpoint === '/alerts' && (!options?.method || options.method === 'GET')) {
    return { alerts: [] };
  }

  if (endpoint === '/alerts/dispatch' && options?.method === 'POST') {
    return { dispatched: 0, sent: 0, failed: 0 };
  }

  if (endpoint === '/referrals/my') {
    return {
      referrals: [],
      referralLink: 'https://recruitfriend.co.za/ref/user-1',
      earnings: { total: 0, pending: 0, available: 0 },
      stats: { active: 0 },
    };
  }

  if (endpoint === '/referrals' && options?.method === 'POST') {
    return { referral: { id: 'ref-1', referee_email: 'friend@example.com', status: 'invited' } };
  }

  return {};
});

const refreshProfileMock = vi.fn(async () => {});

vi.mock('../../context/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'employer-1', email: 'owner@example.com' },
    profile: {
      id: 'employer-1',
      name: 'Acme HR',
      email: 'owner@example.com',
      userType: 'employer',
      user_type: 'employer',
      employer_status: 'approved',
      subscription: 'starter',
      social_links: {},
    },
    loading: false,
    refreshProfile: refreshProfileMock,
  }),
}));

vi.mock('../../lib/supabase', () => ({
  apiCall: (...args: unknown[]) => apiCallMock(...args),
  supabase: {
    auth: {
      updateUser: vi.fn(async () => ({ error: null })),
    },
  },
}));

describe('Email-triggered workflow interactions', () => {
  beforeEach(() => {
    apiCallMock.mockClear();
    refreshProfileMock.mockClear();
  });

  it('renders dispatch controls for seeker alerts workflow', async () => {
    render(
      <MemoryRouter>
        <SeekerAlerts />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('button', { name: /Dispatch due alerts/i })).toBeInTheDocument();
  });

  it('renders referral invite email controls', async () => {
    render(
      <MemoryRouter>
        <Networking />
      </MemoryRouter>,
    );

    expect(await screen.findByPlaceholderText('friend@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send referral invite email/i })).toBeInTheDocument();
  });

});