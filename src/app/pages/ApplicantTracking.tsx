import { useParams, Link } from 'react-router';
import { ArrowLeft, Download } from 'lucide-react';

export default function ApplicantTracking() {
  const { jobId } = useParams();

  const columns = [
    { name: 'New', count: 0, color: 'bg-blue-100 text-blue-700' },
    { name: 'Reviewed', count: 0, color: 'bg-purple-100 text-purple-700' },
    { name: 'Shortlisted', count: 0, color: 'bg-yellow-100 text-yellow-700' },
    { name: 'Interview', count: 0, color: 'bg-teal-100 text-teal-700' },
    { name: 'Offer', count: 0, color: 'bg-green-100 text-green-700' },
  ];

  return (
    <div className="min-h-screen bg-[var(--rf-bg)] py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link to="/employer/dashboard" className="flex items-center text-[var(--rf-green)] hover:underline mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Link>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-[var(--rf-navy)]">
            Applicants for Job #{jobId?.slice(0, 8)}
          </h1>
          <button className="px-4 py-2 border border-[var(--rf-border)] text-[var(--rf-text)] rounded-[var(--rf-radius-md)] hover:bg-gray-50 transition-colors flex items-center">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </button>
        </div>

        <div className="bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] p-8">
          <div className="grid grid-cols-5 gap-4">
            {columns.map((column) => (
              <div key={column.name} className="border border-[var(--rf-border)] rounded-[var(--rf-radius-md)] p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-[var(--rf-text)]">{column.name}</h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${column.color}`}>
                    {column.count}
                  </span>
                </div>
                <div className="space-y-2 min-h-[400px]">
                  <div className="text-center text-[var(--rf-muted)] text-sm py-8">
                    No applicants in this stage
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
