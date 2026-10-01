import type { ReactNode } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";

export function PageShell({ title, intro, children }: { title?: string; intro?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 py-8">
        {title && <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>}
        {intro && <p className="mt-2 text-muted-foreground">{intro}</p>}
        <div className={title ? "mt-6" : ""}>{children}</div>
      </main>
      <Footer />
    </div>
  );
}
