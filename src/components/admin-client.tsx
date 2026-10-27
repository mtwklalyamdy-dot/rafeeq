/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
"use client";

import { useEffect, useMemo, useState } from "react";
import { Empty, ErrorBox, PageTitle } from "@/components/academic-clients";
import { AdminAccessClient } from "@/components/admin-access-client";
import { AdminContentClient } from "@/components/admin-content-client";
import { AdminNavigationClient } from "@/components/admin-navigation-client";

type Role = "student" | "representative" | "support" | "admin";
type UserRow = {
  id: string; fullName: string; email: string; role: Role; isActive: boolean; emailVerifiedAt: string | null; createdAt: string;
  university: string | null; studentNumber: string | null; groupName: string | null;
  collegeId: string | null; collegeName: string | null; departmentId: string | null; departmentName: string | null;
  levelId: string | null; levelName: string | null; semesterId: string | null; semesterName: string | null;
  representativeStatus: string | null;
};
type Ticket = { id: string; userId: string; userName: string; userEmail: string; type: string; subject: string; description: string; status: string; createdAt: string; updatedAt: string; conversationId: string | null };
type Option = { id: string; name: string; code?: string; university?: string; collegeId?: string; academicYear?: string };
type DbTableInfo = { table_name: string; row_count: number; canDelete: boolean };
type DbColumnInfo = { table_name: string; column_name: string; data_type: string; is_nullable: string };
type BackupInfo = { name: string; size: number; createdAt: string };

type AdminData = {
  counts: Record<string, number>;
  pendingRepresentatives: UserRow[];
  managers: Array<UserRow & { protectedByEnvironment: boolean }>;
  supportStaff: Array<{ id: string; fullName: string; email: string; isActive: boolean; isAvailable: boolean; lastSeenAt: string | null }>;
  users: UserRow[];
  tickets: Ticket[];
  content: Array<{ id: string; courseId: string; courseName: string; title: string; kind: string; status: string; updatedAt: string }>;
  assignments: Array<{ id: string; courseId: string; courseName: string; title: string; status: string; dueAt: string; updatedAt: string }>;
  exams: Array<{ id: string; courseId: string; courseName: string; title: string; isPublished: boolean; startsAt: string | null; endsAt: string | null }>;
  posts: Array<{ id: string; title: string; status: string; authorName: string; categoryName: string; createdAt: string }>;
  comments: Array<{ id: string; postId: string; authorName: string; body: string; isHidden: boolean; createdAt: string }>;
  announcements: Array<{ id: string; title: string; body: string; isPublished: boolean; updatedAt: string }>;
  auditLogs: Array<{ id: string; actorId: string | null; action: string; entityType: string; entityId: string | null; createdAt: string }>;
  settings: Record<string, unknown>;
  options: { colleges: Option[]; departments: Option[]; levels: Option[]; semesters: Option[]; courses: Array<{ id: string; name: string; code: string }> };
  representativeAssignments: Array<{ representativeId: string; courseId: string; canPublishDirectly: boolean }>;
  dbStats?: {
    tables: DbTableInfo[];
    columns: DbColumnInfo[];
    backups: BackupInfo[];
  };
};
type Tab = "representatives" | "users" | "managers" | "support" | "content" | "audit" | "database" | "settings";

