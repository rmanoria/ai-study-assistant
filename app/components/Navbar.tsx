export default function Navbar() {
  return (
    <nav className="w-full flex items-center justify-between px-6 py-4 border-b border-gray-800">
      <h1 className="text-xl font-bold">AI Study Assistant</h1>

      <div className="flex gap-4 text-sm text-gray-300">
        <a href="#" className="hover:text-white">Home</a>
        <a href="#" className="hover:text-white">Chat</a>
        <a href="#" className="hover:text-white">About</a>
      </div>
    </nav>
  );
}