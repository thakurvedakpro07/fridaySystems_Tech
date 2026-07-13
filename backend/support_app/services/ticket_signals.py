"""
Shared queryset annotations for ticket "who does the ball sit with" signals.

Both the freelancer's own queue (FreelancerTicketListView) and the
customer-facing queue (TicketListCreateView) need to know, per ticket,
whether the customer or the engineer owns the next reply. These are facts
about the ticket, not about the viewer, so the same annotations back both
FreelancerTicketListSerializer and CustomerTicketListSerializer's
waiting_on_customer / awaiting_engineer_reply / waiting_on_internal /
last_public_comment_at fields (see serializers.py: ReplyOwnershipSignalsMixin).
"""
from django.db.models import OuterRef, QuerySet, Subquery

from ..models import TicketActivityLog, TicketComment


def annotate_reply_ownership_signals(queryset: QuerySet) -> QuerySet:
    """
    Annotates a Ticket queryset with:
      _latest_public_comment_role      — role of the author of the most
                                          recent non-internal TicketComment
      _latest_public_comment_at        — that comment's created_at
      _latest_relevant_activity_action — action of the most recent
                                          TicketActivityLog row among
                                          {escalated, comment_added, status_changed}

    Pulled out of FreelancerTicketListView.get_queryset so the
    customer-facing queue can compute the same signals without duplicating
    the Subquery logic.
    """
    latest_public_comment = TicketComment.objects.filter(
        ticket=OuterRef("pk"), is_internal=False
    ).order_by("-created_at")
    return queryset.annotate(
        _latest_public_comment_role=Subquery(latest_public_comment.values("author__role")[:1]),
        _latest_public_comment_at=Subquery(latest_public_comment.values("created_at")[:1]),
        _latest_relevant_activity_action=Subquery(
            TicketActivityLog.objects.filter(
                ticket=OuterRef("pk"),
                action__in=["escalated", "comment_added", "status_changed"],
            ).order_by("-created_at").values("action")[:1]
        ),
    )
