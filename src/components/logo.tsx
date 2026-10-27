export function Logo({ compact = false, inverse = false }: { compact?: boolean; inverse?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`grid ${compact ? "h-10 w-10" : "h-12 w-12"} place-items-center rounded-2xl ${inverse ? "bg-white/15" : "brand-gradient"} shadow-lg`} aria-hidden="true">
        <svg viewBox="0 0 32 32" className="h-7 w-7"><path d="M3 10.5 16 4l13 6.5L16 17 3 10.5Z" fill="white"/><path d="M7.5 15v7c0 3.2 3.8 5.8 8.5 5.8s8.5-2.6 8.5-5.8v-7L16 19.2 7.5 15Z" fill="#dff3ed"/><path d="M29 12v10" stroke="#f0b451" strokeWidth="2"/></svg>
      </span>
      <span><strong className={`${compact ? "text-xl" : "text-2xl"} block leading-none`}>رفيقي</strong>{!compact && <small className={inverse ? "text-white/70" : "text-muted"}>رفيقك في طريقك الأكاديمي</small>}</span>
    </div>
  );
}
