import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Navbar } from '../Navbar';
import { EmployerSidebar } from '../EmployerSidebar';
import SeekerLayout from '../../layouts/SeekerLayout';
import Signup from '../../pages/Signup';
import Homepage from '../../pages/Homepage';
import EmployerApplicants from '../../pages/EmployerApplicants';

const apiCallMock = vi.fn(async (endpoint: string) => {
  if (endpoint === '/stats') {
    return { activeJobs: 12, seekers: 34, companies: 5 };
  }
  if (endpoint === '/jobs') {
    return {
      jobs: [
        {
          id: 'job-1',
          title: 'Frontend Engineer',
          company: 'RecruitFriend',
          location: 'Cape Town',
          remoteType: 'remote',
          salaryMin: 25000,
          salaryMax: 40000,
          jobType: 'Full-time',
        },
      ],
    };
  }
  if (endpoint === '/employer/jobs') {
    return { jobs: [{ id: 'job-1', title: 'Frontend Engineer', apps: 1 }] };
  }
  if (endpoint === '/jobs/job-1/applications') {
    return {
      applications: [
        {
          id: 'app-1',
          job_id: 'job-1',
          status: 'applied',
          cover_letter: 'Excited to contribute.',
          created_at: '2026-03-18T09:00:00.000Z',
          seeker: {
            id: 'seeker-1',
            name: 'Ava Candidate',
            email: 'ava@example.com',
            avatar_url: null,
            headline: 'Frontend Developer',
          },
        },
      ],
    };
  }
  if (endpoint.startsWith('/employer/seeker/')) {
    return {
      profile: {
        id: 'seeker-1',
        name: 'Ava Candidate',
        email: 'ava@example.com',
        headline: 'Frontend Developer',
        avatar_url: null,
      },
    };
  }
  return {};
});

const mockAuthState = {
  user: null as any,
  profile: null as any,
  loading: false,
  signOut: vi.fn(),
  signUp: vi.fn(),
  refreshProfile: vi.fn(),
};

vi.mock('../../context/useAuth', () => ({
  useAuth: () => mockAuthState,
}));

vi.mock('../../lib/supabase', () => ({
  apiCall: (...args: unknown[]) => apiCallMock(...args),
}));

function setViewport(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
  window.dispatchEvent(new Event('resize'));
}

describe('responsive layout regression coverage', () => {
  beforeEach(() => {
    apiCallMock.mockClear();
    mockAuthState.loading = false;
    mockAuthState.signOut.mockClear();
    mockAuthState.signUp.mockClear();
    mockAuthState.refreshProfile.mockClear();
    mockAuthState.user = null;
    mockAuthState.profile = null;
    setViewport(390);
  });

  it('keeps primary navigation reachable on mobile and closes on desktop resize', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>,
    );

    const mobileMenuToggle = screen.getByLabelText(/open navigation menu/i);
    const initialRegisterLinks = screen.getAllByText('Register').length;

    expect(mobileMenuToggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(mobileMenuToggle);

    expect(screen.getByLabelText(/close navigation menu/i)).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByText('For Companies').length).toBeGreaterThan(1);
    expect(screen.getAllByText('Community').length).toBeGreaterThan(1);
    expect(screen.getAllByText('Register').length).toBeGreaterThan(initialRegisterLinks);

    setViewport(1280);

    await waitFor(() => {
      expect(screen.getAllByText('Register').length).toBe(initialRegisterLinks);
    });
  });

  it('exposes responsive seeker and employer shell toggles', async () => {
    const user = userEvent.setup();
    mockAuthState.user = { id: 'user-1', user_metadata: { userType: 'seeker' } };
    mockAuthState.profile = { name: 'Taylor Seeker', userType: 'seeker', subscription: 'free', avatar_url: null };

    const { rerender } = render(
      <MemoryRouter initialEntries={['/seeker/dashboard']}>
        <Routes>
          <Route path="/seeker" element={<SeekerLayout />}>
            <Route path="dashboard" element={<div>Dashboard body</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    const seekerToggle = screen.getByLabelText(/open seeker navigation/i);
    expect(seekerToggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(seekerToggle);
    expect(seekerToggle).toHaveAttribute('aria-expanded', 'true');

    mockAuthState.user = { id: 'user-2', user_metadata: { userType: 'employer' } };
    mockAuthState.profile = { name: 'Acme Ltd', userType: 'employer', subscription: 'starter' };

    rerender(
      <MemoryRouter>
        <EmployerSidebar />
      </MemoryRouter>,
    );

    const employerToggle = screen.getByLabelText(/open employer navigation/i);
    expect(employerToggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(employerToggle);
    expect(employerToggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('uses stack-first responsive layouts on homepage and signup', async () => {
    mockAuthState.user = null;
    mockAuthState.profile = null;

    const { container: homepageContainer } = render(
      <MemoryRouter>
        <Homepage />
      </MemoryRouter>,
    );

    await screen.findByText(/Hot Jobs Right Now/i);
    expect(homepageContainer.firstChild).toHaveClass('w-full', 'overflow-x-hidden');
    expect(screen.getByText('Register as Job Seeker')).toHaveClass('w-full', 'sm:w-auto');

    const { container: signupContainer } = render(
      <MemoryRouter>
        <Signup />
      </MemoryRouter>,
    );

    const selectorGrid = signupContainer.querySelector('.grid.grid-cols-1.gap-4.sm\\:grid-cols-2');
    expect(selectorGrid).not.toBeNull();
  });

  it('keeps employer applicant workflows usable with bounded overflow containers', async () => {
    const user = userEvent.setup();
    mockAuthState.user = { id: 'user-2', user_metadata: { userType: 'employer' } };
    mockAuthState.profile = { name: 'Acme Ltd', userType: 'employer', subscription: 'starter' };

    const { container } = render(
      <MemoryRouter>
        <EmployerApplicants />
      </MemoryRouter>,
    );

    await screen.findByText('Frontend Engineer');
    expect(container.querySelector('.overflow-x-auto')).not.toBeNull();

    await user.click(screen.getByRole('button', { name: /list view/i }));

    expect(screen.getAllByText('View Profile').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('combobox').length).toBeGreaterThan(0);
  });
});
