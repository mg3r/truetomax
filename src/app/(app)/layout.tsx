import { Nav } from "@/components/Nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-2xl px-4 pt-4 pb-28 sm:px-6 sm:pb-16">{children}</main>
    </>
  );
}
