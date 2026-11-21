import Link from 'next/link';
import { Navigation2 } from 'lucide-react';
export function Brand() {
  return (
    <Link href="/" className="brand">
      <span className="mark">
        <Navigation2 size={23} fill="currentColor" strokeWidth={2} />
      </span>
      DuePilot
    </Link>
  );
}
