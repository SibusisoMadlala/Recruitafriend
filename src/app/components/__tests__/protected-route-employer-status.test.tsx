import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router';
import { render, screen } from '@testing-library/react';

import ProtectedRoute from '../ProtectedRoute';

const useAuthMock = vi.fn();

vi.mock('../../context/useAuth', () => ({
  useAuth: () => useAuthMock(),
}));

describe('ProtectedRoute employer status gating', () => {
  it('redirects non-approved employer to onboarding status page', () => {
    useAuthMock.mockReturnValue({
      user: { user_metadata: { userType: 'employer' } },
      profile: { userType: 'employer', employer_status: 'pending_review' },
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={['/employer/dashboard']}>
        <Routes>
          <Route
            path="/employer/dashboard"
            element={(
              <ProtectedRoute role="employer" requireApprovedEmployer>
                <div>Employer dashboard</div>
              </ProtectedRoute>
            )}
          />
          <Route path="/employer/onboarding-status" element={<div>Onboarding status</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Onboarding status')).toBeInTheDocument();
  });

  it('allows approved employer to continue to target route', () => {
    useAuthMock.mockReturnValue({
      user: { user_metadata: { userType: 'employer' } },
      profile: { userType: 'employer', employer_status: 'approved' },
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={['/employer/dashboard']}>
        <Routes>
          <Route
            path="/employer/dashboard"
            element={(
              <ProtectedRoute role="employer" requireApprovedEmployer>
                <div>Employer dashboard</div>
              </ProtectedRoute>
            )}
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Employer dashboard')).toBeInTheDocument();
  });

  it('allows snake_case admin profile role to reach admin routes', () => {
    useAuthMock.mockReturnValue({
      user: { user_metadata: { userType: 'seeker' } },
      profile: { user_type: 'admin' },
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={['/admin/dashboard']}>
        <Routes>
          <Route
            path="/admin/dashboard"
            element={(
              <ProtectedRoute role="admin">
                <div>Admin dashboard</div>
              </ProtectedRoute>
            )}
          />
          <Route path="/seeker/dashboard" element={<div>Seeker dashboard</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Admin dashboard')).toBeInTheDocument();
  });
});
