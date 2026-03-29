import { useEffect, useMemo, useState } from 'react';
import { Users, Gift, Share2, Copy, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { apiCall } from '../lib/supabase';
import type { Referral } from '../types';

export default function Networking() {
    const [referrals, setReferrals] = useState<Referral[]>([]);
    const [referralLink, setReferralLink] = useState('https://recruitfriend.co.za/ref');
    const [earnings, setEarnings] = useState({ total: 0, pending: 0, available: 0 });
    const [activeReferrals, setActiveReferrals] = useState(0);
    const [refereeEmail, setRefereeEmail] = useState('');
    const [sendingInvite, setSendingInvite] = useState(false);

    useEffect(() => {
        loadReferrals();
    }, []);

    async function loadReferrals() {
        try {
            const { referrals: rows, referralLink: link, earnings: values, stats } = await apiCall('/referrals/my', { requireAuth: true });
            setReferrals(rows || []);
            setReferralLink(link || referralLink);
            setEarnings(values || { total: 0, pending: 0, available: 0 });
            setActiveReferrals(stats?.active || 0);
        } catch (error: any) {
            toast.error(error.message || 'Failed to load referral data');
        }
    }

    async function copyLink() {
        try {
            await navigator.clipboard.writeText(referralLink);
            toast.success('Referral link copied');
        } catch {
            toast.error('Unable to copy link');
        }
    }

    function shareWhatsApp() {
        const text = encodeURIComponent(`Join me on RecruitFriend: ${referralLink}`);
        window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
    }

    function showHowItWorks() {
        toast.info('Share your link, earn R50 on signup and R500 when your referral gets hired.');
    }

    async function shareMore() {
        try {
            if (navigator.share) {
                await navigator.share({ title: 'RecruitFriend referral', text: 'Join me on RecruitFriend', url: referralLink });
            } else {
                await navigator.clipboard.writeText(referralLink);
                toast.success('Link copied to clipboard');
            }
        } catch {
            toast.error('Unable to share right now');
        }
    }

    async function sendReferralInvite() {
        const email = refereeEmail.trim().toLowerCase();
        if (!email) {
            toast.error('Please enter an email address');
            return;
        }
        if (!/^\S+@\S+\.\S+$/.test(email)) {
            toast.error('Please enter a valid email address');
            return;
        }

        setSendingInvite(true);
        try {
            await apiCall('/referrals', {
                requireAuth: true,
                method: 'POST',
                body: JSON.stringify({ refereeEmail: email }),
            });
            toast.success('Referral invite sent');
            setRefereeEmail('');
            await loadReferrals();
        } catch (error: any) {
            toast.error(error?.message || 'Failed to send referral invite');
        } finally {
            setSendingInvite(false);
        }
    }

    const topPerformers = useMemo(() => referrals.slice(0, 5), [referrals]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--rf-navy)] flex items-center">
            <Users className="w-6 h-6 mr-3 text-[var(--rf-green)]" />
            My RecruitFriend Network
        </h1>
                <button onClick={showHowItWorks} className="text-sm text-[var(--rf-green)] font-semibold hover:underline">
            How it works?
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-[var(--rf-green)] to-[#008f35] text-white rounded-[var(--rf-radius-lg)] shadow-lg p-8 relative overflow-hidden">
            <div className="relative z-10">
                <Gift className="w-10 h-10 mb-4 text-white opacity-90" />
                <h2 className="text-2xl font-bold mb-2">Refer & Earn</h2>
                <p className="mb-6 opacity-90 text-sm">
                    Share your unique link. Earn <span className="font-bold">R50</span> when a friend signs up and <span className="font-bold">R500</span> when they get hired!
                </p>
                
                <div className="bg-white/20 backdrop-blur-sm rounded-[var(--rf-radius-md)] p-1 flex items-center mb-4 border border-white/30">
                    <input
                        type="text"
                        value={referralLink}
                        readOnly
                        className="flex-1 bg-transparent border-none text-white text-sm px-3 focus:outline-none"
                    />
                    <button onClick={copyLink} className="px-4 py-2 bg-white text-[var(--rf-green)] rounded-[var(--rf-radius-md)] hover:bg-gray-100 transition-colors font-bold text-xs flex items-center shadow-sm">
                        <Copy className="w-3 h-3 mr-1" /> Copy
                    </button>
                </div>

                <div className="flex gap-2">
                    <button onClick={shareWhatsApp} className="flex-1 py-2 bg-[#25D366] text-white rounded-[var(--rf-radius-md)] hover:brightness-110 transition-all font-semibold text-sm shadow-md flex items-center justify-center">
                        WhatsApp
                    </button>
                    <button onClick={shareMore} className="flex-1 py-2 bg-white/20 text-white rounded-[var(--rf-radius-md)] hover:bg-white/30 transition-all font-semibold text-sm flex items-center justify-center">
                        <Share2 className="w-4 h-4 mr-1" /> More
                    </button>
                </div>

                <div className="mt-4 space-y-2">
                    <input
                        type="email"
                        value={refereeEmail}
                        onChange={(e) => setRefereeEmail(e.target.value)}
                        placeholder="friend@example.com"
                        className="w-full bg-white/20 text-white placeholder:text-white/70 rounded-[var(--rf-radius-md)] px-3 py-2 border border-white/30 focus:outline-none"
                    />
                    <button
                        type="button"
                        onClick={sendReferralInvite}
                        disabled={sendingInvite}
                        className="w-full py-2 bg-white text-[var(--rf-green)] rounded-[var(--rf-radius-md)] hover:bg-gray-100 transition-all font-semibold text-sm disabled:opacity-70"
                    >
                        {sendingInvite ? 'Sending invite...' : 'Send referral invite email'}
                    </button>
                </div>
            </div>
            <Users className="absolute -bottom-10 -right-10 w-48 h-48 text-white opacity-10" />
          </div>

          <div className="space-y-6">
             {/* Stats */}
             <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] p-5 border-l-4 border-[var(--rf-green)]">
                    <div className="text-[var(--rf-muted)] text-xs uppercase font-semibold mb-1">Total Earned</div>
                          <div className="text-2xl font-bold text-[var(--rf-navy)]">R {earnings.total}</div>
                </div>
                <div className="bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] p-5 border-l-4 border-[var(--rf-navy)]">
                   <div className="text-[var(--rf-muted)] text-xs uppercase font-semibold mb-1">Active Referrals</div>
                         <div className="text-2xl font-bold text-[var(--rf-navy)]">{activeReferrals}</div>
                </div>
             </div>

             {/* Recent Activity */}
             <div className="bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] p-6 flex-1">
                <h3 className="font-bold text-[var(--rf-navy)] mb-4 flex items-center">
                    <Trophy className="w-4 h-4 mr-2 text-yellow-500" />
                    Top Performers
                </h3>
                <div className="space-y-3">
                                        {topPerformers.length === 0 ? (
                                            <p className="text-sm text-gray-500 italic">No top performers yet.</p>
                                        ) : (
                                            topPerformers.map((r) => (
                                                <div key={r.id} className="text-sm text-[var(--rf-text)] flex justify-between">
                                                    <span>{r.referee_email || 'Referral invite'}</span>
                                                    <span className="font-semibold">
                                                        {r.status}
                                                        {r.invite_email_status ? ` • email: ${r.invite_email_status}` : ''}
                                                    </span>
                                                </div>
                                            ))
                                        )}
                </div>
             </div>
          </div>
      </div>
      
      {/* Network List Table Placeholder */}
      <div className="bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] overflow-hidden">
        <div className="p-6 border-b border-gray-100">
            <h3 className="font-bold text-[var(--rf-navy)]">Your Connections</h3>
        </div>
        <div className="p-8 text-center text-gray-400">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>{referrals.length ? `${referrals.length} referral activities recorded.` : 'Your network activity will appear here.'}</p>
        </div>
      </div>
    </div>
  );
}
