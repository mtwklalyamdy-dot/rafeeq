"use client";

import { useEffect, useState } from "react";
import { Empty, ErrorBox, PageTitle } from "@/components/academic-clients";

type Course = { id: string; name: string; nameEn: string | null; code: string; description: string | null; creditHours: number; canPublishDirectly: boolean };
type Content = { id: string; courseId: string; title: string; description: string | null; body: string | null; kind: string; status: string; version: number; courseName: string };
type Assignment = { id: string; courseId: string; title: string; description: string; status: string; dueAt: string; maxScore: string; courseName: string };
type Exam = { id: string; courseId: string; title: string; instructions: string | null; durationMinutes: number; startsAt: string | null; endsAt: string | null; isPublished: boolean; courseName: string };
type Announcement = { id: string; title: string; body: string; isPublished: boolean };
type Data = { courses: Course[]; contents: Content[]; assignments: Assignment[]; exams: Exam[]; announcements: Announcement[] };
type Tab = "course" | "content" | "assignment" | "exam" | "announcement" | "reminder" | "manage";
type DraftQuestion = { type: "multiple_choice" | "true_false" | "text" | "numeric"; prompt: string; optionsText: string; correctAnswer: string; points: number };

export function RepresentativeClient() {
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<Tab>("content");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [contentFileId, setContentFileId] = useState("");
  const [assignmentFileId, setAssignmentFileId] = useState("");
  const [questions, setQuestions] = useState<DraftQuestion[]>([{ type: "multiple_choice", prompt: "", optionsText: "", correctAnswer: "", points: 1 }]);

  async function load() {
    const response = await fetch("/api/representative", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "تعذر تحميل لوحة المندوب");
    setData(payload);
    if (!payload.courses.length) setTab("course");
  }
  useEffect(() => { load().catch((cause) => setError(cause.message)); }, []);

  async function upload(file: File, target: "content" | "assignment") {
    setBusy(true); setError(""); const form = new FormData(); form.set("file", file);
    try {
      const response = await fetch("/api/files", { method: "POST", body: form }); const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      if (target === "content") setContentFileId(payload.file.id); else setAssignmentFileId(payload.file.id);
      setMessage(`تم رفع ${payload.file.originalName} بأمان. أكمل بيانات النشر.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر رفع الملف"); } finally { setBusy(false); }
  }

  async function publish(body: Record<string, unknown>, success?: string) {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/representative/publish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "تعذر النشر");
      setMessage(success || payload.message); setContentFileId(""); setAssignmentFileId(""); await load(); return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر النشر"); return false; } finally { setBusy(false); }
  }

  async function edit(body: Record<string, unknown>) {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/representative/manage", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "تعذر التعديل");
      setMessage(payload.message); await load(); return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر التعديل"); return false; } finally { setBusy(false); }
  }

  const submit = (type: string, extra: Record<string, unknown> = {}) => async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget); const done = await publish({ type, ...Object.fromEntries(form), ...extra }); if (done) event.currentTarget.reset();
  };

  return <>
    <PageTitle title="لوحة المندوب الطلابي" description="أنشئ المواد وانشر المحاضرات والملخصات والكتب والواجبات والاختبارات والإعلانات للطلاب المستهدفين." />
    {error && <ErrorBox text={error} />}
    {message && <div className="mb-5 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">{message}</div>}
    <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
      <TabButton active={tab === "course"} onClick={() => setTab("course")}>المواد</TabButton>
      <TabButton active={tab === "content"} onClick={() => setTab("content")}>المحتوى والكتب</TabButton>
      <TabButton active={tab === "assignment"} onClick={() => setTab("assignment")}>الواجبات</TabButton>
      <TabButton active={tab === "exam"} onClick={() => setTab("exam")}>الاختبارات</TabButton>
      <TabButton active={tab === "announcement"} onClick={() => setTab("announcement")}>الإعلانات</TabButton>
      <TabButton active={tab === "reminder"} onClick={() => setTab("reminder")}>تنبيه محاضرة</TabButton>
      <TabButton active={tab === "manage"} onClick={() => setTab("manage")}>إدارة منشوراتي</TabButton>
    </div>

    {tab === "course" && <form onSubmit={submit("course")} className="card mx-auto grid max-w-2xl gap-4 p-5"><h2 className="text-lg font-bold">إضافة مادة دراسية</h2><p className="text-muted text-sm">سترتبط المادة تلقائيًا بمستواك وتخصصك، وتُسند إلى حسابك بصلاحية النشر.</p><Field label="اسم المادة"><input className="input" name="nameAr" required minLength={3} /></Field><Field label="اسمها بالإنجليزية (اختياري)"><input className="input" name="nameEn" dir="ltr" /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="رمز المادة"><input className="input" name="code" pattern="[A-Za-z0-9_-]{2,40}" required dir="ltr" placeholder="ACC101" /></Field><Field label="الساعات المعتمدة"><input className="input" name="creditHours" type="number" min="0" max="12" defaultValue="3" /></Field></div><Field label="وصف المادة"><textarea className="input min-h-28" name="description" /></Field><button disabled={busy} className="btn-primary">إنشاء المادة</button></form>}

    {tab === "content" && <RequireCourse data={data}><form onSubmit={submit("content", { fileId: contentFileId || undefined, allowDownload: true })} className="card mx-auto grid max-w-2xl gap-4 p-5"><h2 className="text-lg font-bold">نشر محاضرة أو ملخص أو كتاب</h2><CourseSelect courses={data?.courses || []} /><Field label="نوع المحتوى"><select className="input" name="kind" required><option value="lecture">محاضرة</option><option value="summary">ملخص</option><option value="book">كتاب PDF</option><option value="reference">مرجع PDF</option><option value="exam_model">نموذج اختبار PDF</option><option value="text">مادة نصية</option></select></Field><Field label="العنوان"><input className="input" name="title" required /></Field><Field label="الوصف"><textarea className="input" name="description" /></Field><Field label="النص (بديل عن الملف)"><textarea className="input min-h-28" name="body" /></Field><Field label="ملف PDF أو ملف مدعوم"><input className="input" type="file" accept="application/pdf,text/plain,image/png,image/jpeg" onChange={(event) => event.target.files?.[0] && upload(event.target.files[0], "content")} /></Field>{contentFileId && <span className="badge">تم رفع الملف وجاهز للنشر</span>}<button disabled={busy} className="btn-primary">نشر المحتوى</button></form></RequireCourse>}

    {tab === "assignment" && <RequireCourse data={data}><form onSubmit={submit("assignment", { fileId: assignmentFileId || undefined })} className="card mx-auto grid max-w-2xl gap-4 p-5"><h2 className="text-lg font-bold">نشر واجب أو تكليف</h2><CourseSelect courses={data?.courses || []} /><Field label="عنوان الواجب"><input className="input" name="title" required /></Field><Field label="التعليمات"><textarea className="input min-h-28" name="description" required /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="الموعد النهائي"><input className="input" name="dueAt" type="datetime-local" required /></Field><Field label="الدرجة القصوى"><input className="input" name="maxScore" type="number" min="1" defaultValue="100" /></Field></div><Field label="ملف التكليف PDF"><input className="input" type="file" accept="application/pdf" onChange={(event) => event.target.files?.[0] && upload(event.target.files[0], "assignment")} /></Field>{assignmentFileId && <span className="badge">تم رفع ملف التكليف</span>}<button disabled={busy} className="btn-primary">نشر الواجب</button></form></RequireCourse>}

    {tab === "exam" && <RequireCourse data={data}><form onSubmit={submit("exam", { questions: questions.map((question) => ({ ...question, options: question.type === "multiple_choice" ? question.optionsText.split("\n").map((value) => value.trim()).filter(Boolean) : undefined })) })} className="space-y-4"><div className="card grid gap-4 p-5"><h2 className="text-lg font-bold">إنشاء اختبار إلكتروني</h2><CourseSelect courses={data?.courses || []} /><Field label="عنوان الاختبار"><input className="input" name="title" required /></Field><Field label="التعليمات"><textarea className="input" name="instructions" /></Field><div className="grid gap-4 md:grid-cols-3"><Field label="المدة بالدقائق"><input className="input" name="durationMinutes" type="number" min="1" max="300" defaultValue="30" required /></Field><Field label="يبدأ في"><input className="input" name="startsAt" type="datetime-local" /></Field><Field label="ينتهي في"><input className="input" name="endsAt" type="datetime-local" /></Field></div><label className="soft-card flex items-center gap-3 p-3"><input type="checkbox" name="showCorrectAnswers" /><span>عرض الإجابات الصحيحة بعد التسليم</span></label></div>{questions.map((question, index) => <QuestionEditor key={index} index={index} question={question} update={(next) => setQuestions((items) => items.map((item, itemIndex) => itemIndex === index ? next : item))} remove={() => setQuestions((items) => items.filter((_, itemIndex) => itemIndex !== index))} />)}<div className="flex gap-2"><button type="button" className="btn-secondary" onClick={() => setQuestions((items) => [...items, { type: "multiple_choice", prompt: "", optionsText: "", correctAnswer: "", points: 1 }])}>+ إضافة سؤال</button><button disabled={busy || !questions.length} className="btn-primary flex-1">نشر الاختبار</button></div></form></RequireCourse>}

    {tab === "announcement" && <RequireCourse data={data}><form onSubmit={submit("announcement")} className="card mx-auto grid max-w-2xl gap-4 p-5"><h2 className="text-lg font-bold">إعلان أكاديمي</h2><CourseSelect courses={data?.courses || []} /><Field label="عنوان الإعلان"><input className="input" name="title" required /></Field><Field label="محتوى الإعلان"><textarea className="input min-h-36" name="description" required /></Field><button disabled={busy} className="btn-primary">نشر الإعلان وإشعار الطلاب</button></form></RequireCourse>}

    {tab === "reminder" && <RequireCourse data={data}><form onSubmit={submit("reminder")} className="card mx-auto grid max-w-2xl gap-4 p-5"><h2 className="text-lg font-bold">تنبيه بمحاضرة قادمة</h2><p className="text-muted text-sm">مثال: اختر موعد الغد، وسيظهر التنبيه للطلاب المستهدفين داخل التطبيق.</p><CourseSelect courses={data?.courses || []} /><Field label="عنوان المحاضرة"><input className="input" name="title" required /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="الموعد"><input className="input" name="startsAt" type="datetime-local" required /></Field><Field label="القاعة"><input className="input" name="room" /></Field></div><Field label="تفاصيل إضافية"><textarea className="input" name="description" /></Field><button disabled={busy} className="btn-primary">إرسال تنبيه المحاضرة</button></form></RequireCourse>}

    {tab === "manage" && <ManagePublications data={data} busy={busy} edit={edit} />}
  </>;
}

function ManagePublications({ data, busy, edit }: { data: Data | null; busy: boolean; edit: (body: Record<string, unknown>) => Promise<boolean> }) {
  if (!data) return <div className="skeleton h-72" />;
  if (!data.courses.length && !data.contents.length && !data.assignments.length && !data.exams.length && !data.announcements.length) return <Empty text="لم تنشر أو تنشئ شيئًا بعد." />;
  return <div className="space-y-6"><ManageSection title="المواد">{data.courses.map((course) => <EditCard key={course.id} title={`${course.name} — ${course.code}`} status={course.canPublishDirectly ? "نشر مباشر" : "مراجعة"}><form onSubmit={async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); await edit({ resourceType: "course", resourceId: course.id, ...Object.fromEntries(form) }); }} className="grid gap-3"><input className="input" name="nameAr" defaultValue={course.name} required /><input className="input" name="nameEn" defaultValue={course.nameEn || ""} dir="ltr" /><textarea className="input" name="description" defaultValue={course.description || ""} /><input className="input" name="creditHours" type="number" min="0" max="12" defaultValue={course.creditHours} /><button disabled={busy} className="btn-primary">حفظ المادة</button></form></EditCard>)}</ManageSection><ManageSection title="المحتوى والكتب">{data.contents.map((content) => <EditCard key={content.id} title={content.title} status={`${kindLabel(content.kind)} · ${content.status}`}><form onSubmit={async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); await edit({ resourceType: "content", resourceId: content.id, ...Object.fromEntries(form), allowDownload: true }); }} className="grid gap-3"><input className="input" name="title" defaultValue={content.title} required /><select className="input" name="kind" defaultValue={content.kind}><option value="lecture">محاضرة</option><option value="summary">ملخص</option><option value="book">كتاب</option><option value="reference">مرجع</option><option value="exam_model">نموذج اختبار</option><option value="text">نص</option></select><textarea className="input" name="description" defaultValue={content.description || ""} /><textarea className="input" name="body" defaultValue={content.body || ""} /><button disabled={busy} className="btn-primary">حفظ المحتوى</button></form></EditCard>)}</ManageSection><ManageSection title="الواجبات">{data.assignments.map((assignment) => <EditCard key={assignment.id} title={assignment.title} status={assignment.status}><form onSubmit={async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); await edit({ resourceType: "assignment", resourceId: assignment.id, ...Object.fromEntries(form) }); }} className="grid gap-3"><input className="input" name="title" defaultValue={assignment.title} required /><textarea className="input" name="description" defaultValue={assignment.description} /><input className="input" name="dueAt" type="datetime-local" defaultValue={toLocalInput(assignment.dueAt)} /><input className="input" name="maxScore" type="number" defaultValue={assignment.maxScore} /><button disabled={busy} className="btn-primary">حفظ الواجب</button></form></EditCard>)}</ManageSection><ManageSection title="الاختبارات">{data.exams.map((exam) => <EditCard key={exam.id} title={exam.title} status={exam.isPublished ? "منشور" : "مسودة"}><form onSubmit={async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); await edit({ resourceType: "exam", resourceId: exam.id, ...Object.fromEntries(form), showCorrectAnswers: form.get("showCorrectAnswers") === "on" }); }} className="grid gap-3"><input className="input" name="title" defaultValue={exam.title} required /><textarea className="input" name="instructions" defaultValue={exam.instructions || ""} /><input className="input" name="durationMinutes" type="number" defaultValue={exam.durationMinutes} /><input className="input" name="startsAt" type="datetime-local" defaultValue={toLocalInput(exam.startsAt)} /><input className="input" name="endsAt" type="datetime-local" defaultValue={toLocalInput(exam.endsAt)} /><label><input type="checkbox" name="showCorrectAnswers" /> عرض الإجابات</label><button disabled={busy} className="btn-primary">حفظ الاختبار</button></form></EditCard>)}</ManageSection><ManageSection title="الإعلانات">{data.announcements.map((announcement) => <EditCard key={announcement.id} title={announcement.title} status={announcement.isPublished ? "منشور" : "مسودة"}><form onSubmit={async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); await edit({ resourceType: "announcement", resourceId: announcement.id, ...Object.fromEntries(form) }); }} className="grid gap-3"><input className="input" name="title" defaultValue={announcement.title} required /><textarea className="input" name="body" defaultValue={announcement.body} /><button disabled={busy} className="btn-primary">حفظ الإعلان</button></form></EditCard>)}</ManageSection></div>;
}

function QuestionEditor({ index, question, update, remove }: { index: number; question: DraftQuestion; update: (question: DraftQuestion) => void; remove: () => void }) {
  return <article className="card grid gap-3 p-5"><div className="flex items-center justify-between"><h3 className="font-bold">السؤال {index + 1}</h3><button type="button" onClick={remove} className="text-sm text-red-600">حذف السؤال</button></div><select className="input" value={question.type} onChange={(event) => update({ ...question, type: event.target.value as DraftQuestion["type"], optionsText: "", correctAnswer: "" })}><option value="multiple_choice">اختيار من متعدد</option><option value="true_false">صح وخطأ</option><option value="numeric">إجابة رقمية</option><option value="text">إجابة نصية (مراجعة يدوية)</option></select><textarea className="input" value={question.prompt} onChange={(event) => update({ ...question, prompt: event.target.value })} placeholder="نص السؤال" required />{question.type === "multiple_choice" && <textarea className="input min-h-24" value={question.optionsText} onChange={(event) => update({ ...question, optionsText: event.target.value })} placeholder="اكتب كل خيار في سطر مستقل" required />}{question.type === "true_false" ? <select className="input" value={question.correctAnswer} onChange={(event) => update({ ...question, correctAnswer: event.target.value })} required><option value="">الإجابة الصحيحة</option><option value="صح">صح</option><option value="خطأ">خطأ</option></select> : <input className="input" value={question.correctAnswer} onChange={(event) => update({ ...question, correctAnswer: event.target.value })} placeholder={question.type === "multiple_choice" ? "اكتب الخيار الصحيح كما هو" : "الإجابة الصحيحة"} required={question.type !== "text"} />}<input className="input" type="number" min="0.25" step="0.25" value={question.points} onChange={(event) => update({ ...question, points: Number(event.target.value) })} aria-label="درجة السؤال" /></article>;
}

function RequireCourse({ data, children }: { data: Data | null; children: React.ReactNode }) { if (!data) return <div className="skeleton h-72" />; if (!data.courses.length) return <Empty text="أنشئ مادة من تبويب «المواد» أولًا، أو اطلب من الإدارة إسناد مادة موجودة إلى حسابك." />; return children; }
function CourseSelect({ courses }: { courses: Course[] }) { return <Field label="المادة"><select className="input" name="courseId" required><option value="">اختر المادة</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.name} — {course.code}{course.canPublishDirectly ? "" : " (يحتاج مراجعة)"}</option>)}</select></Field>; }
function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button onClick={onClick} className={active ? "btn-primary whitespace-nowrap" : "btn-secondary whitespace-nowrap"}>{children}</button>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label><span className="label">{label}</span>{children}</label>; }
function ManageSection({ title, children }: { title: string; children: React.ReactNode }) { return <section><h2 className="mb-3 text-lg font-bold">{title}</h2><div className="grid gap-3 md:grid-cols-2">{children}</div></section>; }
function EditCard({ title, status, children }: { title: string; status: string; children: React.ReactNode }) { const [open, setOpen] = useState(false); return <article className="card p-4"><button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between text-right"><span><strong className="block">{title}</strong><small className="text-muted">{status}</small></span><span>{open ? "⌃" : "⌄"}</span></button>{open && <div className="mt-4 border-t border-app pt-4">{children}</div>}</article>; }
function kindLabel(kind: string) { return ({ lecture: "محاضرة", summary: "ملخص", book: "كتاب", reference: "مرجع", exam_model: "نموذج اختبار", text: "نص" } as Record<string, string>)[kind] || kind; }
function toLocalInput(value: string | null) { if (!value) return ""; const date = new Date(value); const offset = date.getTimezoneOffset() * 60000; return new Date(date.getTime() - offset).toISOString().slice(0, 16); }
