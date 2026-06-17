import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';

export default function ApplicantTracking() {
  const { jobId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    navigate(jobId ? `/employer/applicants/${jobId}` : '/employer/applicants', { replace: true });
  }, [jobId]);

  return null;
}
