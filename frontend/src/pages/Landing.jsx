import { Link } from "react-router-dom";
import Footer from "../components/layout/Footer";
import Header from "../components/layout/Header";

const SERVICES = [
  { name: "Desktop Support",    fee: "₹499",   icon: "💻" },
  { name: "Linux Provisioning", fee: "₹999",   icon: "🐧" },
  { name: "Windows Server",     fee: "₹999",   icon: "🪟" },
  { name: "OS Patching",        fee: "₹799",   icon: "🔧" },
  { name: "Security Hardening", fee: "₹1,499", icon: "🔒" },
  { name: "VMware / ESXi",      fee: "₹1,299", icon: "☁️" },
  { name: "SAP Basis Lite",     fee: "₹1,999", icon: "🏭" },
];

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-gradient-to-br from-blue-600 to-blue-800 text-white py-20 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl sm:text-5xl font-bold mb-4">
              Expert IT Support for Indian SMBs
            </h1>
            <p className="text-blue-100 text-lg mb-8">
              Pay only when you have a problem. No contracts. No surprise invoices.
              Vetted engineers. GST invoice on every transaction.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/register"
                className="bg-white text-blue-700 font-semibold px-6 py-3 rounded-lg hover:bg-blue-50"
              >
                Open a Support Ticket
              </Link>
              <a
                href="#services"
                className="border border-white/60 text-white px-6 py-3 rounded-lg hover:bg-white/10"
              >
                View Pricing
              </a>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-16 px-4 bg-gray-50">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-center text-gray-900 mb-10">
              How it works
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
              {[
                { step: "1", title: "Describe your problem", body: "Open a ticket in under 2 minutes. Pay ₹299 consulting fee." },
                { step: "2", title: "Expert gets assigned",  body: "A vetted engineer accepts your case and contacts you within the SLA." },
                { step: "3", title: "Problem solved",        body: "Pay the flat resolution fee only after your issue is fixed." },
              ].map((item) => (
                <div key={item.step} className="bg-white rounded-xl border border-gray-200 p-6">
                  <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-lg mx-auto mb-3">
                    {item.step}
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">{item.title}</h3>
                  <p className="text-gray-500 text-sm">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Services */}
        <section id="services" className="py-16 px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold text-center text-gray-900 mb-2">
              Service Catalog
            </h2>
            <p className="text-center text-gray-500 mb-10 text-sm">
              + ₹299 consulting fee on every ticket (refunded if unaccepted within 2 hours)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {SERVICES.map((s) => (
                <div
                  key={s.name}
                  className="bg-white border border-gray-200 rounded-xl p-5 flex items-center gap-4"
                >
                  <span className="text-3xl">{s.icon}</span>
                  <div>
                    <p className="font-medium text-gray-900">{s.name}</p>
                    <p className="text-blue-600 font-semibold">{s.fee}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
