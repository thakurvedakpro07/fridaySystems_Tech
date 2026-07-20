import AppShell from "../components/layout/AppShell";
import TicketWizard from "../components/tickets/TicketWizard";
import PageHeader from "../components/ui/PageHeader";
import { usePageTitle } from "../hooks/usePageTitle";

export default function NewTicket() {
  usePageTitle("Open a Ticket");

  return (
    <AppShell maxWidth="max-w-xl">
      <div className="mb-6">
        <PageHeader
          title="Open a Support Ticket"
          description="Describe your issue and a Support Agent will contact you within your chosen response window."
        />
      </div>
      <TicketWizard />
    </AppShell>
  );
}
