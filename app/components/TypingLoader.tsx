export default function TypingLoader() {
  return (
    <div className="flex gap-2 px-4 py-3 rounded-2xl bg-white/10 w-fit">
      <div className="h-2 w-2 rounded-full bg-white animate-bounce" />
      <div className="h-2 w-2 rounded-full bg-white animate-bounce delay-100" />
      <div className="h-2 w-2 rounded-full bg-white animate-bounce delay-200" />
    </div>
  );
}