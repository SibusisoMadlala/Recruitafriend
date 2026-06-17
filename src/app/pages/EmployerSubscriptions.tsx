import { Check, Zap } from 'lucide-react';
import { Button } from '../components/ui/button';

const PACKAGES = [
  {
    name: 'Free',
    posts: 1,
    price: 0,
    priceLabel: 'R0',
    description: 'Your first job post is on us.',
    color: 'text-gray-500',
    border: 'border-gray-200',
    buttonClass: 'bg-gray-100 text-gray-500 hover:bg-gray-200 shadow-none',
    buttonLabel: 'Current Plan',
    disabled: true,
    popular: false,
  },
  {
    name: '1 Post',
    posts: 1,
    price: 750,
    priceLabel: 'R750',
    description: 'One additional job listing.',
    color: 'text-[#0A2540]',
    border: 'border-gray-200',
    buttonClass: 'bg-[#0A2540] hover:bg-[#081f36] text-white',
    buttonLabel: 'Buy 1 Post',
    disabled: false,
    popular: false,
  },
  {
    name: '3 Posts',
    posts: 3,
    price: 1800,
    priceLabel: 'R1,800',
    description: 'Great for growing teams.',
    color: 'text-[#00C853]',
    border: 'border-[#00C853]',
    buttonClass: 'bg-[#00C853] hover:bg-[#00B548] text-white shadow-lg shadow-green-200',
    buttonLabel: 'Buy 3 Posts',
    disabled: false,
    popular: true,
  },
  {
    name: '5 Posts',
    posts: 5,
    price: 2500,
    priceLabel: 'R2,500',
    description: 'Best value for active hiring.',
    color: 'text-[#F59E0B]',
    border: 'border-gray-200',
    buttonClass: 'bg-[#F59E0B] hover:bg-[#D97706] text-white',
    buttonLabel: 'Buy 5 Posts',
    disabled: false,
    popular: false,
  },
];

export default function EmployerSubscriptions() {
  return (
    <div className="space-y-8 pb-20">

      {/* Header */}
      <div className="text-center space-y-3 max-w-xl mx-auto">
        <h1 className="text-3xl font-bold text-[#0A2540]">Job Posting Packages</h1>
        <p className="text-gray-500">
          Every employer gets <strong>1 free post</strong>. Buy additional credits whenever you need them — no subscription required.
        </p>
      </div>

      {/* Package Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        {PACKAGES.map((pkg) => (
          <div
            key={pkg.name}
            className={`relative bg-white rounded-xl shadow-sm border-2 p-6 flex flex-col h-full transition-all hover:shadow-lg hover:-translate-y-1 ${pkg.border}`}
          >
            {pkg.popular && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#00C853] text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                Best Value
              </div>
            )}

            <div className="mb-6 text-center">
              <h3 className={`text-sm font-bold uppercase tracking-wider mb-3 ${pkg.color}`}>{pkg.name}</h3>
              <div className="text-4xl font-bold text-[#0A2540]">{pkg.priceLabel}</div>
              <p className="text-sm text-gray-400 mt-2">{pkg.description}</p>
            </div>

            <ul className="space-y-3 mb-8 flex-1">
              <li className="flex items-center gap-3 text-sm text-gray-600">
                <Check className={`w-4 h-4 flex-shrink-0 ${pkg.color}`} />
                <span>{pkg.posts} job {pkg.posts === 1 ? 'listing' : 'listings'}</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-gray-600">
                <Check className={`w-4 h-4 flex-shrink-0 ${pkg.color}`} />
                <span>Unlimited applications</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-gray-600">
                <Check className={`w-4 h-4 flex-shrink-0 ${pkg.color}`} />
                <span>Full applicant management</span>
              </li>
              {pkg.posts >= 3 && (
                <li className="flex items-center gap-3 text-sm text-gray-600">
                  <Check className={`w-4 h-4 flex-shrink-0 ${pkg.color}`} />
                  <span>Video assessments</span>
                </li>
              )}
              {pkg.posts >= 5 && (
                <li className="flex items-center gap-3 text-sm text-gray-600">
                  <Check className={`w-4 h-4 flex-shrink-0 ${pkg.color}`} />
                  <span>Priority support</span>
                </li>
              )}
            </ul>

            <Button className={`w-full font-bold ${pkg.buttonClass}`} disabled={pkg.disabled}>
              {pkg.buttonLabel}
            </Button>
          </div>
        ))}
      </div>

      {/* Note */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl p-4 max-w-2xl mx-auto text-sm text-blue-700">
        <Zap className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <p>Post credits never expire. Buy when you need them and use them at your own pace.</p>
      </div>

    </div>
  );
}
