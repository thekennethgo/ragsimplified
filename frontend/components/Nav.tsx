import Link from "next/link";

export default function Nav() {
  return (
    <nav>
      <Link href="/upload">Upload</Link>
      <Link href="/ask">Ask</Link>
    </nav>
  );
}
