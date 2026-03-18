import { useState } from 'react';
import { 
  Building2, MapPin, Globe, Upload, CheckCircle, 
  Linkedin, Facebook, Instagram, Twitter, Bell, Shield, Wallet, Users, Layout, Mail, Link as LinkIcon, Filter, MoreHorizontal,
  Check, Star
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';

export default function EmployerSubscriptions() {
   const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');

   const plans = [
     {
       name: 'STARTER',
       price: 'R0',
       features: [
         '1 active listing',
         '10 applications/listing',
         'Basic applicant management'
       ],
       current: true,
       color: 'bg-gray-500', 
       textColor: 'text-gray-500',
       button: 'Current Plan'
     },
     {
       name: 'GROWTH',
       price: billingCycle === 'annual' ? 'R7,199/yr' : 'R799/mo',
       popular: true,
       features: [
         '5 active listings',
         'Unlimited applications',
         'Full ATS (Kanban)',
         '50 CV database searches',
         'On-demand video assessments'
       ],
       color: 'bg-[#00C853]', 
       textColor: 'text-[#00C853]',
       button: 'Upgrade to Growth'
     },
     {
       name: 'PROFESSIONAL',
       price: billingCycle === 'annual' ? 'R17,999/yr' : 'R1,999/mo',
       features: [
         '20 active listings',
         'Unlimited CV search',
         'Unlimited video assessments',
         'Advanced analytics',
         'Dedicated account manager'
       ],
       color: 'bg-[#0A2540]', 
       textColor: 'text-[#0A2540]',
       button: 'Get Professional'
     },
     {
       name: 'ENTERPRISE',
       price: 'Custom',
       features: [
         'Unlimited everything',
         'API access',
         'Custom branding',
         'SLA support',
         'Bulk posting tools'
       ],
       color: 'bg-[#F59E0B]',
       textColor: 'text-[#F59E0B]',
       button: 'Book a Demo'
     }
   ];

   return (
     <div className="space-y-8 pb-20">
        
        {/* Header */}
        <div className="text-center space-y-4 max-w-2xl mx-auto">
           <h1 className="text-3xl font-bold text-[#0A2540]">Flexible Plans for Every Team</h1>
           <p className="text-gray-500">Choose the plan that best fits your hiring needs. Upgrade or downgrade anytime.</p>
           
           <div className="flex items-center justify-center gap-4 bg-gray-100 p-1 rounded-full w-fit mx-auto">
              <button 
                onClick={() => setBillingCycle('monthly')}
                className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${billingCycle === 'monthly' ? 'bg-white shadow-sm text-[#0A2540]' : 'text-gray-500 hover:text-gray-900'}`}
              >
                 Monthly
              </button>
              <button 
                onClick={() => setBillingCycle('annual')}
                className={`px-6 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${billingCycle === 'annual' ? 'bg-white shadow-sm text-[#0A2540]' : 'text-gray-500 hover:text-gray-900'}`}
              >
                 Annual <Badge variant="secondary" className="bg-green-100 text-green-700 text-[10px] px-1.5 py-0">Save 25%</Badge>
              </button>
           </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
           {plans.map((plan) => (
              <div 
                key={plan.name} 
                className={`relative bg-white rounded-xl shadow-sm border p-6 flex flex-col h-full transition-all hover:shadow-lg hover:-translate-y-1 ${
                  plan.popular ? 'border-[#00C853] ring-1 ring-[#00C853]' : 'border-gray-200'
                }`}
              >
                 {plan.popular && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#00C853] text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                       Most Popular
                    </div>
                 )}

                 <div className="mb-6 text-center">
                    <h3 className={`text-sm font-bold uppercase tracking-wider mb-2 ${plan.textColor}`}>{plan.name}</h3>
                    <div className="text-3xl font-bold text-[#0A2540]">{plan.price}</div>
                    {billingCycle === 'annual' && plan.price !== 'R0' && plan.price !== 'Custom' && (
                       <p className="text-xs text-gray-400 mt-1">billed annually</p>
                    )}
                 </div>

                 <ul className="space-y-4 mb-8 flex-1">
                    {plan.features.map((feature, i) => (
                       <li key={i} className="flex items-start gap-3 text-sm text-gray-600">
                          <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${plan.textColor}`} />
                          <span>{feature}</span>
                       </li>
                    ))}
                 </ul>

                 <Button 
                   className={`w-full font-bold ${
                     plan.current 
                       ? 'bg-gray-100 text-gray-500 hover:bg-gray-200 shadow-none' 
                       : plan.name === 'GROWTH' 
                         ? 'bg-[#00C853] hover:bg-[#00B548] text-white shadow-lg shadow-green-200' 
                         : plan.name === 'PROFESSIONAL'
                           ? 'bg-[#0A2540] hover:bg-[#081f36] text-white'
                           : 'bg-[#F59E0B] hover:bg-[#D97706] text-white'
                   }`}
                   disabled={plan.current}
                 >
                    {plan.button}
                 </Button>
              </div>
           ))}
        </div>

        {/* Feature Comparison Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
           <div className="p-6 border-b border-gray-100">
              <h3 className="font-bold text-[#0A2540]">Feature Comparison</h3>
           </div>
           <div className="overflow-x-auto">
              <table className="w-full text-sm text-center">
                 <thead className="bg-gray-50">
                    <tr>
                       <th className="p-4 text-left text-gray-500 font-medium">Feature</th>
                       <th className="p-4 text-gray-500 font-medium w-1/5">Starter</th>
                       <th className="p-4 text-[#00C853] font-bold w-1/5 bg-[#00C853]/5">Growth</th>
                       <th className="p-4 text-[#0A2540] font-bold w-1/5">Professional</th>
                       <th className="p-4 text-[#F59E0B] font-bold w-1/5">Enterprise</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-100">
                    {[
                      ['Active Listings', '1', '5', '20', 'Unlimited'],
                      ['Applications', '10/job', 'Unlimited', 'Unlimited', 'Unlimited'],
                      ['CV Database Search', '—', '50/mo', 'Unlimited', 'Unlimited'],
                      ['Video Interviews', '—', 'On-demand (2)', 'Unlimited', 'Unlimited'],
                      ['Team Seats', '1', '2', '5', 'Unlimited'],
                    ].map((row, i) => (
                       <tr key={i} className="hover:bg-gray-50 transition-colors">
                          <td className="p-4 text-left font-medium text-gray-700">{row[0]}</td>
                          <td className="p-4 text-gray-500">{row[1]}</td>
                          <td className="p-4 text-gray-700 font-medium bg-[#00C853]/5">{row[2]}</td>
                          <td className="p-4 text-gray-700 font-medium">{row[3]}</td>
                          <td className="p-4 text-gray-700 font-medium">{row[4]}</td>
                       </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        </div>
        
     </div>
   );
}
