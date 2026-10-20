import { Nav } from "@/components/Nav";
import { PageWidth } from "@/components/PageWidth";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="md:pl-56">
      <Nav />
      <PageWidth>{children}</PageWidth>
    </div>
  );
}