export function AdminClient() {
  const [data, setData] = useState<AdminData | null>(null);
  const [tab, setTab] = useState<Tab>("representatives");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");

  // DB Browser state
  const [browsingTable, setBrowsingTable] = useState("");
  const [browsingRows, setBrowsingRows] = useState<any[]>([]);
  const [dbSearch, setDbSearch] = useState("");
  const [loadingRows, setLoadingRows] = useState(false);

  async function load() {
    const response = await fetch("/api/admin", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "تعذر تحميل لوحة الإدارة");
    setData(payload);
  }

  useEffect(() => { load().catch((cause) => setError(cause.message)); }, []);

  // Fetch browsing rows when browsingTable changes
  useEffect(() => {
    if (!browsingTable) {
      setBrowsingRows([]);
      return;
    }
    setLoadingRows(true);
    fetch(`/api/admin?table=${browsingTable}`)
      .then(async (r) => {
        const d = await r.json();
        if (r.ok) setBrowsingRows(d.rows || []);
        else setError(d.error || "تعذر تحميل سجلات الجدول");
      })
      .catch(() => setError("تعذر الاتصال بالخادم لتحميل السجلات"))
      .finally(() => setLoadingRows(false));
  }, [browsingTable]);

  async function action(body: Record<string, unknown>, success = "تم تنفيذ العملية وتسجيلها.") {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/resources", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "تعذر تنفيذ العملية");
      setMessage(success);
      await load();
      
      // Refresh active browsing table rows if we just deleted a row in the database
      if (body.action === "database.deleteRow" && browsingTable === body.table) {
        setBrowsingTable(""); // trigger reload
        setTimeout(() => setBrowsingTable(String(body.table)), 100);
      }
      return payload;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تنفيذ العملية");
      return null;
    } finally { setBusy(false); }
  }

  async function syncTelegram() {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/resources", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "app.syncTelegram" })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "تعذر التزامن");
      setMessage(payload.result?.message || "تمت المزامنة بنجاح.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "فشلت المزامنة");
    } finally {
      setBusy(false);
    }
  }

  const filteredUsers = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return data?.users || [];
    return (data?.users || []).filter((user) => `${user.fullName} ${user.email} ${user.studentNumber || ""}`.toLowerCase().includes(value));
  }, [data, query]);

  // Filter columns belonging to the currently selected database table
  const currentTableColumns = useMemo(() => {
    if (!browsingTable || !data?.dbStats?.columns) return [];
    return data.dbStats.columns.filter((col) => col.table_name === browsingTable);
  }, [browsingTable, data]);

  // Search filter over currently loaded browsingRows
  const filteredDbRows = useMemo(() => {
    const s = dbSearch.trim().toLowerCase();
    if (!s) return browsingRows;
    return browsingRows.filter((row) => 
      Object.values(row).some((val) => String(val || "").toLowerCase().includes(s))
    );
  }, [browsingRows, dbSearch]);

  return <>
    <PageTitle title="لوحة الإدارة العامة" description="اعتماد المندوبين، إدارة حسابات الطلاب، وتصفح وإدارة قاعدة البيانات وتراسل الدعم الفني." />
    {error && <ErrorBox text={error} />}
    {message && <div className="mb-5 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">{message}</div>}
    {data ? <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Object.entries(data.counts).map(([key, value]) => <div className="card p-4" key={key}><small className="text-muted">{countLabels[key] || key}</small><strong className="text-brand mt-2 block text-3xl">{value}</strong></div>)}
      </div>
      <div className="mt-6 flex gap-2 overflow-x-auto pb-2 border-b border-app">
        <TabButton active={tab === "representatives"} onClick={() => setTab("representatives")}>المندوبون ({data.pendingRepresentatives.length})</TabButton>
        <TabButton active={tab === "users"} onClick={() => setTab("users")}>الحسابات ({data.users.length})</TabButton>
        <TabButton active={tab === "managers"} onClick={() => setTab("managers")}>المديرون وموظفو الدعم</TabButton>
        <TabButton active={tab === "support"} onClick={() => setTab("support")}>الدعم ({data.tickets.length})</TabButton>
        <TabButton active={tab === "content"} onClick={() => setTab("content")}>إدارة المحتوى</TabButton>
        <TabButton active={tab === "audit"} onClick={() => setTab("audit")}>سجل العمليات</TabButton>
        <TabButton active={tab === "database"} onClick={() => setTab("database")}>🖳 قاعدة البيانات</TabButton>
        <TabButton active={tab === "settings"} onClick={() => setTab("settings")}>إعدادات المحتوى</TabButton>
      </div>

      {tab === "representatives" && <section className="mt-4 animate-rise">
        <h2 className="mb-4 text-xl font-bold">طلبات اعتماد المندوبين</h2>
        {data.pendingRepresentatives.length ? <div className="grid gap-4 md:grid-cols-2">{data.pendingRepresentatives.map((representative) => <article className="card p-5" key={representative.id}>
          <span className="badge">بانتظار الاعتماد</span><h3 className="mt-4 text-lg font-bold">{representative.fullName}</h3><p className="text-muted mt-1 text-sm" dir="ltr">{representative.email}</p>
          <div className="text-muted mt-4 grid grid-cols-2 gap-2 text-xs"><span>{representative.levelName || "دون مستوى"}</span><span>{representative.departmentName || "دون تخصص"}</span><span>{representative.groupName || "دون شعبة"}</span><span>{representative.collegeName || "دون كلية"}</span></div>
          <div className="mt-5 flex gap-2"><button disabled={busy} className="btn-primary" onClick={() => action({ action: "representative.approve", userId: representative.id }, "تم اعتماد المندوب ويمكنه تسجيل الدخول الآن.")}>اعتماد المندوب</button><button disabled={busy} className="btn-secondary text-red-600" onClick={() => action({ action: "representative.suspend", userId: representative.id }, "تم إيقاف طلب المندوب.")}>إيقاف</button></div>
        </article>)}</div> : <Empty text="لا توجد طلبات مندوبين معلقة حاليًا." />}
      </section>}

      {tab === "users" && <section className="mt-4 animate-rise">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">إدارة حسابات المستخدمين</h2><input className="input max-w-sm" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث بالاسم أو البريد أو الرقم الجامعي…" /></div>
        <div className="space-y-4">{filteredUsers.map((user) => <UserEditor key={user.id} user={user} options={data.options} assignments={data.representativeAssignments} busy={busy} action={action} />)}</div>
      </section>}

      {tab === "managers" && <section className="mt-4 animate-rise"><AdminAccessClient busy={busy} action={action} /></section>}

      {tab === "support" && <section className="mt-4 animate-rise">
        <h2 className="mb-4 text-xl font-bold">تذاكر وطلبات الطلاب</h2>
        {data.tickets.length ? <div className="space-y-4">{data.tickets.map((ticket) => <TicketEditor key={ticket.id} ticket={ticket} busy={busy} action={action} />)}</div> : <Empty text="لا توجد تذاكر دعم حتى الآن." />}
      </section>}

      {tab === "content" && <div className="mt-4"><AdminContentClient data={data} busy={busy} action={action} /></div>}

      {tab === "audit" && <section className="card mt-4 p-5 animate-rise"><h2 className="mb-4 text-lg font-extrabold">سجل العمليات الإدارية</h2>{data.auditLogs.length ? <div className="max-h-[40rem] space-y-2 overflow-y-auto">{data.auditLogs.map((entry) => <article key={entry.id} className="soft-card flex flex-wrap items-center justify-between gap-2 p-3 text-xs"><span><strong>{entry.action}</strong><span className="text-muted mr-2">{entry.entityType}{entry.entityId ? ` · ${entry.entityId}` : ""}</span></span><time className="text-muted">{new Date(entry.createdAt).toLocaleString("ar-YE")}</time></article>)}</div> : <Empty text="لا توجد عمليات إدارية مسجلة." />}</section>}

      {tab === "database" && <section className="mt-4 animate-rise space-y-6">
        <div className="grid gap-6 md:grid-cols-[280px_1fr]">
          {/* Tables and Backups side menu */}
          <aside className="space-y-6">
            {/* Connection and tables list */}
            <div className="card p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-app pb-2">
                <strong className="text-xs font-black uppercase text-slate-400">جداول النظام</strong>
                <span className="badge text-[10px]">متصلة</span>
              </div>
              <div className="max-h-[30rem] overflow-y-auto space-y-1.5 pr-1">
                {data.dbStats?.tables.map((t) => (
                  <button 
                    key={t.table_name} 
                    onClick={() => { setBrowsingTable(t.table_name); setDbSearch(""); }}
                    className={`w-full rounded-xl px-3 py-2 text-right text-xs transition flex justify-between items-center ${browsingTable === t.table_name ? "bg-[#087767]/15 text-[#087767] font-black" : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/20"}`}
                  >
                    <span className="truncate">🖹 {t.table_name}</span>
                    <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-muted px-2 py-0.5 rounded-full font-bold">{t.row_count}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Backups section */}
            <div className="card p-4 space-y-3">
              <div className="border-b border-app pb-2">
                <strong className="text-xs font-black uppercase text-slate-400">النسخ الاحتياطية (.dump)</strong>
              </div>
              <div className="space-y-2 text-xs">
                {data.dbStats?.backups.length ? data.dbStats.backups.map((b) => (
                  <div key={b.name} className="soft-card p-2 text-right">
                    <span className="font-bold text-slate-700 dark:text-slate-300 block truncate" title={b.name}>{b.name}</span>
                    <small className="text-muted block mt-0.5">الحجم: {(b.size / 1024).toFixed(1)} KB · {new Date(b.createdAt).toLocaleDateString("ar-YE")}</small>
                  </div>
                )) : <p className="text-muted text-[10px] text-center">لا توجد ملفات نسخ احتياطي مخزنة.</p>}
              </div>
            </div>
          </aside>

          {/* Table records browser */}
          <div className="space-y-4">
            {browsingTable ? (
              <div className="card p-5 space-y-4 overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-app pb-3">
                  <div>
                    <h3 className="text-lg font-black text-[#085a4e]">مستعرض الجدول: {browsingTable}</h3>
                    <p className="text-muted text-xs mt-0.5">يعرض أول 100 سجل مسجل في قاعدة البيانات لجدول {browsingTable}</p>
                  </div>
                  <input 
                    className="input max-w-xs text-xs" 
                    value={dbSearch} 
                    onChange={(e) => setDbSearch(e.target.value)} 
                    placeholder="ابحث في سجلات هذا الجدول…" 
                  />
                </div>

                {loadingRows ? (
                  <div className="skeleton h-60 rounded-xl" />
                ) : filteredDbRows.length ? (
                  <div className="overflow-x-auto max-h-[36rem]">
                    <table className="w-full text-xs text-right border-collapse">
                      <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900 border-b border-app font-bold text-slate-700 dark:text-slate-300">
                        <tr>
                          {currentTableColumns.map((col) => (
                            <th className="p-3 whitespace-nowrap" key={col.column_name}>
                              {col.column_name} <span className="text-[9px] font-normal text-muted">({col.data_type})</span>
                            </th>
                          ))}
                          <th className="p-3 text-center">إجراءات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDbRows.map((row, index) => {
                          // Detect primary key
                          const primaryKeyField = "id" in row ? "id" : "key" in row ? "key" : "";
                          const primaryKeyValue = primaryKeyField ? String(row[primaryKeyField]) : "";

                          return (
                            <tr key={index} className="border-b border-app/50 hover:bg-slate-50/50 dark:hover:bg-slate-900/10">
                              {currentTableColumns.map((col) => (
                                <td className="p-3 whitespace-pre-wrap max-w-xs truncate" key={col.column_name}>
                                  {row[col.column_name] === null ? <span className="text-slate-300">NULL</span> : String(row[col.column_name])}
                                </td>
                              ))}
                              <td className="p-3 text-center">
                                {data.dbStats?.tables.find((table) => table.table_name === browsingTable)?.canDelete && primaryKeyField && primaryKeyValue ? (
                                  <button 
                                    disabled={busy}
                                    onClick={() => {
                                      if (!confirm(`هل أنت متأكد تمامًا من رغبتك في حذف السجل ذي القيمة "${primaryKeyValue}" من جدول "${browsingTable}"؟ قد تؤثر هذه العملية على الجداول المرتبطة.`)) return;
                                      action({
                                        action: "database.deleteRow",
                                        table: browsingTable,
                                        primaryKeyField,
                                        primaryKeyValue,
                                      }, `تم حذف السجل من جدول ${browsingTable} وتدوين العملية في سجل التدقيق.`);
                                    }}
                                    className="text-[10px] bg-red-50 text-red-600 hover:bg-red-100 font-bold px-2 py-1 rounded-md"
                                  >
                                    حذف
                                  </button>
                                ) : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-muted text-center py-10">لا توجد سجلات مطابقة في هذا الجدول.</p>
                )}
              </div>
            ) : (
              <div className="card p-12 text-center flex flex-col items-center justify-center min-h-[30rem]">
                <span className="text-4xl text-[#087767] animate-pulse">🖳</span>
                <strong className="mt-4 text-base font-extrabold text-slate-700 dark:text-slate-300">مستكشف قاعدة البيانات العلائقية</strong>
                <p className="text-muted text-xs mt-2 max-w-md leading-6">
                  اختر أحد جداول النظام الـ 51 من القائمة الجانبية لتصفح الأعمدة والبيانات والسجلات والمخطط وتصفيتها وحذف السجلات المحددة بشكل آمن.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>}

      {tab === "settings" && <section className="mt-4 space-y-8"><div><h2 className="mb-4 text-xl font-extrabold">إدارة القائمة الرئيسية</h2><AdminNavigationClient /></div><div><h2 className="mb-4 text-xl font-extrabold">إعدادات المحتوى والإعلانات</h2><ContentSettings busy={busy} action={action} onSyncTelegram={syncTelegram} /></div></section>}
    </> : <div className="skeleton h-72" />}
  </>;
}

function UserEditor({ user, options, assignments, busy, action }: { user: UserRow; options: AdminData["options"]; assignments: AdminData["representativeAssignments"]; busy: boolean; action: (body: Record<string, unknown>, success?: string) => Promise<unknown> }) {
  const [open, setOpen] = useState(false);
  const assignedIds = assignments.filter((item) => item.representativeId === user.id).map((item) => item.courseId);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    await action({ action: "user.update", userId: user.id, fullName: form.get("fullName"), email: form.get("email"), role: form.get("role"), isActive: form.get("isActive") === "on", emailVerified: form.get("emailVerified") === "on", university: form.get("university"), studentNumber: form.get("studentNumber"), groupName: form.get("groupName"), collegeId: form.get("collegeId") || null, departmentId: form.get("departmentId") || null, levelId: form.get("levelId") || null, semesterId: form.get("semesterId") || null }, "تم تحديث الحساب وإبطال جلساته القديمة.");
  }
  async function password(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const value = String(form.get("password") || "");
    if (!confirm(`تغيير كلمة مرور حساب ${user.fullName} وإبطال جلساته؟`)) return;
    const done = await action({ action: "user.setPassword", userId: user.id, password: value }, "تم تغيير كلمة المرور وإبطال الجلسات القديمة.");
    if (done) event.currentTarget.reset();
  }
  async function assignCourse(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const done = await action({ action: "representative.assignCourse", userId: user.id, courseId: form.get("courseId"), canPublishDirectly: form.get("canPublishDirectly") === "on" }, "تم إسناد المادة إلى المندوب.");
    if (done) event.currentTarget.reset();
  }
  return <article className="card overflow-hidden">
    <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-4 p-4 text-right">
      <span className={`h-3 w-3 rounded-full ${user.isActive ? "bg-emerald-500" : "bg-red-500"}`} /><span className="min-w-0 flex-1"><strong className="block truncate">{user.fullName}</strong><small className="text-muted block truncate" dir="ltr">{user.email}</small></span><span className="badge">{roleLabel(user.role)}</span><span>{open ? "⌃" : "⌄"}</span>
    </button>
    {open && <div className="border-t border-app p-5"><form onSubmit={save} className="grid gap-4 md:grid-cols-2">
      <Field label="الاسم"><input className="input" name="fullName" defaultValue={user.fullName} required /></Field>
      <Field label="البريد"><input className="input" name="email" type="email" defaultValue={user.email} required readOnly={user.role === "admin"} dir="ltr" /></Field>
      <Field label="الدور"><select className="input" name="role" defaultValue={user.role} disabled={user.role === "admin"}><option value="student">طالب</option><option value="representative">مندوب</option><option value="support">موظف دعم</option>{user.role === "admin" && <option value="admin">مدير</option>}</select></Field>
      <Field label="الجامعة"><input className="input" name="university" defaultValue={user.university || ""} /></Field>
      <Field label="الكلية"><Select name="collegeId" value={user.collegeId} options={options.colleges} /></Field>
      <Field label="التخصص"><Select name="departmentId" value={user.departmentId} options={options.departments} /></Field>
      <Field label="المستوى"><Select name="levelId" value={user.levelId} options={options.levels} /></Field>
      <Field label="الفصل"><Select name="semesterId" value={user.semesterId} options={options.semesters} /></Field>
      <Field label="الرقم الجامعي"><input className="input" name="studentNumber" defaultValue={user.studentNumber || ""} /></Field>
      <Field label="الشعبة"><input className="input" name="groupName" defaultValue={user.groupName || ""} /></Field>
      <label className="soft-card flex items-center gap-3 p-3"><input type="checkbox" name="isActive" defaultChecked={user.isActive} disabled={user.role === "admin"} /><span>الحساب نشط</span></label>
      <label className="soft-card flex items-center gap-3 p-3"><input type="checkbox" name="emailVerified" defaultChecked={Boolean(user.emailVerifiedAt)} disabled={user.role === "admin"} /><span>البريد موثّق</span></label>
      <button disabled={busy} className="btn-primary md:col-span-2">حفظ تعديلات الحساب</button>
    </form>
    {user.role === "representative" && <form onSubmit={assignCourse} className="mt-5 grid gap-3 border-t border-app pt-5 md:grid-cols-[1fr_auto_auto]"><select className="input" name="courseId" required><option value="">اختر مادة لإسنادها</option>{options.courses.map((course) => <option key={course.id} value={course.id}>{course.name}{course.code ? ` — ${course.code}` : ""}{assignedIds.includes(course.id) ? " (مسندة)" : ""}</option>)}</select><label className="soft-card flex items-center gap-2 px-3"><input type="checkbox" name="canPublishDirectly" defaultChecked /><span className="text-sm">نشر مباشر</span></label><button disabled={busy || !options.courses.length} className="btn-secondary">إسناد المادة</button></form>}
    <form onSubmit={password} className="mt-5 flex flex-wrap gap-2 border-t border-app pt-5"><input className="input min-w-56 flex-1" name="password" type="password" minLength={8} placeholder="كلمة مرور مؤقتة جديدة" required dir="ltr" /><button disabled={busy} className="btn-secondary">تغيير كلمة المرور</button></form>
    </div>}
  </article>;
}

function TicketEditor({ ticket, busy, action }: { ticket: Ticket; busy: boolean; action: (body: Record<string, unknown>, success?: string) => Promise<unknown> }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Array<{ id: string; senderId: string; body: string; isInternal: boolean; createdAt: string }>>([]);
  async function loadMessages() { if (!ticket.conversationId) return; const response = await fetch(`/api/support/conversations?id=${ticket.conversationId}`); const payload = await response.json(); if (response.ok) setMessages(payload.messages); }
  useEffect(() => { if (open) loadMessages(); }, [open, ticket.conversationId]);
  async function reply(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const done = await action({ action: "support.reply", ticketId: ticket.id, message: form.get("message") }, "تم إرسال الرد للطالب وإضافة إشعار له."); if (done) { event.currentTarget.reset(); await loadMessages(); } }
  return <article className="card p-5"><div className="flex flex-wrap items-start gap-3"><div className="min-w-0 flex-1"><div className="flex gap-2"><span className="badge">{ticketType(ticket.type)}</span><span className="badge">{ticketStatus(ticket.status)}</span></div><h3 className="mt-3 text-lg font-bold">{ticket.subject}</h3><p className="text-muted mt-1 text-sm">{ticket.userName} · <span dir="ltr">{ticket.userEmail}</span></p></div><time className="text-muted text-xs">{new Date(ticket.updatedAt).toLocaleString("ar-YE")}</time></div><p className="mt-4 whitespace-pre-wrap rounded-xl bg-[var(--surface-2)] p-4 text-sm leading-7">{ticket.description}</p>
    <div className="mt-4 flex flex-wrap gap-2"><button className="btn-secondary" onClick={() => setOpen(!open)}>{open ? "إخفاء المحادثة" : "عرض المحادثة والرد"}</button><select className="input !w-auto" value={ticket.status} disabled={busy} onChange={(event) => action({ action: "ticket.update", ticketId: ticket.id, status: event.target.value }, "تم تحديث حالة التذكرة.")}><option value="open">مفتوحة</option><option value="in_progress">قيد المعالجة</option><option value="waiting">بانتظار الطالب</option><option value="resolved">تم الحل</option><option value="closed">مغلقة</option></select></div>
    {open && <div className="mt-4 space-y-3 border-t border-app pt-4">{messages.length ? messages.map((item) => <div key={item.id} className={`rounded-xl p-3 text-sm ${item.isInternal ? "bg-amber-50 text-amber-900" : "soft-card"}`}><small className="text-muted">{item.isInternal ? "ملاحظة داخلية" : item.senderId === ticket.userId ? "الطالب" : "الإدارة"} · {new Date(item.createdAt).toLocaleString("ar-YE")}</small><p className="mt-2 whitespace-pre-wrap">{item.body}</p></div>) : <p className="text-muted text-sm">لا توجد رسائل سابقة. سيبدأ الرد محادثة مرتبطة بالتذكرة.</p>}<form onSubmit={reply} className="flex gap-2"><textarea className="input min-h-20" name="message" placeholder="اكتب رد الإدارة للطالب…" required /><button disabled={busy} className="btn-primary">إرسال الرد</button></form></div>}
  </article>;
}

function ContentSettings({ busy, action, onSyncTelegram }: { busy: boolean; action: (body: Record<string, unknown>, success?: string) => Promise<unknown>; onSyncTelegram: () => void }) {
  async function category(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const done = await action({ action: "category.create", ...Object.fromEntries(form) }, "تمت إضافة قسم المجتمع."); if (done) event.currentTarget.reset(); }
  async function announcement(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const done = await action({ action: "announcement.create", title: form.get("title"), body: form.get("body"), publish: true }, "تم نشر الإعلان لجميع الطلاب."); if (done) event.currentTarget.reset(); }
  async function registerUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const done = await action({ action: "app.updateVersion", version: form.get("version"), changelog: form.get("changelog"), url: form.get("url") }, "تم تسجيل تحديث التطبيق وبث إشعارات لجميع الطلاب.");
    if (done) event.currentTarget.reset();
  }
  return <div className="mt-4 grid gap-6 lg:grid-cols-2"><form onSubmit={category} className="card h-fit space-y-4 p-5"><h2 className="font-bold text-[#085a4e]">إضافة قسم للمجتمع</h2><input name="nameAr" className="input text-xs" placeholder="اسم القسم بالعربية" required /><input name="slug" className="input text-xs" placeholder="english-slug" pattern="[a-z0-9-]+" dir="ltr" required /><textarea name="description" className="input text-xs" placeholder="وصف القسم" /><button disabled={busy} className="btn-primary w-full text-xs">إضافة القسم</button></form><form onSubmit={announcement} className="card h-fit space-y-4 p-5"><h2 className="font-bold text-[#085a4e]">إعلان عام للطلاب</h2><input name="title" className="input text-xs" placeholder="عنوان الإعلان" required /><textarea name="body" className="input min-h-28 text-xs" placeholder="محتوى الإعلان" required /><button disabled={busy} className="btn-primary w-full text-xs">نشر الإعلان</button></form><form onSubmit={registerUpdate} className="card h-fit space-y-4 p-5 lg:col-span-2"><h2 className="font-bold text-[#085a4e]">إدارة تحديثات تطبيق رفيقي والـ Telegram</h2><p className="text-muted text-xs leading-5">تتم متابعة ونشر التحديثات لقناة <a href="https://t.me/rafeeqybeta" className="text-brand font-bold underline" target="_blank" rel="noreferrer">rafeeqybeta</a> تلقائياً أو يدوياً لتأمين وبث التحديثات والإشعارات لجميع الطلاب.</p><div className="grid gap-4 sm:grid-cols-2"><Field label="رقم الإصدار الجديد (مثال: 0.1.2)"><input className="input text-xs" name="version" required placeholder="0.1.2" dir="ltr" /></Field><Field label="رابط التحميل المباشر"><input className="input text-xs" name="url" defaultValue="https://t.me/rafeeqybeta" required dir="ltr" /></Field></div><Field label="ملخص التغييرات وسجل الميزات"><textarea className="input min-h-20 text-xs" name="changelog" required placeholder="أصلحنا كذا وأضفنا كذا..." /></Field><div className="flex flex-col sm:flex-row gap-2 pt-2"><button disabled={busy} className="btn-primary flex-1 text-xs">تسجيل الإصدار يدوياً وبث التنبيه 📝</button><button type="button" onClick={onSyncTelegram} disabled={busy} className="btn-secondary text-xs flex-1 border-[#087767] text-[#087767] font-bold">مزامنة التحديثات تلقائياً من قناة تيليجرام 🔄</button></div></form></div>;
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button onClick={onClick} className={active ? "btn-primary whitespace-nowrap" : "btn-secondary whitespace-nowrap"}>{children}</button>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label><span className="label">{label}</span>{children}</label>; }
function Select({ name, value, options }: { name: string; value: string | null; options: Option[] }) { return <select className="input" name={name} defaultValue={value || ""}><option value="">غير محدد</option>{options.map((option) => <option key={option.id} value={option.id}>{option.name}{option.academicYear ? ` — ${option.academicYear}` : ""}</option>)}</select>; }
const countLabels: Record<string, string> = { users: "المستخدمون", courses: "المواد", content: "المحتوى", assignments: "الواجبات", tickets: "التذاكر", reports: "البلاغات" };
function roleLabel(role: Role) { return ({ student: "طالب", representative: "مندوب", support: "دعم", admin: "مدير" } as Record<Role, string>)[role]; }
function ticketType(value: string) { return ({ technical: "مشكلة تقنية", account: "الحساب", content: "المحتوى", other: "أخرى" } as Record<string, string>)[value] || value; }
function ticketStatus(value: string) { return ({ open: "مفتوحة", waiting: "بانتظار الطالب", in_progress: "قيد المعالجة", resolved: "تم الحل", closed: "مغلقة" } as Record<string, string>)[value] || value; }
