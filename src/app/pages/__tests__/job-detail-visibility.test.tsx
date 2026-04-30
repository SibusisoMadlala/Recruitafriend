import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router';
import { render, screen } from '@testing-library/react';

import JobDetail from '../JobDetail';

const apiCallMock = vi.fn(async (endpoint: string) => {
  if (endpoint === '/jobs/job-1') {
    return {
      job: {
        id: 'job-1',
        employer_id: 'employer-1',
        title: 'Senior Designer',
        description: 'Design the next generation of product experiences.',
        employment_type: 'full_time',
        is_visible: true,
        status: 'active',
        city: 'Cape Town',
        province: 'Western Cape',
        created_at: new Date().toISOString(),
        employer: {
          id: 'employer-1',
          name: 'Acme Labs',
          avatar_url: null,
          headline: 'Human-centred product design',
          summary: 'A collaborative team building digital products.',
          social_links: {
            website: 'https://acme.example.com',
            employer: {
              industry: 'Technology',
              companySize: '11-50',
            },
          },
        },
      },
    };
  }

  if (endpoint === '/saved-jobs') {
    return { jobs: [] };
  }

  return {};
});

vi.mock('../../context/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
    profile: { id: 'user-1', name: 'Test User', email: 'test@example.com', user_type: 'seeker', userType: 'seeker' },
    loading: false,
  }),
}));

vi.mock('../../lib/supabase', () => ({
  apiCall: (...args: unknown[]) => apiCallMock(...args),
}));

describe('Job detail company visibility', () => {
  beforeEach(() => {
    apiCallMock.mockClear();
  });

  it('shows the real company once the seeker can view progressed application details', async () => {
    render(
      <MemoryRouter initialEntries={['/jobs/job-1']}>
        <Routes>
          <Route path="/jobs/:id" element={<JobDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Senior Designer' })).toBeInTheDocument();
    expect(screen.getAllByText('Acme Labs').length).toBeGreaterThan(0);
    expect(screen.queryByText('RecruitFriend')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Website' })).toHaveAttribute('href', 'https://acme.example.com');
  });
});