import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import TalentSearch from '../TalentSearch';

const apiCallMock = vi.fn(async (endpoint: string) => {
  if (endpoint.startsWith('/employer/talent-search')) {
    return {
      candidates: [
        {
          id: 'cand-1',
          name: 'Anele Dlamini',
          email: 'anele@example.com',
          headline: 'Frontend Developer',
          summary: 'React and TypeScript engineer',
          location: 'Johannesburg',
          avatar_url: null,
          skills: ['React', 'TypeScript'],
          yearsOfExperience: 3,
          experienceLevel: 'mid',
          video_introduction: null,
        },
      ],
      totalCount: 1,
    };
  }

  return { candidates: [], totalCount: 0 };
});

vi.mock('../../lib/supabase', () => ({
  apiCall: (...args: unknown[]) => apiCallMock(...args),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

describe('TalentSearch page', () => {
  beforeEach(() => {
    apiCallMock.mockClear();
  });

  it('loads candidates on mount with default query params', async () => {
    render(
      <MemoryRouter>
        <TalentSearch />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(apiCallMock).toHaveBeenCalled();
    });

    const [endpoint, options] = apiCallMock.mock.calls[0] as [string, { requireAuth?: boolean }];
    const [, queryString = ''] = endpoint.split('?');
    const params = new URLSearchParams(queryString);

    expect(endpoint.startsWith('/employer/talent-search?')).toBe(true);
    expect(params.get('sort')).toBe('relevance');
    expect(params.get('page')).toBe('1');
    expect(params.get('limit')).toBe('50');
    expect(options?.requireAuth).toBe(true);

    expect(await screen.findByText('Anele Dlamini')).toBeInTheDocument();
    expect(screen.getByText(/Showing 1 of 1 candidates/i)).toBeInTheDocument();
  });

  it('sends search term when Enter is pressed', async () => {
    render(
      <MemoryRouter>
        <TalentSearch />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(apiCallMock).toHaveBeenCalledTimes(1);
    });

    const searchInput = screen.getByPlaceholderText('Search by skills, job title, qualifications...');
    fireEvent.change(searchInput, { target: { value: 'react' } });
    fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(apiCallMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    const matchingCall = apiCallMock.mock.calls
      .map((call) => call[0] as string)
      .find((endpoint) => {
        const [, queryString = ''] = endpoint.split('?');
        return new URLSearchParams(queryString).get('search') === 'react';
      });

    expect(matchingCall).toBeTruthy();
  });
});
