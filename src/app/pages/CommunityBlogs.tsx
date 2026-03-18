import { Link } from 'react-router';
import { User, Calendar, MessageSquare, ArrowRight, Rss, Info } from 'lucide-react';

export default function CommunityBlogs() {
  const blogs: any[] = []; // Replaced mock data with empty array

  return (
    <div className="min-h-screen bg-[var(--rf-bg)] py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-[var(--rf-navy)] mb-4">Community Blog</h1>
          <p className="text-[var(--rf-muted)] max-w-2xl mx-auto">
            Insights, advice, and stories from the RecruitFriend community to help you succeed in your career journey.
          </p>
        </div>

        {blogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl shadow-sm border border-gray-100">
             <div className="bg-gray-50 p-6 rounded-full mb-4">
                <Rss className="w-12 h-12 text-gray-300" />
             </div>
             <h2 className="text-xl font-bold text-[#0A2540] mb-2">No Blog Posts Yet</h2>
             <p className="text-gray-500 text-center max-w-md mb-6">
               Check back soon for the latest career advice, industry trends, and success stories.
             </p>
             <Link to="/" className="inline-flex items-center px-4 py-2 bg-[var(--rf-green)] hover:bg-[var(--rf-green-hover,#00B548)] text-white rounded-[var(--rf-radius-md)] font-semibold transition-colors">
               Back to Home
             </Link>
          </div>
        ) : (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
             {/* Blog Cards would be rendered here */}
          </div>
        )}

      </div>
    </div>
  );
}
