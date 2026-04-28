import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../context/useAuth';
import type { CommunityBlogPost } from '../types';
import {
  createAdminCommunityBlogPost,
  deleteAdminCommunityBlogPost,
  listAdminCommunityBlogPosts,
  publishAdminCommunityBlogPost,
  reviewAdminCommunityBlogPost,
  unpublishAdminCommunityBlogPost,
  updateAdminCommunityBlogPost,
} from '../services/communityBlogService';

type BlogFormState = {
  title: string;
  excerpt: string;
  content: string;
  coverImageUrl: string;
  featured: boolean;
};

const DEFAULT_FORM: BlogFormState = {
  title: '',
  excerpt: '',
  content: '',
  coverImageUrl: '',
  featured: false,
};

export default function AdminCommunityBlogs() {
  const { profile } = useAuth();
  const [posts, setPosts] = useState<CommunityBlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [form, setForm] = useState<BlogFormState>(DEFAULT_FORM);
  const [reviewNotes, setReviewNotes] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending_review' | 'published' | 'rejected' | 'draft'>('all');

  const selectedPost = useMemo(
    () => posts.find((post) => post.id === selectedPostId) || null,
    [posts, selectedPostId]
  );

  const visiblePosts = useMemo(() => {
    if (statusFilter === 'all') return posts;
    return posts.filter((post) => post.status === statusFilter);
  }, [posts, statusFilter]);

  async function loadPosts() {
    setLoading(true);
    try {
      const rows = await listAdminCommunityBlogPosts();
      setPosts(rows);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load blog posts');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPosts();
  }, []);

  useEffect(() => {
    if (!selectedPost) {
      setForm(DEFAULT_FORM);
      setReviewNotes('');
      return;
    }

    setForm({
      title: selectedPost.title || '',
      excerpt: selectedPost.excerpt || '',
      content: selectedPost.content || '',
      coverImageUrl: selectedPost.cover_image_url || '',
      featured: Boolean(selectedPost.featured),
    });
    setReviewNotes(selectedPost.review_notes || '');
  }, [selectedPost]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (selectedPostId) {
        await updateAdminCommunityBlogPost(selectedPostId, {
          title: form.title,
          excerpt: form.excerpt,
          content: form.content,
          coverImageUrl: form.coverImageUrl,
          featured: form.featured,
          authorName: profile?.name,
        });
        toast.success('Blog post updated');
      } else {
        await createAdminCommunityBlogPost({
          title: form.title,
          excerpt: form.excerpt,
          content: form.content,
          coverImageUrl: form.coverImageUrl,
          featured: form.featured,
          authorName: profile?.name,
          status: 'draft',
        });
        toast.success('Draft blog post created');
      }

      await loadPosts();
      if (!selectedPostId) {
        setForm(DEFAULT_FORM);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save blog post');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(postId: string) {
    if (!window.confirm('Delete this blog post? This cannot be undone.')) {
      return;
    }

    try {
      await deleteAdminCommunityBlogPost(postId);
      toast.success('Blog post deleted');
      if (selectedPostId === postId) {
        setSelectedPostId(null);
      }
      await loadPosts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete blog post');
    }
  }

  async function handlePublish(post: CommunityBlogPost) {
    try {
      if (post.status === 'published') {
        await unpublishAdminCommunityBlogPost(post.id);
        toast.success('Blog post moved to draft');
      } else {
        await publishAdminCommunityBlogPost(post.id);
        toast.success('Blog post published');
      }
      await loadPosts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to change publish status');
    }
  }

  async function handleReview(post: CommunityBlogPost, decision: 'approve' | 'reject') {
    try {
      await reviewAdminCommunityBlogPost(post.id, decision, reviewNotes);
      toast.success(decision === 'approve' ? 'Blog approved and published' : 'Blog rejected');
      await loadPosts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to ${decision} blog`);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-[#0A2540]">Community blog posts</h1>
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700"
            >
              <option value="all">All statuses</option>
              <option value="pending_review">Pending review</option>
              <option value="published">Published</option>
              <option value="rejected">Rejected</option>
              <option value="draft">Draft</option>
            </select>
            <button
              type="button"
              className="rounded border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              onClick={() => setSelectedPostId(null)}
            >
              New draft
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Loading posts...</p>
        ) : visiblePosts.length === 0 ? (
          <p className="text-sm text-gray-500">No posts yet. Create your first draft.</p>
        ) : (
          <ul className="space-y-2">
            {visiblePosts.map((post) => (
              <li key={post.id} className="rounded border border-gray-200 p-3">
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => setSelectedPostId(post.id)}
                >
                  <p className="font-semibold text-[#0A2540]">{post.title}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {post.status} {post.featured ? '• featured' : ''}
                  </p>
                  {post.submitter_id && (
                    <p className="mt-1 text-[11px] text-gray-500">Submitted by user: {post.submitter_id}</p>
                  )}
                </button>
                <div className="mt-3 flex flex-wrap gap-2">
                  {post.status === 'pending_review' ? (
                    <>
                      <button
                        type="button"
                        className="rounded border border-emerald-300 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                        onClick={() => void handleReview(post, 'approve')}
                      >
                        Approve & publish
                      </button>
                      <button
                        type="button"
                        className="rounded border border-amber-300 px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50"
                        onClick={() => void handleReview(post, 'reject')}
                      >
                        Reject
                      </button>
                    </>
                  ) : (
                  <button
                    type="button"
                    className="rounded border border-blue-300 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                    onClick={() => void handlePublish(post)}
                  >
                    {post.status === 'published' ? 'Unpublish' : 'Publish'}
                  </button>
                  )}
                  <button
                    type="button"
                    className="rounded border border-red-300 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                    onClick={() => void handleDelete(post.id)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-[#0A2540]">
          {selectedPost ? 'Edit blog post' : 'Create blog post'}
        </h2>
        <p className="mt-1 text-xs text-gray-500">Title and content are required. Pending submissions can be approved or rejected.</p>

        {selectedPost && (
          <div className="mt-3 rounded border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Review notes</p>
            <textarea
              className="mt-2 h-20 w-full rounded border border-gray-200 px-3 py-2 text-sm"
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="Optional notes for approval/rejection feedback"
            />
          </div>
        )}

        <form className="mt-4 space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="mb-1 block text-sm font-semibold text-[#0A2540]">Title</label>
            <input
              type="text"
              className="w-full rounded border border-gray-200 px-3 py-2 text-sm"
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-[#0A2540]">Excerpt</label>
            <textarea
              className="h-20 w-full rounded border border-gray-200 px-3 py-2 text-sm"
              value={form.excerpt}
              onChange={(e) => setForm((prev) => ({ ...prev, excerpt: e.target.value }))}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-[#0A2540]">Content</label>
            <textarea
              className="h-40 w-full rounded border border-gray-200 px-3 py-2 text-sm"
              value={form.content}
              onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-[#0A2540]">Cover image URL (optional)</label>
            <input
              type="url"
              className="w-full rounded border border-gray-200 px-3 py-2 text-sm"
              value={form.coverImageUrl}
              onChange={(e) => setForm((prev) => ({ ...prev, coverImageUrl: e.target.value }))}
            />
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.featured}
              onChange={(e) => setForm((prev) => ({ ...prev, featured: e.target.checked }))}
            />
            Mark as featured
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              className="rounded bg-[#00C853] px-4 py-2 text-sm font-semibold text-white hover:bg-[#00b64a] disabled:opacity-50"
              disabled={submitting}
            >
              {submitting ? 'Saving...' : selectedPost ? 'Save changes' : 'Create draft'}
            </button>
            {selectedPost && (
              <button
                type="button"
                className="rounded border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                onClick={() => setSelectedPostId(null)}
              >
                Cancel edit
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
