"""
Tenant helper functions for multi-tenant queries
"""

def get_tenant_filter(current_user: dict) -> dict:
    """Get the tenant_id filter dict from current user context"""
    tenant_id = current_user.get("_tenant_id") or current_user.get("tenant_id")
    if tenant_id:
        return {"tenant_id": tenant_id}
    return {}


def get_tenant_id(current_user: dict) -> str:
    """Get the tenant_id from current user context"""
    return current_user.get("_tenant_id") or current_user.get("tenant_id")


def add_tenant_to_query(query: dict, current_user: dict) -> dict:
    """Add tenant_id to an existing query dict"""
    tenant_id = get_tenant_id(current_user)
    if tenant_id:
        query["tenant_id"] = tenant_id
    return query


def add_tenant_to_doc(doc: dict, current_user: dict) -> dict:
    """Add tenant_id to a document before inserting"""
    tenant_id = get_tenant_id(current_user)
    if tenant_id:
        doc["tenant_id"] = tenant_id
    return doc
