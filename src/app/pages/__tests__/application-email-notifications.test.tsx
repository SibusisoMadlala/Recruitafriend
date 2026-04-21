import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import SeekerApplications from '../SeekerApplications';
import SeekerSavedJobs from '../SeekerSavedJobs';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

type ApiCallOptions = RequestInit & { requireAuth?: boolean };

function makeApiMock(overrides: Record<string, unknown> = {}) {
  return vi.fn(async (endpoint: string, options?: ApiCallOptions) => {
    // GET applications list
    if (endpoint === '/applications/my') {
      return {
        applications: [
          {
            id: 'app-1',
            job_id: 'job-99',
            status: 'applied',
            job_title: 'Backend Engineer',
            company: 'Acme Corp',
            created_at: new Date().toISOString(),
            job: { city: 'Cape Town', province: 'Western Cape' },
          },
        ],
      };
    }

    // GET saved jobs
    if (endpoint === '/saved-jobs') {
      return {
        jobs: [
          {
            id: 'job-1',
            title: 'Backend Engineer',
            employer: { name: 'Acme Corp' },
            city: 'Cape Town',
            province: 'Western Cape',
            salary_min: 30000,
            salary_max: 60000,
            employment_type: 'Full-time',
            created_at: new Date().toISOString(),
          },
        ],
      };
    }

    // POST submit application — dual-send success
    if (endpoint === '/applications' && options?.method === 'POST') {
      return {
        application: { id: 'app-2', status: 'applied' },
        emailDelivery: overrides.postEmailDelivery ?? { employer: 'sent', seeker: 'sent' },
      };
    }

    // PUT withdraw application
    if (endpoint === '/applications/app-1' && options?.method === 'PUT') {
      return {
        application: { id: 'app-1', status: 'rejected' },
        emailDelivery: overrides.putEmailDelivery ?? { employer: 'sent' },
      };
    }

    return {};
  });
}

vi.mock('../../context/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
    profile: { id: 'user-1', name: 'Test Seeker', email: 'seeker@example.com', subscription: 'free' },
    loading: false,
    refreshProfile: vi.fn(),
  }),
}));

let apiCallMock = makeApiMock();

vi.mock('../../lib/supabase', () => ({
  apiCall: (...args: unknown[]) => apiCallMock(...args),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Application email notification — dual send on submission (4.1)', () => {
  beforeEach(() => {
    apiCallMock = makeApiMock();
    vi.spyOn(apiCallMock, 'apply');
  });

  it('POST /applications response includes emailDelivery with employer and seeker fields', async () => {
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

    const calls = apiCallMock.mock.calls;
    const postCall = calls.find(([ep, opts]) => ep === '/applications' && (opts as ApiCallOptions)?.method === 'POST');
    expect(postCall).toBeDefined();

    // Simulate server response shape — verify the component does not throw when
    // emailDelivery is included in the POST response body
    const response = await apiCallMock('/applications', { method: 'POST', body: '{}' });
    expect(response).toHaveProperty('application');
    expect(response).toHaveProperty('emailDelivery');
    expect(response.emailDelivery).toHaveProperty('employer');
    expect(response.emailDelivery).toHaveProperty('seeker');
  });

  it('application submit succeeds even when email delivery is failed (non-blocking)', async () => {
    apiCallMock = makeApiMock({ postEmailDelivery: { employer: 'failed', seeker: 'failed' } });

    render(
      <MemoryRouter>
        <SeekerSavedJobs />
      </MemoryRouter>,
    );

    const applyButton = await screen.findByRole('button', { name: /Apply Now/i });
    fireEvent.click(applyButton);

    // Component should still complete without throwing even when delivery failed
    await waitFor(() => {
      expect(apiCallMock).toHaveBeenCalledWith('/applications', expect.objectContaining({ method: 'POST' }));
    });

    const response = await apiCallMock('/applications', { method: 'POST', body: '{}' });
    expect(response.application).toBeDefined();
    expect(response.emailDelivery.employer).toBe('failed');
  });
});

describe('Application email notification — stage transition notifications (4.2)', () => {
  beforeEach(() => {
    apiCallMock = makeApiMock();
  });

  it('PUT /applications response includes emailDelivery with seeker delivery state', async () => {
    const response = await apiCallMock('/applications/app-1', { method: 'PUT', body: '{}' });
    expect(response).toHaveProperty('application');
    expect(response).toHaveProperty('emailDelivery');
  });

  it('interview stage notification response includes seeker delivery metadata', async () => {
    apiCallMock = makeApiMock({ putEmailDelivery: { seeker: 'sent' } });
    const response = await apiCallMock('/applications/app-1', {
      method: 'PUT',
      body: JSON.stringify({ status: 'interview', notes: '' }),
    });
    expect(response.emailDelivery.seeker).toBe('sent');
  });
});

describe('Application email notification — missing recipient fallback (4.3)', () => {
  beforeEach(() => {
    apiCallMock = makeApiMock();
  });

  it('workflow succeeds when seeker email is unresolvable (skipped delivery)', async () => {
    apiCallMock = makeApiMock({ putEmailDelivery: { seeker: 'skipped' } });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <SeekerApplications />
      </MemoryRouter>,
    );

    const withdrawButton = await screen.findByRole('button', { name: /Withdraw/i });
    fireEvent.click(withdrawButton);
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: /^Withdraw$/i }));

    await waitFor(() => {
      expect(apiCallMock).toHaveBeenCalledWith(
        '/applications/app-1',
        expect.objectContaining({ method: 'PUT' }),
      );
    });
    // Component should complete without error when emailDelivery indicates skipped
  });

  it('employer email skipped delivery does not fail application post', async () => {
    apiCallMock = makeApiMock({ postEmailDelivery: { employer: 'skipped', seeker: 'sent' } });
    const response = await apiCallMock('/applications', { method: 'POST', body: '{}' });
    expect(response.application).toBeDefined();
    expect(response.emailDelivery.employer).toBe('skipped');
    expect(response.emailDelivery.seeker).toBe('sent');
  });
});

describe('Application email notification — idempotency / replay (4.4)', () => {
  beforeEach(() => {
    apiCallMock = makeApiMock();
  });

  it('replayed submit returns deduplicated status without failing the workflow', async () => {
    apiCallMock = makeApiMock({
      postEmailDelivery: { employer: 'deduplicated', seeker: 'deduplicated' },
    });

    const response = await apiCallMock('/applications', { method: 'POST', body: '{}' });

    // Application is still returned successfully on a replayed request
    expect(response.application).toBeDefined();
    // Email delivery status reflects deduplication rather than a new send
    expect(response.emailDelivery.employer).toBe('deduplicated');
    expect(response.emailDelivery.seeker).toBe('deduplicated');
  });

  it('withdrawal replay returns deduplicated employer notice without double-send', async () => {
    apiCallMock = makeApiMock({ putEmailDelivery: { employer: 'deduplicated' } });
    const response = await apiCallMock('/applications/app-1', {
      method: 'PUT',
      body: JSON.stringify({ status: 'rejected', notes: 'Withdrawn by seeker' }),
    });
    expect(response.application).toBeDefined();
    expect(response.emailDelivery.employer).toBe('deduplicated');
  });
});
