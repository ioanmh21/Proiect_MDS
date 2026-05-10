export default function MbappePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-white p-8">
      <h1 className="text-4xl font-extrabold mb-8 bg-gradient-to-r from-blue-500 to-purple-500 text-transparent bg-clip-text">
        Surprise! Here is Mbappé ⚽
      </h1>
      
      <div className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-indigo-500/30 max-w-2xl w-full">
        {/* We use a standard image of Mbappe from wikimedia commons */}
        <img 
          src="https://upload.wikimedia.org/wikipedia/commons/b/b3/2022_FIFA_World_Cup_France_4%E2%80%931_Australia_-_%287%29_%28cropped%29.jpg" 
          alt="Kylian Mbappe" 
          className="w-full h-auto object-cover hover:scale-105 transition-transform duration-700"
        />
      </div>
      
      <p className="mt-8 text-slate-400 text-lg text-center max-w-xl">
        This page confirms your login was 100% successful and the redirect works perfectly outside the protected dashboard routes.
      </p>
      
      <a href="/login" className="mt-8 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors font-semibold">
        Go Back to Login
      </a>
    </div>
  );
}
