export const BUY_ME_A_COFFEE_URL = 'https://buymeacoffee.com/alexmano12';

// Native recreation of the official widget: its script relies on document.write,
// which cannot run after React mounts, and would load third-party code during export.
export function BuyMeACoffeeButton({ className = '' }: { className?: string }) {
  return (
    <a
      href={BUY_ME_A_COFFEE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-black bg-[#FFDD00] px-4 py-1.5 text-black shadow-sm transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black ${className}`}
      style={{ fontFamily: "Cookie, 'Brush Script MT', cursive" }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
        <path d="M5 8h12v7a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5V8Z" fill="#ffffff" stroke="#000000" strokeWidth="1.5" />
        <path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17" fill="none" stroke="#000000" strokeWidth="1.5" />
        <path d="M8 2.5c0 1.2 1 1.3 1 2.5M12 2.5c0 1.2 1 1.3 1 2.5" fill="none" stroke="#000000" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
      <span className="text-2xl leading-none">Buy me a coffee</span>
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}
