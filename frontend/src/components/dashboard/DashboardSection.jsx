import Card from "../ui/Card";

// Reusable "white card + title + optional view-all link" wrapper —
// consolidates the pattern that used to be hand-rolled inline in
// OpsDashboard.jsx's "Unassigned Open Tickets" card and duplicated as
// AdminDashboard.jsx's local SectionHeader. Now a thin wrapper around the
// shared ui/Card primitive so section chrome and sidebar-card chrome share
// one definition.
export default function DashboardSection({ title, description, viewAllTo, viewAllLabel = "View all", children, className = "" }) {
  return (
    <Card header={title} description={description} viewAllTo={viewAllTo} viewAllLabel={viewAllLabel} className={className}>
      {children}
    </Card>
  );
}
