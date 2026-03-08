import { Link } from 'react-router';
import { ArrowLeft, Video, Calendar, Clock } from 'lucide-react';

export default function VideoInterviews() {
  return (
    <div className="min-h-screen bg-[var(--rf-bg)] py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link to="/seeker/dashboard" className="flex items-center text-[var(--rf-green)] hover:underline mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Link>

        <h1 className="text-3xl font-bold text-[var(--rf-navy)] mb-6 flex items-center">
          <Video className="w-8 h-8 mr-3" />
          My Video Interviews
        </h1>

        <div className="bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] p-12 text-center">
          <Video className="w-16 h-16 text-[var(--rf-muted)] mx-auto mb-4" />
          <h3 className="text-xl font-bold text-[var(--rf-navy)] mb-2">No Upcoming Interviews</h3>
          <p className="text-[var(--rf-muted)] mb-6">You don't have any scheduled video interviews at the moment</p>
          <Link
            to="/jobs"
            className="inline-block px-6 py-2 bg-[var(--rf-green)] text-white rounded-[var(--rf-radius-md)] hover:bg-[#00B548] transition-colors"
          >
            Browse Jobs
          </Link>
        </div>
      </div>
    </div>
  );
}
