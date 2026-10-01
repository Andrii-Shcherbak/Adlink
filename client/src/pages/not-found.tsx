import { FiLink } from "react-icons/fi";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden bg-gray-950 text-white px-4 py-12">
      {/* Background */}
      <div className="absolute inset-0 z-0 deepmind-grid [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-[60%] -translate-y-[60%] w-[520px] h-[520px] blur-3xl rounded-full bg-blue-500/15 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-[30%] -translate-y-[30%] w-[420px] h-[420px] blur-3xl rounded-full bg-purple-500/15 pointer-events-none" />

      <main className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-gray-900/60 backdrop-blur-xl shadow-2xl px-6 sm:px-8 pt-10 pb-8 text-center animate-in fade-in slide-in-from-bottom-3 duration-500">
        <p className="text-7xl sm:text-8xl font-bold tracking-tight bg-gradient-to-r from-blue-500 to-violet-500 text-transparent bg-clip-text leading-none select-none">
          404
        </p>
        <h1 className="mt-5 text-2xl font-bold">Page not found</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-white/65">
          The page or link you're looking for doesn't exist. It may have been moved, deleted, or the address may be mistyped.
        </p>
      </main>

      <div className="relative z-10 mt-7 flex items-center gap-2 text-sm text-white/45">
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-r from-blue-600 to-violet-600 text-white">
          <FiLink className="h-3 w-3" />
        </span>
        <span className="font-bold bg-gradient-to-r from-blue-500 to-violet-500 text-transparent bg-clip-text">ADLink</span>
      </div>
    </div>
  );
}
