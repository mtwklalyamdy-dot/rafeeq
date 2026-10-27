"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";

type CollegeType = { name: string; departments: string[] };
type UniversityType = { university: string; colleges: CollegeType[] };
type LevelType = { id?: string; nameAr: string; sortOrder: number };

export function RegisterForm({ accountType = "student" }: { accountType?: "student" | "representative" }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Academic structure fetched from server
  const [academicData, setAcademicData] = useState<UniversityType[]>([]);
  const [levelList, setLevelList] = useState<LevelType[]>([]);

  // Selected values
  const [selectedUniv, setSelectedUniv] = useState("");
  const [selectedCollege, setSelectedCollege] = useState("");
  const [selectedDept, setSelectedDept] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("1");

  // Custom text fallback state (if choosing "أخرى")
  const [customUniv, setCustomUniv] = useState("");
  const [customCollege, setCustomCollege] = useState("");
  const [customDept, setCustomDept] = useState("");

  useEffect(() => {
    fetch("/api/auth/options")
      .then((r) => r.json())
      .then((data) => {
        if (data.universities) {
          setAcademicData(data.universities);
          // Set initial university
          if (data.universities.length > 0) {
            setSelectedUniv(data.universities[0].university);
          }
        }
        if (data.levels) {
          setLevelList(data.levels);
        }
      })
      .catch(() => {});
  }, []);

  // Filter colleges based on selected university
  const currentColleges = academicData.find((u) => u.university === selectedUniv)?.colleges || [];

  // Update selected college when university changes
  useEffect(() => {
    if (selectedUniv && selectedUniv !== "other") {
      const cols = academicData.find((u) => u.university === selectedUniv)?.colleges || [];
      if (cols.length > 0) {
        setSelectedCollege(cols[0].name);
      } else {
        setSelectedCollege("");
      }
    } else if (selectedUniv === "other") {
      setSelectedCollege("other");
    }
  }, [selectedUniv, academicData]);

  // Filter departments based on selected college
  const currentDepts = currentColleges.find((c) => c.name === selectedCollege)?.departments || [];

  // Update selected department when college changes
  useEffect(() => {
    if (selectedCollege && selectedCollege !== "other") {
      const cols = academicData.find((u) => u.university === selectedUniv)?.colleges || [];
      const depts = cols.find((c) => c.name === selectedCollege)?.departments || [];
      if (depts.length > 0) {
        setSelectedDept(depts[0]);
      } else {
        setSelectedDept("");
      }
    } else if (selectedCollege === "other") {
      setSelectedDept("other");
    }
  }, [selectedCollege, selectedUniv, academicData]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form);

    // Resolve "Other" text fields
    const finalUniversity = selectedUniv === "other" ? customUniv.trim() : selectedUniv;
    const finalCollege = selectedCollege === "other" ? customCollege.trim() : selectedCollege;
    const finalDepartment = selectedDept === "other" ? customDept.trim() : selectedDept;

    if (!finalUniversity || !finalCollege || !finalDepartment) {
      setError("يرجى ملء جميع الحقول الأكاديمية المطلوبة");
      setLoading(false);
      return;
    }

    body.university = finalUniversity;
    body.college = finalCollege;
    body.department = finalDepartment;
    body.accountType = accountType;
    body.level = selectedLevel;

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      
      setMessage(data.message);
      if (data.mailSent) {
        setTimeout(() => router.push(`/verify?email=${encodeURIComponent(String(body.email))}`), 800);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر إنشاء الحساب");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Logo />
      <div className="mt-7">
        <p className="text-brand text-sm font-bold">
          {accountType === "representative" ? "طلب حساب مندوب" : "انضم إلى رفيقي"}
        </p>
        <h2 className="mt-1 text-3xl font-bold text-slate-800 dark:text-slate-100">إنشاء حساب</h2>
        {accountType === "representative" && (
          <p className="text-muted mt-2 text-sm">
            يحتاج الحساب إلى توثيق البريد ثم اعتماد الإدارة.
          </p>
        )}
      </div>

      {error && (
        <div role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}
      {message && (
        <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
          {message}
        </div>
      )}

      <form onSubmit={submit} className="mt-6 grid grid-cols-2 gap-4">
        {/* Full Name */}
        <label className="col-span-2">
          <span className="label">الاسم الكامل</span>
          <input className="input" name="fullName" required minLength={3} placeholder="اسمك الثلاثي واللقب" />
        </label>

        {/* Email */}
        <label className="col-span-2">
          <span className="label">البريد الإلكتروني</span>
          <input className="input" name="email" type="email" dir="ltr" required placeholder="yourname@gmail.com" />
        </label>

        {/* Password */}
        <label>
          <span className="label">كلمة المرور</span>
          <input className="input" name="password" type="password" minLength={8} required dir="ltr" placeholder="••••••••" />
        </label>

        {/* Confirm Password */}
        <label>
          <span className="label">تأكيدها</span>
          <input className="input" name="confirmPassword" type="password" minLength={8} required dir="ltr" placeholder="••••••••" />
        </label>

        {/* University Dropdown */}
        <label className="col-span-2">
          <span className="label">الجامعة</span>
          <select 
            className="input" 
            value={selectedUniv} 
            onChange={(e) => setSelectedUniv(e.target.value)}
          >
            {academicData.map((u) => (
              <option key={u.university} value={u.university}>{u.university}</option>
            ))}
            <option value="other">جامعة أخرى / غير مسجلة</option>
          </select>
        </label>

        {/* Custom University input if "Other" is chosen */}
        {selectedUniv === "other" && (
          <label className="col-span-2 animate-rise">
            <span className="label">اكتب اسم الجامعة</span>
            <input 
              className="input border-emerald-300 bg-emerald-50/5" 
              value={customUniv} 
              onChange={(e) => setCustomUniv(e.target.value)} 
              placeholder="اسم الجامعة بالكامل" 
              required 
            />
          </label>
        )}

        {/* College Dropdown */}
        <label className="col-span-2">
          <span className="label">الكلية</span>
          <select 
            className="input" 
            value={selectedCollege} 
            onChange={(e) => setSelectedCollege(e.target.value)}
            disabled={selectedUniv === ""}
          >
            {selectedUniv !== "other" && currentColleges.map((c) => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
            <option value="other">كلية أخرى / غير مسجلة</option>
          </select>
        </label>

        {/* Custom College input if "Other" is chosen */}
        {selectedCollege === "other" && (
          <label className="col-span-2 animate-rise">
            <span className="label">اكتب اسم الكلية</span>
            <input 
              className="input border-emerald-300 bg-emerald-50/5" 
              value={customCollege} 
              onChange={(e) => setCustomCollege(e.target.value)} 
              placeholder="اسم الكلية بالكامل" 
              required 
            />
          </label>
        )}

        {/* Department Dropdown */}
        <label className="col-span-2">
          <span className="label">التخصص</span>
          <select 
            className="input" 
            value={selectedDept} 
            onChange={(e) => setSelectedDept(e.target.value)}
            disabled={selectedCollege === ""}
          >
            {selectedCollege !== "other" && currentDepts.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
            <option value="other">تخصص آخر / غير مسجل</option>
          </select>
        </label>

        {/* Custom Department input if "Other" is chosen */}
        {selectedDept === "other" && (
          <label className="col-span-2 animate-rise">
            <span className="label">اكتب اسم التخصص</span>
            <input 
              className="input border-emerald-300 bg-emerald-50/5" 
              value={customDept} 
              onChange={(e) => setCustomDept(e.target.value)} 
              placeholder="مثال: إدارة أعمال، تسويق" 
              required 
            />
          </label>
        )}

        {/* Level Dropdown */}
        <label>
          <span className="label">المستوى</span>
          <select 
            className="input" 
            value={selectedLevel} 
            onChange={(e) => setSelectedLevel(e.target.value)}
          >
            {levelList.map((l, i) => (
              <option key={i} value={String(i + 1)}>
                {l.nameAr}
              </option>
            ))}
          </select>
        </label>

        {/* Semester */}
        <label>
          <span className="label">الفصل الدراسي</span>
          <select className="input" name="semester" defaultValue="1">
            <option value="1">الفصل الأول</option>
            <option value="2">الفصل الثاني</option>
          </select>
        </label>

        <button disabled={loading} className="btn-primary col-span-2 mt-2" type="submit">
          {loading ? "جارٍ الإنشاء والتوثيق…" : "إنشاء الحساب ←"}
        </button>
      </form>

      <p className="text-muted mt-5 text-center text-sm">
        لديك حساب بالفعل؟{" "}
        <Link href={accountType === "representative" ? "/representative/login" : "/"} className="text-brand font-bold">
          تسجيل الدخول
        </Link>
      </p>
    </>
  );
}
