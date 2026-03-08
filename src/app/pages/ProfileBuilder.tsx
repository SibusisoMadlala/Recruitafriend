import { Link } from 'react-router';
import { ArrowLeft, Camera, Upload, Save } from 'lucide-react';

export default function ProfileBuilder() {
  return (
    <div className="min-h-screen bg-[var(--rf-bg)] py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link to="/seeker/dashboard" className="flex items-center text-[var(--rf-green)] hover:underline mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Link>

        <div className="bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-[var(--rf-navy)] mb-2">RecruitFriend Profile Builder</h1>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-[var(--rf-green)] h-2 rounded-full" style={{ width: '65%' }}></div>
            </div>
            <p className="text-sm text-[var(--rf-muted)] mt-2">65% Complete — Add your work experience to reach 80%</p>
          </div>

          <div className="space-y-6">
            <div className="p-6 border border-[var(--rf-border)] rounded-[var(--rf-radius-lg)]">
              <h3 className="text-lg font-bold text-[var(--rf-navy)] mb-4">Personal Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--rf-text)] mb-2">Full Name</label>
                  <input type="text" className="w-full border border-[var(--rf-border)] rounded-[var(--rf-radius-md)] px-4 py-2" placeholder="John Doe" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--rf-text)] mb-2">Email</label>
                  <input type="email" className="w-full border border-[var(--rf-border)] rounded-[var(--rf-radius-md)] px-4 py-2" placeholder="john@example.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--rf-text)] mb-2">Phone</label>
                  <input type="tel" className="w-full border border-[var(--rf-border)] rounded-[var(--rf-radius-md)] px-4 py-2" placeholder="+27 123 456 7890" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--rf-text)] mb-2">Province</label>
                  <select className="w-full border border-[var(--rf-border)] rounded-[var(--rf-radius-md)] px-4 py-2">
                    <option>Gauteng</option>
                    <option>Western Cape</option>
                    <option>KwaZulu-Natal</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="p-6 border border-[var(--rf-border)] rounded-[var(--rf-radius-lg)]">
              <h3 className="text-lg font-bold text-[var(--rf-navy)] mb-4">Professional Summary</h3>
              <textarea
                className="w-full border border-[var(--rf-border)] rounded-[var(--rf-radius-md)] px-4 py-2"
                rows={4}
                placeholder="Tell employers about yourself..."
              />
              <p className="text-xs text-[var(--rf-muted)] mt-2">
                Need help? <span className="text-[var(--rf-green)] cursor-pointer hover:underline">Use AI Assist ✨</span>
              </p>
            </div>

            <div className="p-6 border-2 border-dashed border-[var(--rf-green)] rounded-[var(--rf-radius-lg)] bg-[var(--rf-green)] bg-opacity-5">
              <div className="text-center">
                <Camera className="w-12 h-12 text-[var(--rf-green)] mx-auto mb-4" />
                <h3 className="text-lg font-bold text-[var(--rf-navy)] mb-2">Video Introduction ⭐</h3>
                <p className="text-[var(--rf-muted)] mb-4">Record a 60-second video pitch to stand out from the crowd</p>
                <button className="px-6 py-2 bg-[var(--rf-green)] text-white rounded-[var(--rf-radius-md)] hover:bg-[#00B548] transition-colors">
                  <Upload className="w-4 h-4 inline mr-2" />
                  Record Video
                </button>
                <p className="text-xs text-[var(--rf-muted)] mt-4">
                  💡 RecruitFriend tip: Candidates with video intros get 3x more views
                </p>
              </div>
            </div>

            <button className="w-full py-3 bg-[var(--rf-green)] text-white rounded-[var(--rf-radius-md)] hover:bg-[#00B548] transition-colors font-semibold">
              <Save className="w-5 h-5 inline mr-2" />
              Save Profile
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
