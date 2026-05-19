/**
 * MainLayout — wraps every page with the shared Header and Footer.
 *
 * WHY a layout component?
 *   Without it, every page repeats the same boilerplate:
 *     <div className="min-h-screen flex flex-col bg-gray-50">
 *       <Header />
 *       <main className="flex-1 ...">...</main>
 *       <Footer />
 *     </div>
 *
 *   MainLayout removes that repetition. Each page just writes:
 *     <MainLayout><YourContent /></MainLayout>
 *
 * Props:
 *   children  — the page content
 *   wide      — use a wider max-width (for admin pages with more columns)
 *   noPad     — disable horizontal padding (for full-bleed layouts)
 */
import Footer from "../layout/Footer";
import Header from "../layout/Header";

export default function MainLayout({ children, wide = false, noPad = false, maxWidth: maxWidthProp }) {
  const maxWidth = maxWidthProp ?? (wide ? "max-w-6xl" : "max-w-4xl");
  const padding  = noPad ? "" : "px-4 py-8";

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className={`flex-1 w-full mx-auto ${maxWidth} ${padding}`}>
        {children}
      </main>
      <Footer />
    </div>
  );
}
