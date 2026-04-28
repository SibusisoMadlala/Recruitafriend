import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, Calendar, User } from 'lucide-react';
import type { CommunityBlogPost } from '../types';
import { getCommunityBlogPostBySlug } from '../services/communityBlogService';

export default function CommunityBlogDetail() {
  const { slug = '' } = useParams();
  const [post, setPost] = useState<CommunityBlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const payload = await getCommunityBlogPostBySlug(slug);
        if (!ignore) {
          setPost(payload);
        }
      } catch (e) {
        if (!ignore) {
          setPost(null);
          setError(e instanceof Error ? e.message : 'Failed to load post');
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
  }, [slug]);

  return (
    <div className="min-h-screen bg-[var(--rf-bg)] py-10">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <Link to="/community" className="mb-6 inline-flex items-center gap-1 text-sm font-semibold text-[var(--rf-green)] hover:underline">
          <ArrowLeft className="h-4 w-4" />
          Back to Community
        </Link>

        {loading ? (
          <div className="rounded-xl border border-gray-100 bg-white py-20 text-center shadow-sm">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-[var(--rf-green)]" />
            <p className="text-sm text-[var(--rf-muted)]">Loading post...</p>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <h1 className="text-xl font-bold text-[var(--rf-navy)]">Post not available</h1>
            <p className="mt-2 text-sm text-gray-500">{error}</p>
          </div>
        ) : !post ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <h1 className="text-xl font-bold text-[var(--rf-navy)]">Post not found</h1>
          </div>
        ) : (
          <article className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm sm:p-10">
            <header className="mb-6 border-b border-gray-100 pb-6">
              <h1 className="text-3xl font-bold text-[var(--rf-navy)]">{post.title}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-gray-500">
                <span className="inline-flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  {post.author_name || 'RecruitFriend Team'}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {post.published_at ? new Date(post.published_at).toLocaleDateString() : 'Recently'}
                </span>
              </div>
            </header>

            {post.excerpt && <p className="mb-6 text-base text-gray-600">{post.excerpt}</p>}

            <div className="prose prose-slate max-w-none whitespace-pre-wrap text-[var(--rf-text)]">
              {post.content}
            </div>
          </article>
        )}
      </div>
    </div>
  );
}
