import { Link } from 'react-router';
import { ArrowLeft, Search, Users, Video } from 'lucide-react';

export default function TalentSearch() {
  return (
    <div className="min-h-screen bg-[var(--rf-bg)] py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link to="/employer/dashboard" className="flex items-center text-[var(--rf-green)] hover:underline mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Link>

        <h1 className="text-3xl font-bold text-[var(--rf-navy)] mb-6 flex items-center">
          <Search className="w-8 h-8 mr-3" />
          Search RecruitFriend Candidate Database
        </h1>

        <div className="bg-gradient-to-r from-[var(--rf-orange)] to-[#FF8B5C] text-white rounded-[var(--rf-radius-lg)] p-8 mb-8 shadow-[var(--rf-card-shadow)]">
          <h2 className="text-2xl font-bold mb-2">Unlock 48,000+ Candidate Profiles</h2>
          <p className="mb-6">Upgrade to Growth plan to search and contact qualified candidates directly</p>
          <Link
            to="/employer/subscriptions"
            className="inline-block px-8 py-3 bg-white text-[var(--rf-orange)] rounded-[var(--rf-radius-md)] hover:bg-gray-100 transition-colors font-semibold"
          >
            Upgrade Now
          </Link>
        </div>

        <div className="bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] p-12 text-center">
          <Users className="w-16 h-16 text-[var(--rf-muted)] mx-auto mb-4" />
          <h3 className="text-xl font-bold text-[var(--rf-navy)] mb-2">Premium Feature</h3>
          <p className="text-[var(--rf-muted)]">Talent Search is available on Growth and higher plans</p>
        </div>
      </div>
    </div>
  );
}
