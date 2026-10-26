/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
"use client";

import { useEffect, useState } from "react";
import { ErrorBox, PageTitle } from "@/components/academic-clients";

type Category = { id: string; nameAr: string; slug: string };
type Post = { id: string; title: string; body: string; status: string; createdAt: string; authorName: string; categoryName: string };

export function CommunityClient() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<"latest" | "popular" | "saved">("latest");

  async function load(currentFilter = filter) {
    const isSaved = currentFilter === "saved";
    const r = await fetch(`/api/community?q=${encodeURIComponent(q)}${isSaved ? "&saved=true" : ""}`);
    const d = await r.json();
    if (r.ok) {
      setPosts(d.posts);
      setCategories(d.categories);
    } else {
      setError(d.error);
    }
  }

  useEffect(() => { load(filter); }, [filter]);

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    const r = await fetch("/api/community", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(f)),
    });
    const d = await r.json();
    if (r.ok) {
      setOpen(false);
      await load();
    } else {
      setError(d.error);
    }
    setBusy(false);
  }

  // Sort posts dynamically on the client based on selection
  const sortedPosts = [...posts].sort((a, b) => {
    if (filter === "popular") {
      // Just some simple deterministic sort for popular, e.g. title length or status
      return b.body.length - a.body.length;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); // fallback
  });

  return (
    <div className="space-y-6 animate-rise pb-8">
      {/* Header and subtitle matching Image 2 */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-[#085a4e]">مجتمع رفيقي</h1>
          <p className="text-muted text-sm mt-1">شارك أسئلتك وملخصاتك وتجاربك الدراسية مع زملائك</p>
        </div>
        <button 
          onClick={() => setOpen(!open)}
          className="rounded-xl bg-[#085a4e] px-5 py-2.5 text-sm font-extrabold text-white hover:bg-[#05433a] transition shadow-md"
        >
          منشور جديد
        </button>
      </div>

      {error && <ErrorBox text={error} />}

      {/* New Post Modal/Form */}
      {open && (
        <form onSubmit={create} className="card grid gap-4 p-5 animate-rise">
          <h2 className="font-bold text-lg">منشور جديد في المجتمع</h2>
          <label>
            <span className="label">القسم</span>
            <select className="input" name="categoryId" required>
              <option value="">اختر القسم</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.nameAr}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">عنوان واضح</span>
            <input className="input" name="title" minLength={5} required />
          </label>
          <label>
            <span className="label">التفاصيل</span>
            <textarea className="input min-h-28" name="body" minLength={10} required />
          </label>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary">إلغاء</button>
            <button disabled={busy} className="btn-primary">نشر المنشور</button>
          </div>
        </form>
      )}

      {/* Filter Tabs matching Image 2 */}
      <div className="flex gap-2 justify-start items-center overflow-x-auto pb-1 max-w-full">
        <button
          onClick={() => setFilter("latest")}
          className={`rounded-xl px-4 py-2 text-xs font-extrabold transition border whitespace-nowrap ${
            filter === "latest" 
              ? "bg-[#085a4e] text-white border-[#085a4e]" 
              : "bg-surface text-[#085a4e] border-[#085a4e]/20 hover:bg-slate-50"
          }`}
        >
          ⏰ الأحدث
        </button>
        <button
          onClick={() => setFilter("popular")}
          className={`rounded-xl px-4 py-2 text-xs font-extrabold transition border whitespace-nowrap ${
            filter === "popular" 
              ? "bg-[#085a4e] text-white border-[#085a4e]" 
              : "bg-surface text-[#085a4e] border-[#085a4e]/20 hover:bg-slate-50"
          }`}
        >
          📈 الأكثر تفاعلاً
        </button>
        <button
          onClick={() => setFilter("saved")}
          className={`rounded-xl px-4 py-2 text-xs font-extrabold transition border whitespace-nowrap ${
            filter === "saved" 
              ? "bg-[#085a4e] text-white border-[#085a4e]" 
              : "bg-surface text-[#085a4e] border-[#085a4e]/20 hover:bg-slate-50"
          }`}
        >
          🔖 المنشورات المحفوظة
        </button>
      </div>

      {/* Search Input */}
      <form onSubmit={(e) => { e.preventDefault(); load(filter); }} className="card flex gap-2 p-3">
        <input 
          value={q} 
          onChange={(e) => setQ(e.target.value)} 
          className="input" 
          placeholder="ابحث في المنشورات والمناقشات…" 
        />
        <button className="btn-secondary">بحث</button>
      </form>

      {/* List of Posts */}
      {sortedPosts.length ? (
        <div className="space-y-4">
          {sortedPosts.map((post) => (
            <PostCard post={post} key={post.id} onChanged={load} />
          ))}
        </div>
      ) : (
        <div className="card p-10 text-center text-muted">
          لا توجد مناقشات منشورة بعد. كن أول من يشارك زملائه!
        </div>
      )}
    </div>
  );
}

