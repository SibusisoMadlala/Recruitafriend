import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import SeekerApplications from '../SeekerApplications';
import SeekerSavedJobs from '../SeekerSavedJobs';
import SeekerSubscriptions from '../SeekerSubscriptions';

const apiCallMock = vi.fn(async (endpoint: string, options?: RequestInit) => {
  if (endpoint === '/applications/my') {
    return {
      applications: [
        {
          id: 'app-1',
          job_id: 'job-99',
          status: 'applied',
          job_title: 'Frontend Engineer',
          company: 'Acme',
          created_at: new Date().toISOString(),
          job: { city: 'Johannesburg', province: 'Gauteng' },
        },
      ],
    };
  }

  if (endpoint === '/saved-jobs') {
    return {
      jobs: [
        {
          id: 'job-1',
          title: 'Frontend Engineer',
          employer: { name: 'Acme' },
          city: 'Johannesburg',
          province: 'Gauteng',
          salary_min: 20000,
          salary_max: 40000,
          employment_type: 'Full-time',
          created_at: new Date().toISOString(),
        },
      ],
    };
  }

  if (endpoint === '/applications' && options?.method === 'POST') {
    return { application: { id: 'app-2' } };
  }

  if (endpoint === '/saved-jobs/job-1' && options?.method === 'DELETE') {
    return { success: true };
  }

  if (endpoint === '/applications/app-1' && options?.method === 'PUT') {
    return { application: { id: 'app-1', status: 'rejected' } };
  }

  if (endpoint === '/subscriptions/change') {
    return { subscription: 'premium' };
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

describe('Seeker workflow interactions', () => {
  beforeEach(() => {
    apiCallMock.mockClear();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('withdraws an application through API call', async () => {
    render(
      <MemoryRouter>
        <SeekerApplications />
      </MemoryRouter>,
    );

    const withdrawButton = await screen.findByRole('button', { name: /Withdraw/i });
    fireEvent.click(withdrawButton);

    await waitFor(() => {
      expect(apiCallMock).toHaveBeenCalledWith('/applications/app-1', expect.objectContaining({ method: 'PUT' }));
    });
  });

  it('applies to a saved job through API call', async () => {
    render(
      <MemoryRouter>
        <SeekerSavedJobs />
      </MemoryRouter>,
    );

    const applyButton = await screen.findByRole('button', { name: /Apply Now/i });
    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(apiCallMock).toHaveBeenCalledWith('/applications', expect.objectContaining({ method: 'POST' }));
    });
  });

  it('changes plan from subscription page', async () => {
    render(
      <MemoryRouter>
        <SeekerSubscriptions />
      </MemoryRouter>,
    );

    const upgradeButton = await screen.findByRole('button', { name: /Get PREMIUM/i });
    fireEvent.click(upgradeButton);

    await waitFor(() => {
      expect(apiCallMock).toHaveBeenCalledWith('/subscriptions/change', expect.objectContaining({ method: 'POST' }));
    });
  });
});
