import { useState } from 'react';
import { useAuth } from '../context/useAuth';
import { Check, X, Sparkles, Loader2 } from 'lucide-react';
import { apiCall } from '../lib/supabase';
import { toast } from 'sonner';

export default function SeekerSubscriptions() {
    const { profile, refreshProfile } = useAuth();
    const [currentPlan, setCurrentPlan] = useState((profile?.subscription || 'free').toLowerCase());
    const [workingPlan, setWorkingPlan] = useState<string | null>(null);

  const plans = [
    {
      id: 'free',
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
    },
    {
      id: 'premium',
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
    },
    {
      id: 'professional',
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
      ],
    },
  ];

    async function changePlan(planId: string) {
        if (planId === currentPlan) return;
        setWorkingPlan(planId);
        try {
            const { subscription } = await apiCall('/subscriptions/change', {
                method: 'POST',
                body: JSON.stringify({ plan: planId }),
            });
            setCurrentPlan((subscription || planId).toLowerCase());
            await refreshProfile();
            toast.success(`Plan changed to ${planId}`);
        } catch (error: any) {
            toast.error(error.message || 'Failed to change plan');
        } finally {
            setWorkingPlan(null);
        }
    }

    async function startTrial() {
        setWorkingPlan('trial');
        try {
            const { subscription } = await apiCall('/subscriptions/trial', { method: 'POST' });
            setCurrentPlan((subscription || 'premium_trial').toLowerCase());
            await refreshProfile();
            toast.success('Free trial started');
        } catch (error: any) {
            toast.error(error.message || 'Failed to start trial');
        } finally {
            setWorkingPlan(null);
        }
    }
  
  return (
    <div className="space-y-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
            <h1 className="text-3xl font-bold text-[var(--rf-navy)] mb-4">Upgrade Your Career</h1>
            <p className="text-[var(--rf-muted)]">
                Unlock exclusive features to get hired faster. Cancel anytime.
            </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {plans.map((plan) => {
                const isCurrent = currentPlan === plan.id;
                return (
                <div 
                    key={plan.name} 
                    className={`relative bg-white rounded-[var(--rf-radius-lg)] shadow-lg overflow-hidden border-2 transition-transform hover:-translate-y-2 duration-300 ${plan.color === 'green' ? 'border-[var(--rf-green)] ring-4 ring-green-50 scale-105 z-10' : 'border-transparent'}`}
                >
                    {plan.badge && (
                        <div className="absolute top-0 right-0 left-0 bg-[var(--rf-green)] text-white text-xs font-bold text-center py-1 uppercase tracking-widest">
                            {plan.badge}
                        </div>
                    )}
                    
                    <div className="p-8 pb-4 text-center">
                        <h3 className={`font-bold text-lg mb-2 ${plan.color === 'navy' ? 'text-[var(--rf-navy)]' : plan.color === 'green' ? 'text-[var(--rf-green)]' : 'text-gray-500'}`}>
                            {plan.name}
                        </h3>
                        <div className="flex justify-center items-end mb-1">
                            <span className="text-4xl font-bold text-[var(--rf-navy)]">{plan.price}</span>
                            {plan.period && <span className="text-gray-400 text-sm mb-1">{plan.period}</span>}
                        </div>
                    </div>
                    
                    <div className="p-8 pt-4">
                        <ul className="space-y-3 mb-8">
                            {plan.features.map((feature, i) => (
                                <li key={i} className="flex items-start text-sm">
                                    {feature.included ? (
                                        <Check className="w-4 h-4 text-[var(--rf-green)] mt-0.5 mr-2 flex-shrink-0" />
                                    ) : (
                                        <X className="w-4 h-4 text-gray-300 mt-0.5 mr-2 flex-shrink-0" />
                                    )}
                                    <span className={feature.included ? 'text-gray-700' : 'text-gray-400 decoration-slice'}>
                                        {feature.text}
                                    </span>
                                </li>
                            ))}
                        </ul>
                        
                        <button 
                            onClick={() => changePlan(plan.id)}
                            disabled={isCurrent}
                            className={`w-full py-3 rounded-[var(--rf-radius-md)] font-bold transition-colors ${
                                isCurrent 
                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                    : plan.color === 'green' 
                                        ? 'bg-[var(--rf-green)] text-white hover:bg-[#00B548] shadow-md'
                                        : 'bg-[var(--rf-navy)] text-white hover:bg-[#1a3a5f]'
                            }`}
                        >
                            {workingPlan === plan.id ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (isCurrent ? 'Current Plan' : `Get ${plan.name}`)}
                        </button>
                    </div>
                </div>
            )})}
        </div>
        
        <div className="bg-blue-50 rounded-[var(--rf-radius-lg)] p-6 flex items-center justify-between border border-blue-100">
             <div className="flex items-center">
                 <div className="p-3 bg-white rounded-full text-blue-500 shadow-sm mr-4">
                     <Sparkles className="w-6 h-6" />
                 </div>
                 <div>
                     <h4 className="font-bold text-[var(--rf-navy)]">Not sure which plan is right for you?</h4>
                     <p className="text-sm text-[var(--rf-muted)]">Get a 7-day free trial of Premium to test out all features.</p>
                 </div>
             </div>
             <button onClick={startTrial} disabled={workingPlan === 'trial'} className="px-6 py-2 bg-white text-blue-600 font-bold rounded-[var(--rf-radius-md)] hover:bg-gray-50 border border-blue-200 transaction-colors disabled:opacity-60">
                 {workingPlan === 'trial' ? 'Starting...' : 'Start Free Trial'}
             </button>
        </div>
    </div>
  );
}
