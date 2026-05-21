import Footer from "../layout/Footer";
import Header from "../layout/Header";

export default function MainLayout({ children, wide = false, noPad = false, maxWidth: maxWidthProp }) {
  const maxWidth = maxWidthProp ?? (wide ? "max-w-6xl" : "max-w-4xl");
  const padding  = noPad ? "" : "px-4 sm:px-6 py-8";

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />
      <main className={`flex-1 w-full mx-auto ${maxWidth} ${padding}`}>
        {children}
      </main>
      <Footer />
    </div>
  );
}
