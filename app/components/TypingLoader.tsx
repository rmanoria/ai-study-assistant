export default function TypingLoader() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3 rounded-2xl bg-white/8 w-fit border border-white/10">
      <div className="h-2 w-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "0ms" }} />
      <div className="h-2 w-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "150ms" }} />
      <div className="h-2 w-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "300ms" }} />
    </div>
  );
}