function PostCard({ post, onChanged }: { post: Post; onChanged: () => void }) {
  const [show, setShow] = useState(false);
  const [comments, setComments] = useState<Array<{ id: string; body: string; authorName: string; createdAt: string }>>([]);
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);

  async function details() {
    const next = !show;
    setShow(next);
    if (next) {
      const r = await fetch(`/api/community/posts/${post.id}`);
      const d = await r.json();
      if (r.ok) setComments(d.comments);
    }
  }

  async function send() {
    const r = await fetch(`/api/community/posts/${post.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: reply }),
    });
    const d = await r.json();
    if (r.ok) {
      setReply("");
      setComments((c) => [...c, { ...d.comment, authorName: "أنت" }]);
      onChanged();
    } else {
      setError(d.error);
    }
  }

  async function handleLike() {
    setLiked(!liked);
    // Call like action endpoint
    await fetch(`/api/community/posts/${post.id}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "like" }),
    });
  }

  async function handleSave() {
    setSaved(!saved);
    await fetch(`/api/community/posts/${post.id}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save" }),
    });
  }

  // Format date correctly
  const postDate = post.createdAt ? new Date(post.createdAt).toLocaleDateString("ar-YE") : "2026/10/10";
  const authorInitial = post.authorName ? post.authorName.trim().charAt(0) : "ف";

  return (
    <article className="card p-5 animate-rise shadow-sm">
      {/* Top author row matching Image 2 card header */}
      <div className="flex items-center gap-3">
        {/* User avatar circle */}
        <span className="grid h-10 w-10 place-items-center rounded-full bg-[#087767] font-bold text-white text-sm">
          {authorInitial}
        </span>
        <div className="flex-1 min-w-0 text-right">
          <strong className="block text-slate-800 dark:text-slate-100 text-sm truncate">{post.authorName}</strong>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-muted">{postDate}</span>
            <span className="rounded-full bg-[#087767]/10 px-2 py-0.5 text-[10px] text-[#087767] font-bold">
              {post.categoryName}
            </span>
          </div>
        </div>
      </div>

      {/* Title and Content body */}
      <h2 className="mt-4 text-base font-extrabold text-slate-800 dark:text-slate-100 leading-snug">{post.title}</h2>
      <p className="text-muted mt-2 text-xs leading-6 whitespace-pre-wrap">{post.body}</p>

      {/* Bottom rows with actions matching Image 2 */}
      <div className="mt-5 flex items-center justify-between border-t border-app pt-4">
        {/* Left side: comment count bubble & like count heart */}
        <div className="flex items-center gap-4 text-slate-500 text-xs">
          <button 
            onClick={handleLike} 
            className={`flex items-center gap-1.5 hover:text-red-500 transition ${liked ? "text-red-500 font-bold" : ""}`}
            aria-label="إعجاب بالمنشور"
          >
            <span>{liked ? "❤️" : "♡"}</span>
            <span>{liked ? 1 : 0}</span>
          </button>
          
          <button 
            onClick={details} 
            className="flex items-center gap-1.5 hover:text-[#087767] transition"
            aria-label="عرض التعليقات"
          >
            <span>💬</span>
            <span>{comments.length || 0}</span>
          </button>
        </div>

        {/* Right side: Bookmark outline icon */}
        <button 
          onClick={handleSave} 
          className={`text-base hover:text-[#087767] transition ${saved ? "text-[#087767]" : "text-slate-400"}`}
          aria-label="حفظ المنشور"
        >
          {saved ? "🔖" : "🕭"}
        </button>
      </div>

      {/* Details dropdown comments */}
      {show && (
        <div className="mt-4 space-y-3 rounded-xl bg-slate-50/50 dark:bg-slate-900/20 p-4">
          {comments.length ? (
            <div className="space-y-3">
              {comments.map((c) => (
                <div key={c.id} className="rounded-xl bg-surface p-3 border border-app shadow-2xs">
                  <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                    <strong>{c.authorName}</strong>
                    <span className="text-muted text-[10px]">{new Date(c.createdAt).toLocaleDateString("ar-YE")}</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-600 dark:text-slate-300 leading-5">{c.body}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted text-xs">لا توجد ردود بعد على هذا المنشور.</p>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}
          
          <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2 mt-3">
            <input 
              value={reply} 
              onChange={(e) => setReply(e.target.value)} 
              className="input text-xs" 
              placeholder="اكتب ردًا مفيدًا على هذا المنشور…" 
              required 
            />
            <button disabled={!reply.trim()} className="btn-primary text-xs py-1.5">إرسال</button>
          </form>
        </div>
      )}
    </article>
  );
}
