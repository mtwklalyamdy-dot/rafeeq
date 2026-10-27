"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/logo";

export function VerifyForm({ email }: { email: string }) {
  const router=useRouter();const[code,setCode]=useState("");const[message,setMessage]=useState("");const[error,setError]=useState("");const[loading,setLoading]=useState(false);
  async function verify(e:React.FormEvent){e.preventDefault();setLoading(true);setError("");try{const r=await fetch("/api/auth/verify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,code,purpose:"verify_email"})});const d=await r.json();if(!r.ok)throw new Error(d.error);router.push(d.role==="representative"?"/representative/login":"/dashboard");router.refresh();}catch(c){setError(c instanceof Error?c.message:"تعذر التحقق");}finally{setLoading(false)}}
  async function resend(){setError("");setMessage("");const r=await fetch("/api/auth/resend",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,purpose:"verify_email"})});const d=await r.json();if(!r.ok)setError(d.error);else setMessage(d.message)}
  return <><Logo/><h2 className="mt-8 text-3xl font-bold">توثيق البريد</h2><p className="text-muted mt-2 text-sm">أدخل الرمز المرسل إلى <span dir="ltr" className="font-bold">{email||"بريدك"}</span>. صلاحيته 10 دقائق.</p>{error&&<p className="mt-4 rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}{message&&<p className="mt-4 rounded-xl bg-emerald-50 p-3 text-emerald-800">{message}</p>}<form onSubmit={verify} className="mt-7 space-y-5"><input value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))} className="input text-center text-3xl tracking-[.5em]" dir="ltr" inputMode="numeric" pattern="\d{6}" required aria-label="رمز التحقق"/><button disabled={loading||code.length!==6} className="btn-primary w-full">{loading?"جارٍ التحقق…":"تحقق من الحساب"}</button></form><button onClick={resend} className="text-brand mt-5 w-full text-sm font-bold">إعادة إرسال الرمز</button></>;
}
