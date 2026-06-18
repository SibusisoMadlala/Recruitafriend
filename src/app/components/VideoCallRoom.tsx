import { useEffect } from 'react';

interface Props {
  applicationId: string;
  candidateName?: string;
  jobTitle?: string;
  isHost?: boolean;
  onClose: () => void;
}

export function VideoCallRoom({ applicationId, onClose }: Props) {
  const roomName = `RecruitFriend${applicationId.replace(/-/g, '').substring(0, 16)}`;
  const url = `https://framatalk.org/${roomName}`;

  useEffect(() => {
    window.open(url, '_blank', 'noopener,noreferrer');
    onClose(); // close the overlay immediately — call is in a new tab
  }, []);

  return null;
}
