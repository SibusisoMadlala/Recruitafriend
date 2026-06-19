import { useState, useEffect } from 'react';
import { Users, UserPlus, Trash2, Loader2, Mail, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/useAuth';
import { toast } from 'sonner';

type TeamMember = {
  id: string;
  member_id: string;
  member_email: string;
  member_name: string | null;
  created_at: string;
};

export default function EmployerTeam() {
  const { user } = useAuth();
  const [members, setMembers]   = useState<TeamMember[]>([]);
  const [loading, setLoading]   = useState(true);
  const [email, setEmail]       = useState('');
  const [adding, setAdding]     = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('team_members')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setMembers(data ?? []); setLoading(false); });
  }, [user]);

  async function handleAdd() {
    if (!user || !email.trim()) return;
    const normalised = email.trim().toLowerCase();

    // Check they're not already in the team
    if (members.some(m => m.member_email.toLowerCase() === normalised)) {
      toast.error('This person is already in your team.');
      return;
    }

    setAdding(true);
    try {
      // Look up the user by email in profiles
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, name, role')
        .eq('email', normalised)
        .maybeSingle();

      if (error || !profile) {
        toast.error('No RecruitFriend account found with that email.');
        return;
      }

      if (profile.role !== 'employer') {
        toast.error('That account is not an employer account.');
        return;
      }

      if (profile.id === user.id) {
        toast.error("You can't add yourself to your team.");
        return;
      }

      const { data: newMember, error: insertError } = await supabase
        .from('team_members')
        .insert({
          owner_id:     user.id,
          member_id:    profile.id,
          member_email: normalised,
          member_name:  profile.name ?? null,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setMembers(prev => [newMember, ...prev]);
      setEmail('');
      toast.success(`${profile.name || normalised} added to your team.`);
    } catch {
      toast.error('Failed to add team member. Please try again.');
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(id: string, name: string | null) {
    setRemoving(id);
    const { error } = await supabase.from('team_members').delete().eq('id', id);
    if (error) {
      toast.error('Failed to remove member.');
    } else {
      setMembers(prev => prev.filter(m => m.id !== id));
      toast.success(`${name || 'Member'} removed from your team.`);
    }
    setRemoving(null);
  }

  function initials(name: string | null, email: string) {
    if (name) return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    return email.slice(0, 2).toUpperCase();
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--rf-navy)]">My Team</h1>
        <p className="text-gray-500 mt-1">
          Add colleagues to your team so you can invite them to join interview calls.
        </p>
      </div>

      {/* Add member card */}
      <div className="bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] p-6">
        <h2 className="font-semibold text-[var(--rf-navy)] mb-4 flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-[var(--rf-green)]" />
          Add a team member
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          They must already have a RecruitFriend employer account.
        </p>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="colleague@company.com"
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-[var(--rf-radius-md)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--rf-green)] focus:border-transparent"
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={adding || !email.trim()}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--rf-green)] text-white font-semibold rounded-[var(--rf-radius-md)] hover:bg-[#00B548] transition-colors disabled:opacity-60 text-sm"
          >
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            Add
          </button>
        </div>
      </div>

      {/* Team list */}
      <div className="bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-[var(--rf-navy)] flex items-center gap-2">
            <Users className="w-4 h-4 text-[var(--rf-green)]" />
            Team members
            {members.length > 0 && (
              <span className="ml-1 text-xs bg-[var(--rf-green)] text-white rounded-full px-2 py-0.5 font-bold">
                {members.length}
              </span>
            )}
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--rf-green)]" />
          </div>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-3 text-center px-6">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
              <Users className="w-7 h-7 text-gray-300" />
            </div>
            <p className="font-semibold text-[var(--rf-navy)]">No team members yet</p>
            <p className="text-sm text-gray-400 max-w-xs">
              Add colleagues above so you can bring them into interview calls as co-interviewers.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {members.map(m => (
              <li key={m.id} className="flex items-center gap-4 px-6 py-4">
                <div className="w-10 h-10 rounded-full bg-[var(--rf-navy)] flex items-center justify-center shrink-0">
                  <span className="text-white text-sm font-bold">
                    {initials(m.member_name, m.member_email)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[var(--rf-navy)] truncate">
                    {m.member_name || m.member_email}
                  </p>
                  {m.member_name && (
                    <p className="text-xs text-gray-400 truncate">{m.member_email}</p>
                  )}
                </div>
                <button
                  onClick={() => handleRemove(m.id, m.member_name)}
                  disabled={removing === m.id}
                  className="p-2 rounded-[var(--rf-radius-md)] text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                  title="Remove from team"
                >
                  {removing === m.id
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Trash2 className="w-4 h-4" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {members.length > 0 && (
        <p className="text-xs text-gray-400 text-center">
          Team members can be invited to join any of your live interview calls.
        </p>
      )}
    </div>
  );
}
