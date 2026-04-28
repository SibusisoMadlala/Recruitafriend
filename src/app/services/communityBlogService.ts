import { supabase } from '../lib/supabase';
import type { CommunityBlogPost, CommunityBlogStatus } from '../types';

export type BlogListResponse = {
  posts: CommunityBlogPost[];
  featured: CommunityBlogPost[];
  latest: CommunityBlogPost[];
  count: number;
};

export type UpsertCommunityBlogInput = {
  title: string;
  content: string;
  excerpt?: string;
  coverImageUrl?: string;
  featured?: boolean;
  slug?: string;
  authorName?: string;
  status?: CommunityBlogStatus;
};

export type BlogReviewDecision = 'approve' | 'reject';

function normalizeError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return new Error(error.message);
  }
  return new Error(fallback);
}

function toSlug(input: string) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function requireAuthenticatedUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user?.id) throw new Error('Not authenticated');
  return data.user.id;
}

async function assertAdminUser(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_type')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data || data.user_type !== 'admin') {
    throw new Error('Forbidden');
  }
}

function validateCorePostInput(input: UpsertCommunityBlogInput) {
  const title = String(input.title || '').trim();
  const content = String(input.content || '').trim();

  if (!title) {
    throw new Error('Title is required');
  }

  if (!content) {
    throw new Error('Content is required');
  }

  return {
    title,
    content,
    excerpt: String(input.excerpt || '').trim() || null,
    coverImageUrl: String(input.coverImageUrl || '').trim() || null,
    featured: Boolean(input.featured),
    slug: toSlug(input.slug || title),
    authorName: String(input.authorName || '').trim() || null,
    status: (input.status || 'draft') as CommunityBlogStatus,
  };
}

export async function listCommunityBlogPosts(params?: { limit?: number; featuredOnly?: boolean }): Promise<BlogListResponse> {
  try {
    const limit = Math.min(100, Math.max(1, Number(params?.limit || 24) || 24));
    let query = supabase
      .from('community_blog_posts')
      .select('id, slug, title, excerpt, content, cover_image_url, status, featured, published_at, author_id, author_name, created_at, updated_at')
      .eq('status', 'published')
      .not('published_at', 'is', null)
      .lte('published_at', new Date().toISOString());

    if (params?.featuredOnly) {
      query = query.eq('featured', true);
    }

    const { data, error } = await query
      .order('published_at', { ascending: false })
      .limit(limit);
    if (error) throw error;

    const posts = (data || []) as CommunityBlogPost[];
    return {
      posts,
      featured: posts.filter((post) => post.featured).slice(0, 3),
      latest: posts.slice(0, 9),
      count: posts.length,
    };
  } catch (error) {
    throw normalizeError(error, 'Failed to load community blog posts');
  }
}

export async function getCommunityBlogPostBySlug(slug: string): Promise<CommunityBlogPost> {
  const normalizedSlug = String(slug || '').trim();
  if (!normalizedSlug) {
    throw new Error('Blog slug is required');
  }

  try {
    const { data, error } = await supabase
      .from('community_blog_posts')
      .select('id, slug, title, excerpt, content, cover_image_url, status, featured, published_at, author_id, author_name, created_at, updated_at')
      .eq('slug', normalizedSlug)
      .eq('status', 'published')
      .not('published_at', 'is', null)
      .lte('published_at', new Date().toISOString())
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Blog post not found');
    return data as CommunityBlogPost;
  } catch (error) {
    throw normalizeError(error, 'Failed to load blog post');
  }
}

export async function listAdminCommunityBlogPosts(): Promise<CommunityBlogPost[]> {
  try {
    const userId = await requireAuthenticatedUserId();
    await assertAdminUser(userId);

    const { data, error } = await supabase
      .from('community_blog_posts')
      .select('id, slug, title, excerpt, content, cover_image_url, status, featured, published_at, author_id, author_name, submitter_id, reviewed_at, reviewed_by, review_notes, created_at, updated_at')
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return (data || []) as CommunityBlogPost[];
  } catch (error) {
    throw normalizeError(error, 'Failed to load admin blog posts');
  }
}

export async function createAdminCommunityBlogPost(input: UpsertCommunityBlogInput): Promise<CommunityBlogPost> {
  const validated = validateCorePostInput(input);

  try {
    const userId = await requireAuthenticatedUserId();
    await assertAdminUser(userId);

    const isPublished = validated.status === 'published';
    const { data, error } = await supabase
      .from('community_blog_posts')
      .insert({
        title: validated.title,
        content: validated.content,
        excerpt: validated.excerpt,
        cover_image_url: validated.coverImageUrl,
        featured: validated.featured,
        slug: validated.slug,
        author_name: validated.authorName,
        author_id: userId,
        submitter_id: userId,
        status: validated.status,
        published_at: isPublished ? new Date().toISOString() : null,
      })
      .select('id, slug, title, excerpt, content, cover_image_url, status, featured, published_at, author_id, author_name, submitter_id, reviewed_at, reviewed_by, review_notes, created_at, updated_at')
      .single();

    if (error) throw error;
    return data as CommunityBlogPost;
  } catch (error) {
    throw normalizeError(error, 'Failed to create blog post');
  }
}

