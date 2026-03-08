import { Link } from 'react-router';
import { ArrowLeft, Users, Gift, Share2 } from 'lucide-react';

export default function Networking() {
  return (
    <div className="min-h-screen bg-[var(--rf-bg)] py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link to="/seeker/dashboard" className="flex items-center text-[var(--rf-green)] hover:underline mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Link>

        <h1 className="text-3xl font-bold text-[var(--rf-navy)] mb-6 flex items-center">
          <Users className="w-8 h-8 mr-3" />
          My RecruitFriend Network
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-gradient-to-r from-[var(--rf-green)] to-[#00B548] text-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] p-8">
            <Gift className="w-12 h-12 mb-4" />
            <h2 className="text-2xl font-bold mb-2">Earn with RecruitFriend!</h2>
            <p className="mb-6">Refer friends and get paid when they sign up, get hired, or post a job.</p>
            
            <div className="bg-white bg-opacity-20 rounded-[var(--rf-radius-md)] p-4 mb-4">
              <div className="text-sm mb-2">Your Referral Link:</div>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value="https://recruitfriend.co.za/ref/ABC123"
                  readOnly
                  className="flex-1 px-3 py-2 bg-white bg-opacity-30 rounded-[var(--rf-radius-md)] text-white"
                />
                <button className="px-4 py-2 bg-white text-[var(--rf-green)] rounded-[var(--rf-radius-md)] hover:bg-gray-100 transition-colors font-semibold">
                  Copy
                </button>
              </div>
            </div>

            <div className="flex space-x-2">
              <button className="flex-1 px-4 py-2 bg-white text-[var(--rf-green)] rounded-[var(--rf-radius-md)] hover:bg-gray-100 transition-colors font-semibold">
                Share via WhatsApp
              </button>
              <button className="flex-1 px-4 py-2 bg-white text-[var(--rf-green)] rounded-[var(--rf-radius-md)] hover:bg-gray-100 transition-colors font-semibold">
                Email
              </button>
            </div>
          </div>

          <div className="bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] p-8">
            <h3 className="text-xl font-bold text-[var(--rf-navy)] mb-4">Referral Earnings</h3>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div>
                <div className="text-2xl font-bold text-[var(--rf-navy)]">R0</div>
                <div className="text-xs text-[var(--rf-muted)]">Pending</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-[var(--rf-green)]">R0</div>
                <div className="text-xs text-[var(--rf-muted)]">Available</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-[var(--rf-navy)]">R0</div>
                <div className="text-xs text-[var(--rf-muted)]">Total Earned</div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-[var(--rf-radius-md)]">
                <span className="text-sm">🥉 Friend Signs Up</span>
                <span className="font-bold text-[var(--rf-navy)]">R50</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-[var(--rf-radius-md)]">
                <span className="text-sm">🥈 Friend Gets Hired</span>
                <span className="font-bold text-[var(--rf-navy)]">R200</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-[var(--rf-radius-md)]">
                <span className="text-sm">🥇 Friend Posts a Job</span>
                <span className="font-bold text-[var(--rf-navy)]">R300</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
