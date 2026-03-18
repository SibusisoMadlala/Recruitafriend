import { Link } from 'react-router';
import { useAuth } from '../context/useAuth';
import { Check, ArrowRight } from 'lucide-react';

export default function EmployerInfo() {
  const { user, profile } = useAuth();
  
  const tiers = [
    {
      name: 'Starter',
      price: 'Free',
      description: 'Everything you need to start recruiting',
      features: [
        'Post up to 3 active jobs',
        'Basic applicant tracking',
        'Standard support',
        '30-day listing duration',
      ],
      current: true,
    },
    {
      name: 'Pro',
      price: 'R999',
      period: '/month',
      description: 'For growing companies with more hiring needs',
      features: [
        'Post unlimited jobs',
        'Advanced applicant tracking and filtering',
        'Video interview integration',
        'Priority support',
        'Social media sharing',
        'Featured listings',
      ],
      current: false,
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      description: 'For large organizations',
      features: [
        'Custom integrations',
        'Dedicated account manager',
        'Custom branding',
        'Bulk job import',
        'AI-matching technology',
      ],
      current: false,
    },
  ];

  return (
    <div className="bg-[var(--rf-bg)] min-h-screen py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-extrabold text-[var(--rf-navy)] sm:text-5xl sm:tracking-tight lg:text-6xl">
            Hire the Best with RecruitFriend
          </h1>
          <p className="max-w-xl mx-auto mt-5 text-xl text-[var(--rf-text)]">
            Simple, powerful tools to reach, track, and hire top talent.
          </p>
        </div>

        {/* How it Works */}
        <div className="mb-20">
          <h2 className="text-3xl font-bold text-[var(--rf-navy)] text-center mb-12">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] text-center">
              <div className="w-16 h-16 bg-[var(--rf-green)] bg-opacity-10 text-[var(--rf-green)] rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold">1</div>
              <h3 className="text-xl font-bold mb-4">Create Your Profile</h3>
              <p className="text-[var(--rf-muted)]">Sign up in minutes and build your company brand to attract candidates.</p>
            </div>
            <div className="bg-white p-8 rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] text-center">
              <div className="w-16 h-16 bg-[var(--rf-green)] bg-opacity-10 text-[var(--rf-green)] rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold">2</div>
              <h3 className="text-xl font-bold mb-4">Post a Job</h3>
              <p className="text-[var(--rf-muted)]">Use our easy job poster to reach thousands of qualified candidates instantly.</p>
            </div>
            <div className="bg-white p-8 rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] text-center">
              <div className="w-16 h-16 bg-[var(--rf-green)] bg-opacity-10 text-[var(--rf-green)] rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold">3</div>
              <h3 className="text-xl font-bold mb-4">Hire Top Talent</h3>
              <p className="text-[var(--rf-muted)]">Review applicants, schedule interviews, and make offers all in one place.</p>
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div>
          <h2 className="text-3xl font-bold text-[var(--rf-navy)] text-center mb-4">Pricing Plans</h2>
          <p className="text-center text-[var(--rf-muted)] mb-12">Choose the plan that fits your hiring needs</p>
          
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:gap-8">
            {tiers.map((tier) => (
              <div
                key={tier.name}
                className="rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] bg-white border border-[var(--rf-border)] flex flex-col overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="p-8 bg-white flex-1">
                  <h3 className="text-xl font-semibold text-[var(--rf-navy)]">{tier.name}</h3>
                  <p className="mt-4 flex items-baseline text-[var(--rf-navy)]">
                    <span className="text-5xl font-extrabold tracking-tight">{tier.price}</span>
                    {tier.period && <span className="ml-1 text-xl font-semibold text-[var(--rf-muted)]">{tier.period}</span>}
                  </p>
                  <p className="mt-6 text-[var(--rf-muted)]">{tier.description}</p>

                  <ul role="list" className="mt-6 space-y-6">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex">
                        <Check className="flex-shrink-0 w-6 h-6 text-[var(--rf-green)]" aria-hidden="true" />
                        <span className="ml-3 text-[var(--rf-text)]">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="p-8 bg-gray-50 border-t border-[var(--rf-border)]">
                  <Link
                    to={user ? (profile?.userType === 'employer' ? '/employer/dashboard' : '/seeker/dashboard') : '/signup?type=employer'}
                    className="block w-full py-3 px-6 border border-transparent rounded-[var(--rf-radius-md)] text-center font-medium bg-[var(--rf-navy)] text-white hover:bg-[#1a2b4b] transition-colors"
                  >
                   {user && profile?.userType === 'employer' ? 'Go to Dashboard' : 'Get Started'} <ArrowRight className="inline ml-2 w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
