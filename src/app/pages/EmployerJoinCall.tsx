import { useParams, useNavigate } from 'react-router';
import { VideoCallRoom } from '../components/VideoCallRoom';

export default function EmployerJoinCall() {
  const { callId } = useParams<{ callId: string }>();
  const navigate = useNavigate();

  if (!callId) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-500">
        Invalid meeting link.
      </div>
    );
  }

  return (
    <VideoCallRoom
      applicationId={callId}
      jobTitle="Interview Call"
      isHost={true}
      onClose={() => navigate('/employer/dashboard')}
    />
  );
}
