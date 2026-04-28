import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight, Calendar, Rss, Sparkles, User } from 'lucide-react';
import type { CommunityBlogPost } from '../types';
import { listCommunityBlogPosts } from '../services/communityBlogService';
import { useAuth } from '../context/useAuth';

export default function CommunityBlogs() {
  const { profile, user } = useAuth();
  const [posts, setPosts] = useState<CommunityBlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const payload = await listCommunityBlogPosts({ limit: 24 });
        if (!ignore) {
          setPosts(payload.posts || []);
        }
      } catch (e) {
        if (!ignore) {
          setError(e instanceof Error ? e.message : 'Failed to load community blog posts');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    })();

    return () => {
      ignore = true;
    };
  }, []);

  const featuredPosts = useMemo(() => posts.filter((post) => post.featured).slice(0, 3), [posts]);
  const latestPosts = useMemo(() => posts.slice(0, 9), [posts]);
  const role = String(profile?.userType || profile?.user_type || '').toLowerCase();
  const canSubmit = Boolean(user) && (role === 'seeker' || role === 'employer');

  return (
    <div className="min-h-screen bg-[var(--rf-bg)] py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h1 className="mb-4 text-3xl font-bold text-[var(--rf-navy)]">Community Blog</h1>
          <p className="mx-auto max-w-2xl text-[var(--rf-muted)]">
            Insights, advice, and stories from the RecruitFriend community to help you succeed in your career journey.
          </p>
          {canSubmit && (
            <div className="mt-5">
              <Link
                to="/community/submit"
                className="inline-flex items-center rounded-[var(--rf-radius-md)] bg-[var(--rf-green)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#00b64a]"
              >
                Submit your blog for review
              </Link>
            </div>
          )}
        </div>

        {loading ? (
          <div className="rounded-xl border border-gray-100 bg-white py-20 text-center shadow-sm">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-[var(--rf-green)]" />
            <p className="text-sm text-[var(--rf-muted)]">Loading blog posts...</p>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-100 bg-red-50 px-6 py-8 text-center">
            <p className="font-semibold text-red-700">We couldn&apos;t load community posts.</p>
            <p className="mt-1 text-sm text-red-600">{error}</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-gray-100 bg-white py-20 shadow-sm">
            <div className="mb-4 rounded-full bg-gray-50 p-6">
              <Rss className="h-12 w-12 text-gray-300" />
            </div>
            <h2 className="mb-2 text-xl font-bold text-[#0A2540]">No Blog Posts Yet</h2>
            <p className="mb-6 max-w-md text-center text-gray-500">
              Check back soon for the latest career advice, industry trends, and success stories.
            </p>
            <Link
              to="/"
              className="inline-flex items-center rounded-[var(--rf-radius-md)] bg-[var(--rf-green)] px-4 py-2 font-semibold text-white transition-colors hover:bg-[var(--rf-green-hover,#00B548)]"
            >
              Back to Home
            </Link>
          </div>
        ) : (
          <div className="space-y-10">
            {featuredPosts.length > 0 && (
              <section>
                <div className="mb-4 flex items-center gap-2 text-[var(--rf-navy)]">
                  <Sparkles className="h-4 w-4 text-[var(--rf-green)]" />
                  <h2 className="text-lg font-bold">Featured</h2>
                </div>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {featuredPosts.map((post) => (
                    <article key={post.id} className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--rf-green)]">Featured</p>
                      <h3 className="text-lg font-bold text-[var(--rf-navy)]">
                        <Link to={`/community/${post.slug}`} className="hover:text-[var(--rf-green)]">
                          {post.title}
                        </Link>
                      </h3>
                      <p className="mt-2 line-clamp-3 text-sm text-[var(--rf-muted)]">{post.excerpt || 'Read the full story for details.'}</p>
                    </article>
                  ))}
                </div>
              </section>
            )}

            <section>
              <h2 className="mb-4 text-lg font-bold text-[var(--rf-navy)]">Latest posts</h2>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {latestPosts.map((post) => {
                  const publishedLabel = post.published_at
                    ? new Date(post.published_at).toLocaleDateString()
                    : 'Recently';

                  return (
                    <article key={post.id} className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm transition hover:shadow-md">
                      <h3 className="text-lg font-bold text-[var(--rf-navy)]">
                        <Link to={`/community/${post.slug}`} className="hover:text-[var(--rf-green)]">
                          {post.title}
                        </Link>
                      </h3>
                      <p className="mt-2 line-clamp-3 text-sm text-[var(--rf-muted)]">{post.excerpt || 'Read the full story for details.'}</p>
                      <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
                        <span className="inline-flex items-center gap-1">
                          <User className="h-3.5 w-3.5" />
                          {post.author_name || 'RecruitFriend Team'}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {publishedLabel}
                        </span>
                      </div>
                      <Link
                        to={`/community/${post.slug}`}
                        className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[var(--rf-green)] hover:underline"
                      >
                        Read article
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </article>
                  );
                })}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
