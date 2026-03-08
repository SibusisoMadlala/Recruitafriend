import { Link } from 'react-router';
import { ArrowLeft, Check, X } from 'lucide-react';

export default function SeekerSubscriptions() {
  const plans = [
    {
      name: 'FREE',
      price: 'R0',
      color: 'gray',
      features: [
        { text: 'Basic profile', included: true },
        { text: 'Apply to 5 jobs per day', included: true },
        { text: 'Standard job search', included: true },
        { text: 'Email job alerts', included: true },
        { text: 'Video introduction', included: false },
        { text: 'See who viewed your profile', included: false },
        { text: 'Referral earnings', included: false },
      ],
      cta: 'Current Plan',
      ctaDisabled: true,
    },
    {
      name: 'PREMIUM',
      price: 'R149',
      period: '/month',
      badge: 'Most Popular 🔥',
      color: 'green',
      features: [
        { text: 'Everything in Free', included: true },
        { text: 'Unlimited applications', included: true },
        { text: 'Priority profile visibility', included: true },
        { text: 'See who viewed your profile', included: true },
        { text: 'Video introduction on profile', included: true },
        { text: 'Advanced search filters', included: true },
        { text: 'Full referral programme', included: true },
      ],
      cta: 'Upgrade to Premium',
    },
    {
      name: 'PROFESSIONAL',
      price: 'R299',
      period: '/month',
      color: 'navy',
      features: [
        { text: 'Everything in Premium', included: true },
        { text: 'AI job match score', included: true },
        { text: 'Direct recruiter messaging', included: true },
        { text: 'Career coach session (1/month)', included: true },
        { text: 'Interview prep toolkit', included: true },
        { text: 'Salary benchmarking (ZAR)', included: true },
        { text: 'Featured profile badge 👑', included: true },
      ],
      cta: 'Go Professional',
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--rf-bg)] py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link to="/seeker/dashboard" className="flex items-center text-[var(--rf-green)] hover:underline mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Link>

        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-[var(--rf-navy)] mb-4">
            ⭐ Upgrade Your RecruitFriend Experience
          </h1>
          <p className="text-xl text-[var(--rf-muted)]">
            Get hired faster with premium RecruitFriend tools
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] p-8 relative ${
                plan.badge ? 'ring-2 ring-[var(--rf-green)]' : ''
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 px-4 py-1 bg-[var(--rf-green)] text-white rounded-[var(--rf-radius-pill)] text-sm font-semibold">
                  {plan.badge}
                </div>
              )}
              
              <div className="text-center mb-6">
                <h3 className="text-lg font-bold text-[var(--rf-navy)] mb-2">{plan.name}</h3>
                <div className="text-4xl font-bold text-[var(--rf-navy)]">
                  {plan.price}
                  {plan.period && <span className="text-lg text-[var(--rf-muted)]">{plan.period}</span>}
                </div>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start">
                    {feature.included ? (
                      <Check className="w-5 h-5 text-[var(--rf-green)] mr-2 flex-shrink-0 mt-0.5" />
                    ) : (
                      <X className="w-5 h-5 text-gray-300 mr-2 flex-shrink-0 mt-0.5" />
                    )}
                    <span className={feature.included ? 'text-[var(--rf-text)]' : 'text-gray-400'}>
                      {feature.text}
                    </span>
                  </li>
                ))}
              </ul>

              <button
                disabled={plan.ctaDisabled}
                className={`w-full py-3 rounded-[var(--rf-radius-md)] font-semibold transition-colors ${
                  plan.ctaDisabled
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : plan.color === 'green'
                    ? 'bg-[var(--rf-green)] text-white hover:bg-[#00B548]'
                    : 'bg-[var(--rf-navy)] text-white hover:bg-[#0d3a5f]'
                }`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>

        <div className="text-center text-sm text-[var(--rf-muted)]">
          <p className="mb-2">🔒 Secure checkout powered by PayFast</p>
          <p>Cancel anytime. No hidden fees. POPIA compliant.</p>
        </div>
      </div>
    </div>
  );
}
