// Single source of truth for notification category icon/colour metadata —
// previously duplicated byte-for-byte between NotificationBell.jsx and
// NotificationsPage.jsx. Colour/ring classes are unchanged from that prior
// duplication; only the glyph moved from raw emoji to the shared SVG icon set.
import {
  TicketIcon,
  SuccessCheckIcon,
  ChatBubbleIcon,
  ArrowsPathIcon,
  WarningTriangleIcon,
  CreditCardIcon,
  BellIcon,
} from "../tickets/ActionIcons";

export const CATEGORY_META = {
  ticket_assigned:   { Icon: TicketIcon,          colour: "bg-indigo-100 text-indigo-700",  ring: "ring-indigo-200" },
  ticket_resolved:   { Icon: SuccessCheckIcon,    colour: "bg-emerald-100 text-emerald-700", ring: "ring-emerald-200" },
  comment_added:     { Icon: ChatBubbleIcon,      colour: "bg-slate-100 text-slate-600",     ring: "ring-slate-200" },
  status_changed:    { Icon: ArrowsPathIcon,      colour: "bg-amber-100 text-amber-700",     ring: "ring-amber-200" },
  sla_breach:        { Icon: WarningTriangleIcon, colour: "bg-red-100 text-red-700",         ring: "ring-red-200" },
  payment_confirmed: { Icon: CreditCardIcon,      colour: "bg-teal-100 text-teal-700",       ring: "ring-teal-200" },
};

export const DEFAULT_CATEGORY_META = {
  Icon: BellIcon,
  colour: "bg-slate-100 text-slate-600",
  ring: "ring-slate-200",
};
