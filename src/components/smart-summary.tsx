"use client";

import { useState } from "react";
import { ErrorBox } from "@/components/academic-clients";

const summaryTypes = [
  ["short", "ملخص قصير"], ["medium", "ملخص متوسط"], ["detailed", "ملخص مفصل"], ["headings", "حسب العناوين"],
  ["key_points", "أهم النقاط"], ["definitions", "التعريفات والمصطلحات"], ["equations", "القوانين والمعادلات"],
  ["qa", "أسئلة وأجوبة"], ["mcq", "اختيار من متعدد"], ["true_false", "صح وخطأ"], ["flashcards", "بطاقات تعليمية"], ["simple", "شرح مبسط"],
] as const;

type Stage = "idle" | "uploading" | "summarizing" | "completed" | "failed";

export function SmartSummary() {
  const [text, setText] = useState("");
  const [type, setType] = useState("medium");
  const [file, setFile] = useState<File | null>(null);
  const [uploadedFileId, setUploadedFileId] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [model, setModel] = useState("");

  function selectFile(next: File | null) {
    setFile(next); setUploadedFileId(""); setError(""); setStage("idle");
  }

  async function run() {
    if (!file && text.trim().length < 20) return;
    setError(""); setResult(""); setModel("");
    try {
      let fileId = uploadedFileId;
      if (file && !fileId) {
        setStage("uploading");
        const form = new FormData(); form.set("file", file);
        const upload = await fetch("/api/files", { method: "POST", body: form }); const uploadData = await upload.json();
        if (!upload.ok) throw new Error(uploadData.error || "تعذر رفع الملف");
        fileId = uploadData.file.id; setUploadedFileId(fileId);
      }
      setStage("summarizing");
      const response = await fetch("/api/ai/summarize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: fileId ? undefined : text.trim(), fileId: fileId || undefined, summaryType: type, title: file?.name || "ملخص نصي" }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "تعذر إنشاء الملخص");
      setResult(payload.summary.content); setModel(`${payload.summary.provider} — ${payload.summary.model}`); setStage("completed");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "فشلت المعالجة"); setStage("failed");
    }
  }

  function download() {
    if (!result) return;
    const blob = new Blob([result], { type: "text/plain;charset=utf-8" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "ملخص-رفيقي.txt"; anchor.click(); URL.revokeObjectURL(url);
  }

  const processing = stage === "uploading" || stage === "summarizing";
  return <div className="grid gap-6 lg:grid-cols-[.8fr_1.2fr]">
    <section className="card space-y-4 p-5"><h2 className="font-bold">مصدر المحتوى</h2><p className="text-muted text-sm">يمكنك رفع PDF أو ملف نصي أو صورة، أو لصق النص مباشرة.</p>
      <label><span className="label">الملف — حتى 12 MB</span><input onChange={(event) => selectFile(event.target.files?.[0] || null)} className="input" type="file" accept="application/pdf,text/plain,image/png,image/jpeg" /></label>
      {file && <div className="soft-card flex items-center justify-between gap-3 p-3"><span className="min-w-0 truncate text-sm">{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</span><button type="button" className="text-sm text-red-600" onClick={() => selectFile(null)}>إزالة</button></div>}
      <div className="text-muted text-center text-xs">— أو الصق النص —</div>
      <label><span className="label">النص</span><textarea value={text} onChange={(event) => setText(event.target.value)} disabled={Boolean(file)} className="input min-h-44" placeholder="الصق محتوى المحاضرة هنا…" /></label>
      <label><span className="label">نوع الناتج</span><select value={type} onChange={(event) => setType(event.target.value)} className="input">{summaryTypes.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      <div className="grid grid-cols-3 gap-2 text-center text-xs"><StageItem active={stage === "uploading"} done={Boolean(uploadedFileId) || !file} label="رفع المصدر" /><StageItem active={stage === "summarizing"} done={stage === "completed"} label="إنشاء الملخص" /><StageItem active={stage === "completed"} done={stage === "completed"} label="اكتمال" /></div>
      <button disabled={processing || (!file && text.trim().length < 20)} onClick={run} className="btn-primary w-full">{stage === "uploading" ? "جارٍ رفع الملف…" : stage === "summarizing" ? "Gemini ينشئ الملخص…" : stage === "failed" ? "إعادة المحاولة" : "إنشاء الملخص"}</button>
      {error && <ErrorBox text={error} />}
    </section>
    <section className="card min-h-96 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold">الملخص الناتج</h2>{model && <small className="text-muted mt-1 block" dir="ltr">{model}</small>}</div>{result && <button onClick={download} className="btn-secondary">تنزيل TXT ↓</button>}</div>{result ? <textarea value={result} onChange={(event) => setResult(event.target.value)} className="input mt-4 min-h-[28rem] leading-8" aria-label="الملخص الناتج" /> : <div className="text-muted grid min-h-80 place-items-center text-center text-sm">لن يظهر محتوى إلا بعد استجابة فعلية من Gemini. إذا نفدت الحصة سيظهر الخطأ بوضوح.</div>}</section>
  </div>;
}

function StageItem({ active, done, label }: { active: boolean; done: boolean; label: string }) { return <div className={`rounded-xl border p-2 ${active ? "border-[var(--brand)] bg-[var(--brand-soft)] text-brand" : done ? "border-emerald-300 text-emerald-700" : "border-app text-muted"}`}>{done ? "✓ " : active ? "… " : "○ "}{label}</div>; }
