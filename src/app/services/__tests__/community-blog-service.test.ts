import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getCommunityBlogPostBySlug,
  listCommunityBlogPosts,
  reviewAdminCommunityBlogPost,
  submitCommunityBlogPost,
} from '../communityBlogService';

const getUserMock = vi.fn();
const fromMock = vi.fn();

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: (...args: unknown[]) => getUserMock(...args),
    },
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

describe('communityBlogService', () => {
  beforeEach(() => {
    getUserMock.mockReset();
    fromMock.mockReset();
  });

  it('loads public list from direct supabase query', async () => {
    const limitMock = vi.fn().mockResolvedValue({
      data: [{ id: 'post-1', slug: 'first-post', title: 'First post', content: 'Hello', status: 'published', featured: true, published_at: '2026-01-01T00:00:00.000Z', created_at: '2026-01-01T00:00:00.000Z' }],
      error: null,
    });

    const orderMock = vi.fn().mockReturnValue({ limit: limitMock });
    const lteMock = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ order: orderMock }), order: orderMock });
    const notMock = vi.fn().mockReturnValue({ lte: lteMock });
    const eqMock = vi.fn().mockReturnValue({ not: notMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });

    fromMock.mockReturnValue({ select: selectMock });

    const payload = await listCommunityBlogPosts({ limit: 12, featuredOnly: true });

    expect(fromMock).toHaveBeenCalledWith('community_blog_posts');
    expect(payload.count).toBe(1);
    expect(payload.featured.length).toBe(1);
  });

  it('rejects empty slug requests for detail endpoint', async () => {
    await expect(getCommunityBlogPostBySlug('')).rejects.toThrow('Blog slug is required');
  });

  it('submits seeker blog as pending review', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });

    fromMock.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { id: 'user-1', user_type: 'seeker', name: 'Seeker One' }, error: null }),
            }),
          }),
        };
      }

      if (table === 'community_blog_posts') {
        return {
          insert: () => ({
            select: () => ({
              single: async () => ({
                data: {
                  id: 'post-2',
                  slug: 'my-blog',
                  title: 'My Blog',
                  content: 'Hello world',
                  status: 'pending_review',
                  featured: false,
                  submitter_id: 'user-1',
                  created_at: '2026-04-28T00:00:00.000Z',
                },
                error: null,
              }),
            }),
          }),
        };
      }

      return {};
    });

    const payload = await submitCommunityBlogPost({
      title: 'My Blog',
      content: 'Hello world',
      excerpt: 'Short intro',
    });

    expect(payload.status).toBe('pending_review');
    expect(payload.submitter_id).toBe('user-1');
  });

  it('allows admin to approve pending blog', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null });

    fromMock.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { id: 'admin-1', user_type: 'admin' }, error: null }),
            }),
          }),
        };
      }

      if (table === 'community_blog_posts') {
        return {
          update: () => ({
            eq: () => ({
              select: () => ({
                single: async () => ({
                  data: {
                    id: 'post-3',
                    slug: 'pending-post',
                    title: 'Pending Post',
                    content: 'Pending body',
                    status: 'published',
                    published_at: '2026-04-28T00:00:00.000Z',
                    reviewed_by: 'admin-1',
                    created_at: '2026-04-28T00:00:00.000Z',
                  },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }

      return {};
    });

    const result = await reviewAdminCommunityBlogPost('post-3', 'approve', 'Approved for publication');

    expect(result.post.status).toBe('published');
    expect(result.post.reviewed_by).toBe('admin-1');
  });
});
