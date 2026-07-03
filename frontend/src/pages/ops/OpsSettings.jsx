import AppShell from "../../components/layout/AppShell";
import { usePageTitle } from "../../hooks/usePageTitle";

export default function OpsSettings() {
  usePageTitle("Platform Settings — ResolveHQ");

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-slate-800">Platform Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Super Admin configuration for platform-wide settings.</p>
        <div className="mt-8 bg-white border border-slate-200 rounded-xl p-6 text-slate-500 text-sm">
          Platform settings coming soon.
        </div>
      </div>
    </AppShell>
  );
}
