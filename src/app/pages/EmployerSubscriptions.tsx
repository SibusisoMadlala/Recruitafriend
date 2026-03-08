import { Link } from 'react-router';
import { ArrowLeft, Check } from 'lucide-react';

export default function EmployerSubscriptions() {
  const plans = [
    {
      name: 'STARTER',
      price: 'R0',
      period: '/month',
      features: [
        '1 active listing',
        '10 applications/listing',
        'Basic ATS',
        'No CV search',
      ],
      cta: 'Current Plan',
      color: 'gray',
    },
    {
      name: 'GROWTH',
      price: 'R799',
      period: '/month',
      badge: 'Most Popular',
      features: [
        '5 listings',
        'Unlimited applications',
        'Full ATS',
        '50 CV searches/month',
        '1 Featured listing',
        'On-demand video assessments (2 active)',
        'Basic analytics',
      ],
      cta: 'Start 14-Day Free Trial',
      color: 'green',
    },
    {
      name: 'PROFESSIONAL',
      price: 'R1,999',
      period: '/month',
      features: [
        '20 listings',
        'Unlimited CV search',
        'Unlimited video assessments',
        'Advanced analytics',
        '5 team seats',
        'Dedicated account manager',
        'Company profile promotion',
      ],
      cta: 'Get Professional',
      color: 'navy',
    },
    {
      name: 'ENTERPRISE',
      price: 'Custom',
      features: [
        'Unlimited everything',
        'API access',
        'Custom branding',
        'SLA support',
        'Bulk posting',
        'Branded assessment portal',
      ],
      cta: 'Book a Demo',
      color: 'gold',
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--rf-bg)] py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link to="/employer/dashboard" className="flex items-center text-[var(--rf-green)] hover:underline mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Link>

        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-[var(--rf-navy)] mb-4">
            💼 RecruitFriend Employer Plans
          </h1>
          <p className="text-xl text-[var(--rf-muted)]">
            Find great South African talent at every budget
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] p-6 relative ${
                plan.badge ? 'ring-2 ring-[var(--rf-green)]' : ''
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 px-3 py-1 bg-[var(--rf-green)] text-white rounded-[var(--rf-radius-pill)] text-xs font-semibold">
                  {plan.badge}
                </div>
              )}
              
              <div className="text-center mb-6">
                <h3 className="text-lg font-bold text-[var(--rf-navy)] mb-2">{plan.name}</h3>
                <div className="text-3xl font-bold text-[var(--rf-navy)]">
                  {plan.price}
                  {plan.period && <span className="text-base text-[var(--rf-muted)]">{plan.period}</span>}
                </div>
              </div>

              <ul className="space-y-2 mb-6 min-h-[240px]">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start text-sm">
                    <Check className="w-4 h-4 text-[var(--rf-green)] mr-2 flex-shrink-0 mt-0.5" />
                    <span className="text-[var(--rf-text)]">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                className={`w-full py-3 rounded-[var(--rf-radius-md)] font-semibold transition-colors ${
                  plan.color === 'gray'
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : plan.color === 'green'
                    ? 'bg-[var(--rf-green)] text-white hover:bg-[#00B548]'
                    : plan.color === 'navy'
                    ? 'bg-[var(--rf-navy)] text-white hover:bg-[#0d3a5f]'
                    : 'bg-[var(--rf-gold)] text-white hover:bg-[#D97706]'
                }`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>

        <div className="text-center text-sm text-[var(--rf-muted)]">
          <p className="mb-2">✅ All paid plans include a 14-day free trial. Cancel anytime.</p>
          <p>South African VAT inclusive.</p>
        </div>
      </div>
    </div>
  );
}
