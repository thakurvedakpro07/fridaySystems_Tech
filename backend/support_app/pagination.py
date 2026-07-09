"""
Custom DRF pagination classes.
"""
from rest_framework.pagination import PageNumberPagination


class OpsPageNumberPagination(PageNumberPagination):
    """
    Page-number pagination for the Ops Ticket Queue with a caller-controlled
    page size (?page_size=), capped to prevent abuse. Default page_size (20)
    matches the prior global default exactly — a request that doesn't pass
    ?page_size= behaves identically to before this class existed.
    """
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100