export async function updateAdminCommunityBlogPost(postId: string, input: UpsertCommunityBlogInput): Promise<CommunityBlogPost> {
  const id = String(postId || '').trim();
  if (!id) {
    throw new Error('Post id is required');
  }

  const validated = validateCorePostInput(input);

  try {
    const userId = await requireAuthenticatedUserId();
    await assertAdminUser(userId);

    const payload: Record<string, unknown> = {
      title: validated.title,
      content: validated.content,
      excerpt: validated.excerpt,
      cover_image_url: validated.coverImageUrl,
      featured: validated.featured,
      slug: validated.slug,
      author_name: validated.authorName,
      status: validated.status,
      updated_at: new Date().toISOString(),
    };

    if (validated.status === 'published') {
      payload.published_at = new Date().toISOString();
      payload.reviewed_at = null;
      payload.reviewed_by = null;
      payload.review_notes = null;
    }

    if (validated.status !== 'published') {
      payload.published_at = null;
    }

    const { data, error } = await supabase
      .from('community_blog_posts')
      .update(payload)
      .eq('id', id)
      .select('id, slug, title, excerpt, content, cover_image_url, status, featured, published_at, author_id, author_name, submitter_id, reviewed_at, reviewed_by, review_notes, created_at, updated_at')
      .single();

    if (error) throw error;
    return data as CommunityBlogPost;
  } catch (error) {
    throw normalizeError(error, 'Failed to update blog post');
  }
}

export async function deleteAdminCommunityBlogPost(postId: string) {
  const id = String(postId || '').trim();
  if (!id) {
    throw new Error('Post id is required');
  }

  try {
    const userId = await requireAuthenticatedUserId();
    await assertAdminUser(userId);

    const { error } = await supabase
      .from('community_blog_posts')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    throw normalizeError(error, 'Failed to delete blog post');
  }
}

export async function publishAdminCommunityBlogPost(postId: string) {
  const id = String(postId || '').trim();
  if (!id) {
    throw new Error('Post id is required');
  }

  try {
    return await reviewAdminCommunityBlogPost(id, 'approve');
  } catch (error) {
    throw normalizeError(error, 'Failed to publish blog post');
  }
}

export async function unpublishAdminCommunityBlogPost(postId: string) {
  const id = String(postId || '').trim();
  if (!id) {
    throw new Error('Post id is required');
  }

  try {
    const userId = await requireAuthenticatedUserId();
    await assertAdminUser(userId);

    const { data, error } = await supabase
      .from('community_blog_posts')
      .update({
        status: 'draft',
        published_at: null,
        reviewed_at: null,
        reviewed_by: null,
        review_notes: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, slug, title, excerpt, content, cover_image_url, status, featured, published_at, author_id, author_name, submitter_id, reviewed_at, reviewed_by, review_notes, created_at, updated_at')
      .single();

    if (error) throw error;
    return { post: data as CommunityBlogPost };
  } catch (error) {
    throw normalizeError(error, 'Failed to unpublish blog post');
  }
}

export async function submitCommunityBlogPost(input: UpsertCommunityBlogInput): Promise<CommunityBlogPost> {
  const validated = validateCorePostInput(input);

  try {
    const userId = await requireAuthenticatedUserId();
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, user_type, name')
      .eq('id', userId)
      .maybeSingle();

    const role = String(profile?.user_type || '').toLowerCase();
    if (!profile || (role !== 'seeker' && role !== 'employer')) {
      throw new Error('Only seeker and employer accounts can submit blogs');
    }

    const { data, error } = await supabase
      .from('community_blog_posts')
      .insert({
        title: validated.title,
        content: validated.content,
        excerpt: validated.excerpt,
        cover_image_url: validated.coverImageUrl,
        featured: false,
        slug: validated.slug,
        author_name: validated.authorName || profile.name || null,
        author_id: userId,
        submitter_id: userId,
        status: 'pending_review',
        published_at: null,
      })
      .select('id, slug, title, excerpt, content, cover_image_url, status, featured, published_at, author_id, author_name, submitter_id, reviewed_at, reviewed_by, review_notes, created_at, updated_at')
      .single();

    if (error) throw error;
    return data as CommunityBlogPost;
  } catch (error) {
    throw normalizeError(error, 'Failed to submit blog post for review');
  }
}

export async function listMyCommunityBlogSubmissions(): Promise<CommunityBlogPost[]> {
  try {
    const userId = await requireAuthenticatedUserId();

    const { data, error } = await supabase
      .from('community_blog_posts')
      .select('id, slug, title, excerpt, content, cover_image_url, status, featured, published_at, author_id, author_name, submitter_id, reviewed_at, reviewed_by, review_notes, created_at, updated_at')
      .eq('submitter_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as CommunityBlogPost[];
  } catch (error) {
    throw normalizeError(error, 'Failed to load your blog submissions');
  }
}

export async function reviewAdminCommunityBlogPost(postId: string, decision: BlogReviewDecision, reviewNotes?: string | null) {
  const id = String(postId || '').trim();
  if (!id) {
    throw new Error('Post id is required');
  }

  try {
    const reviewerId = await requireAuthenticatedUserId();
    await assertAdminUser(reviewerId);

    const nextStatus: CommunityBlogStatus = decision === 'approve' ? 'published' : 'rejected';
    const notes = String(reviewNotes || '').trim();

    const payload: Record<string, unknown> = {
      status: nextStatus,
      published_at: decision === 'approve' ? new Date().toISOString() : null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewerId,
      review_notes: notes || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('community_blog_posts')
      .update(payload)
      .eq('id', id)
      .select('id, slug, title, excerpt, content, cover_image_url, status, featured, published_at, author_id, author_name, submitter_id, reviewed_at, reviewed_by, review_notes, created_at, updated_at')
      .single();

    if (error) throw error;
    return { post: data as CommunityBlogPost };
  } catch (error) {
    throw normalizeError(error, `Failed to ${decision} blog post`);
  }
}
