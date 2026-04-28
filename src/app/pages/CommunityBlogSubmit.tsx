import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { useAuth } from '../context/useAuth';
import type { CommunityBlogPost } from '../types';
import { listMyCommunityBlogSubmissions, submitCommunityBlogPost } from '../services/communityBlogService';

type BlogSubmissionForm = {
  title: string;
  excerpt: string;
  content: string;
  coverImageUrl: string;
};

const DEFAULT_FORM: BlogSubmissionForm = {
  title: '',
  excerpt: '',
  content: '',
  coverImageUrl: '',
};

function statusLabel(status: CommunityBlogPost['status']) {
  if (status === 'pending_review') return 'Pending review';
  if (status === 'published') return 'Approved & published';
  if (status === 'rejected') return 'Rejected';
  return 'Draft';
}

export default function CommunityBlogSubmit() {
  const { profile } = useAuth();
  const [form, setForm] = useState<BlogSubmissionForm>(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [myPosts, setMyPosts] = useState<CommunityBlogPost[]>([]);

  const userRole = String(profile?.userType || profile?.user_type || '').toLowerCase();
  const canSubmit = userRole === 'seeker' || userRole === 'employer';

  async function loadMyPosts() {
    setLoading(true);
    try {
      const rows = await listMyCommunityBlogSubmissions();
      setMyPosts(rows);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load your submissions');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadMyPosts();
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!canSubmit) {
      toast.error('Only seeker and employer accounts can submit blogs');
      return;
    }

    setSubmitting(true);
    try {
      await submitCommunityBlogPost({
        title: form.title,
        excerpt: form.excerpt,
        content: form.content,
        coverImageUrl: form.coverImageUrl,
        authorName: profile?.name,
      });

      toast.success('Blog submitted for admin review');
      setForm(DEFAULT_FORM);
      await loadMyPosts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to submit blog');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--rf-bg)] py-10">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:px-8">
        <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-[#0A2540]">Submit a community blog</h1>
          <p className="mt-1 text-sm text-gray-500">
            Your post will be reviewed by an admin before it becomes visible in the community section.
          </p>

          {!canSubmit && (
            <div className="mt-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Blog submissions are currently available for seeker and employer accounts only.
            </div>
          )}

          <form className="mt-5 space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="mb-1 block text-sm font-semibold text-[#0A2540]">Title</label>
              <input
                type="text"
                className="w-full rounded border border-gray-200 px-3 py-2 text-sm"
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                required
                disabled={!canSubmit || submitting}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-[#0A2540]">Excerpt</label>
              <textarea
                className="h-20 w-full rounded border border-gray-200 px-3 py-2 text-sm"
                value={form.excerpt}
                onChange={(e) => setForm((prev) => ({ ...prev, excerpt: e.target.value }))}
                disabled={!canSubmit || submitting}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-[#0A2540]">Content</label>
              <textarea
                className="h-48 w-full rounded border border-gray-200 px-3 py-2 text-sm"
                value={form.content}
                onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
                required
                disabled={!canSubmit || submitting}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-[#0A2540]">Cover image URL (optional)</label>
              <input
                type="url"
                className="w-full rounded border border-gray-200 px-3 py-2 text-sm"
                value={form.coverImageUrl}
                onChange={(e) => setForm((prev) => ({ ...prev, coverImageUrl: e.target.value }))}
                disabled={!canSubmit || submitting}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={!canSubmit || submitting}
                className="rounded bg-[#00C853] px-4 py-2 text-sm font-semibold text-white hover:bg-[#00b64a] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit for review'}
              </button>
              <Link to="/community" className="text-sm font-semibold text-[var(--rf-green)] hover:underline">
                Back to Community
              </Link>
            </div>
          </form>
        </section>

        <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-[#0A2540]">My submissions</h2>
          <p className="mt-1 text-xs text-gray-500">Track review outcomes and publication status.</p>

          {loading ? (
            <p className="mt-4 text-sm text-gray-500">Loading submissions...</p>
          ) : myPosts.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">You haven’t submitted any posts yet.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {myPosts.map((post) => (
                <li key={post.id} className="rounded border border-gray-200 p-3">
                  <p className="font-semibold text-[#0A2540]">{post.title}</p>
                  <p className="mt-1 text-xs text-gray-500">{statusLabel(post.status)}</p>
                  {post.review_notes && (
                    <p className="mt-2 text-xs text-gray-600">
                      <span className="font-semibold">Review note:</span> {post.review_notes}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
