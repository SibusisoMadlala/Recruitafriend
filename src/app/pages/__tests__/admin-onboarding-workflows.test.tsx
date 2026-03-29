import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import AdminOnboardingQueue from '../AdminOnboardingQueue';
import EmployerOnboardingStatus from '../EmployerOnboardingStatus';

const apiCallMock = vi.fn();
const refreshProfileMock = vi.fn();
const uploadMock = vi.fn();
const createSignedUrlMock = vi.fn();
const windowOpenMock = vi.fn();

vi.mock('../../lib/supabase', () => ({
  apiCall: (...args: unknown[]) => apiCallMock(...args),
  supabase: {
    storage: {
      from: () => ({
        upload: (...args: unknown[]) => uploadMock(...args),
        createSignedUrl: (...args: unknown[]) => createSignedUrlMock(...args),
      }),
    },
  },
}));

vi.mock('../../context/useAuth', () => ({
  useAuth: () => ({
    profile: { id: 'emp-1', name: 'Acme Corp', email: 'admin@example.com', userType: 'admin', employer_status: 'approved' },
    refreshProfile: refreshProfileMock,
  }),
}));

describe('admin onboarding workflows', () => {
  beforeEach(() => {
    apiCallMock.mockReset();
    refreshProfileMock.mockReset();
    uploadMock.mockReset();
    createSignedUrlMock.mockReset();
    uploadMock.mockResolvedValue({ data: { path: 'emp-1/path/mock.pdf' }, error: null });
    createSignedUrlMock.mockResolvedValue({ data: { signedUrl: 'https://example.com/signed-doc' }, error: null });
    windowOpenMock.mockReset();
    vi.stubGlobal('open', windowOpenMock);
  });

  it('renders queue and applies approve decision', async () => {
    apiCallMock.mockImplementation(async (endpoint: string) => {
      if (endpoint.startsWith('/admin/onboarding/queue?')) {
        return {
          queue: [
            {
              id: 'sub-1',
              employer_id: 'emp-1',
              employer_name: 'Acme Corp',
              employer_email: 'acme@example.com',
              status: 'pending_review',
              age_hours: 12,
            },
          ],
        };
      }
      if (endpoint === '/admin/onboarding/queue/emp-1') {
        return {
          submission: {
            company_name: 'Acme Corp',
            registration_number: 'REG-123',
            tax_number: 'TAX-001',
            company_website: 'https://acme.example.com',
            business_overview: 'Industrial tooling supplier',
            contact_name: 'A',
            contact_email: 'acme@example.com',
            contact_phone: '0123456789',
            address_line1: '12 Main Road',
            city: 'Cape Town',
            province: 'Western Cape',
            submitted_at: '2026-03-23T10:00:00.000Z',
          },
          documents: [{ id: 'doc-1', doc_type: 'registration_proof', storage_bucket: 'b', storage_path: 'p', verification_status: 'pending' }],
          employer: { employer_status: 'pending_review' },
        };
      }
      if (endpoint === '/admin/onboarding/emp-1/decision') {
        return { ok: true };
      }
      return {};
    });

    render(
      <MemoryRouter>
        <AdminOnboardingQueue />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Employer onboarding review queue/i)).toBeInTheDocument();
    fireEvent.click(await screen.findByText('Acme Corp'));

    await screen.findByText(/Full application details/i);
    expect(screen.getByText('REG-123')).toBeInTheDocument();
    expect(screen.getByText('Industrial tooling supplier')).toBeInTheDocument();
    fireEvent.click(screen.getByText('View document'));
    await waitFor(() => {
      expect(createSignedUrlMock).toHaveBeenCalledWith('p', 600);
      expect(windowOpenMock).toHaveBeenCalledWith('https://example.com/signed-doc', '_blank', 'noopener,noreferrer');
    });

    fireEvent.click(screen.getByText('Approve'));

    await waitFor(() => {
      expect(apiCallMock).toHaveBeenCalledWith('/admin/onboarding/emp-1/decision', expect.anything());
    });
  });

  it('submits onboarding form with required documents', async () => {
    let statusRequestCount = 0;

    apiCallMock.mockImplementation(async (endpoint: string) => {
      if (endpoint === '/employer/onboarding/status') {
        statusRequestCount += 1;
        if (statusRequestCount > 1) {
          return {
            employer_status: 'pending_review',
            guidance: { message: 'Your onboarding is pending review.' },
            latest_submission: {
              revision_no: 1,
              submitted_at: '2026-03-23T10:00:00.000Z',
            },
          };
        }

        return {
          employer_status: 'needs_info',
          guidance: { message: 'Need more details', guidance: 'Upload required documents' },
          remediation: { reviewer_notes: 'Missing tax doc' },
        };
      }
      if (endpoint === '/employer/onboarding/submissions') {
        return { status: 'pending_review' };
      }
      return {};
    });

    render(
      <MemoryRouter>
        <EmployerOnboardingStatus />
      </MemoryRouter>
    );

    await screen.findByText(/Employer onboarding status/i);

    fireEvent.change(screen.getByPlaceholderText('Company name'), { target: { value: 'Acme Corp' } });
    fireEvent.change(screen.getByPlaceholderText('Contact phone'), { target: { value: '0123456789' } });
    fireEvent.change(screen.getByPlaceholderText('Address line 1'), { target: { value: '12 Main Road' } });
    fireEvent.change(screen.getByPlaceholderText('City'), { target: { value: 'Cape Town' } });
    fireEvent.change(screen.getByPlaceholderText('Province'), { target: { value: 'Western Cape' } });

    const registrationFileInput = screen.getByLabelText(/Registration proof \(required\)/i);
    const taxFileInput = screen.getByLabelText(/Tax document \(required\)/i);

    const registrationFile = new File(['registration'], 'registration-proof.pdf', { type: 'application/pdf' });
    const taxFile = new File(['tax'], 'tax-document.pdf', { type: 'application/pdf' });

    fireEvent.change(registrationFileInput, { target: { files: [registrationFile] } });
    fireEvent.change(taxFileInput, { target: { files: [taxFile] } });

    fireEvent.click(screen.getByText('Submit onboarding'));

    await waitFor(() => {
      expect(apiCallMock).toHaveBeenCalledWith('/employer/onboarding/submissions', expect.anything());
    });

    expect(await screen.findByText(/Onboarding pending/i)).toBeInTheDocument();
    expect(screen.queryByText('Submit onboarding')).not.toBeInTheDocument();
  });
});
