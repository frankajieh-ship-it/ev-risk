import Link from "next/link";

interface RelatedPost {
  slug: string;
  title: string;
  badge: string;
  badgeColor: string;
  excerpt?: string;
}

interface RelatedPostsProps {
  posts: RelatedPost[];
  heading?: string;
}

export default function RelatedPosts({ posts, heading = "Related reading" }: RelatedPostsProps) {
  if (!posts.length) return null;
  return (
    <section className="mt-12 pt-8 border-t border-white/[0.08]">
      <h2 className="text-lg font-bold text-white mb-4">{heading}</h2>
      <div className="grid sm:grid-cols-2 gap-4">
        {posts.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="block rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] p-4 transition-colors group"
          >
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${post.badgeColor} mb-2 inline-block`}>
              {post.badge}
            </span>
            <p className="text-sm font-semibold text-white group-hover:text-[#00d97e] transition-colors leading-snug">
              {post.title}
            </p>
            {post.excerpt && (
              <p className="text-xs text-white/40 mt-1 leading-relaxed line-clamp-2">{post.excerpt}</p>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
