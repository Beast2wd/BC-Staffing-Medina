"""
Migration script to add tenant_id to all existing collections
Run this once to migrate existing data to multi-tenant architecture
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
import os
import uuid
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Default tenant for existing data
DEFAULT_TENANT = {
    "id": "tenant-medina-county",
    "name": "Medina County Fire Department",
    "subdomain": "medina",
    "status": "active",
    "settings": {
        "max_users": 500,
        "max_stations": 50,
        "features_enabled": ["staffing", "overtime", "volunteers", "deployments", "parttime"],
        "custom_branding": False,
        "logo_url": None,
        "primary_color": None
    },
    "admin_email": None,
    "created_at": datetime.now(timezone.utc).isoformat(),
    "is_active": True
}

# Collections that need tenant_id
COLLECTIONS_TO_MIGRATE = [
    "users",
    "personnel", 
    "stations",
    "battalions",
    "staffing_records",
    "apparatus_assignments",
    "overtime_records",
    "leave_records",
    "volunteers",
    "part_time_employees",
    "deployments",
    "user_notifications",
    "change_logs",
    "notifications",  # broadcast notifications
]


async def create_indexes():
    """Create indexes for tenant_id on all collections"""
    print("\n📇 Creating indexes...")
    for collection_name in COLLECTIONS_TO_MIGRATE:
        try:
            await db[collection_name].create_index("tenant_id")
            print(f"  ✓ Index created on {collection_name}.tenant_id")
        except Exception as e:
            print(f"  ⚠ Index on {collection_name}: {e}")
    
    # Compound indexes for common queries
    await db.users.create_index([("tenant_id", 1), ("payroll_number", 1)], unique=True)
    await db.personnel.create_index([("tenant_id", 1), ("payroll_number", 1)], unique=True)
    await db.stations.create_index([("tenant_id", 1), ("station_number", 1)], unique=True)
    print("  ✓ Compound indexes created")


async def migrate_collection(collection_name: str, tenant_id: str):
    """Add tenant_id to all documents in a collection"""
    collection = db[collection_name]
    
    # Count documents without tenant_id
    count = await collection.count_documents({"tenant_id": {"$exists": False}})
    
    if count == 0:
        print(f"  ✓ {collection_name}: Already migrated (0 documents)")
        return 0
    
    # Update all documents without tenant_id
    result = await collection.update_many(
        {"tenant_id": {"$exists": False}},
        {"$set": {"tenant_id": tenant_id}}
    )
    
    print(f"  ✓ {collection_name}: Migrated {result.modified_count} documents")
    return result.modified_count


async def create_default_tenant():
    """Create the default tenant for existing data"""
    existing = await db.tenants.find_one({"id": DEFAULT_TENANT["id"]})
    if existing:
        print(f"  ✓ Default tenant already exists: {DEFAULT_TENANT['name']}")
        return DEFAULT_TENANT["id"]
    
    await db.tenants.insert_one(DEFAULT_TENANT)
    print(f"  ✓ Created default tenant: {DEFAULT_TENANT['name']}")
    return DEFAULT_TENANT["id"]


async def create_super_admin():
    """Create a super admin user if not exists"""
    from auth import hash_password
    
    existing = await db.users.find_one({"role": "super_admin"})
    if existing:
        print(f"  ✓ Super admin already exists: {existing.get('payroll_number')}")
        return
    
    # Update the existing admin to be a super_admin
    result = await db.users.update_one(
        {"payroll_number": "100001"},
        {"$set": {"is_super_admin": True}}
    )
    
    if result.modified_count > 0:
        print("  ✓ Upgraded existing admin (100001) to super admin")
    else:
        # Create new super admin
        super_admin = {
            "id": str(uuid.uuid4()),
            "payroll_number": "000001",
            "password_hash": hash_password("superadmin123"),
            "name": "Super Admin",
            "rank": "System Administrator",
            "role": "super_admin",
            "is_super_admin": True,
            "tenant_id": None,  # Super admin is not tied to a tenant
            "is_active": True,
            "must_change_password": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(super_admin)
        print("  ✓ Created super admin: 000001 / superadmin123")


async def run_migration():
    """Run the full migration"""
    print("=" * 60)
    print("🚀 Starting Multi-Tenant Migration")
    print("=" * 60)
    
    # Step 1: Create tenants collection and default tenant
    print("\n📦 Step 1: Creating default tenant...")
    tenant_id = await create_default_tenant()
    
    # Step 2: Migrate all collections
    print("\n📦 Step 2: Migrating collections...")
    total_migrated = 0
    for collection_name in COLLECTIONS_TO_MIGRATE:
        try:
            count = await migrate_collection(collection_name, tenant_id)
            total_migrated += count
        except Exception as e:
            print(f"  ⚠ Error migrating {collection_name}: {e}")
    
    # Step 3: Create indexes
    await create_indexes()
    
    # Step 4: Create/upgrade super admin
    print("\n📦 Step 4: Setting up super admin...")
    await create_super_admin()
    
    # Summary
    print("\n" + "=" * 60)
    print("✅ Migration Complete!")
    print(f"   - Default tenant: {DEFAULT_TENANT['name']}")
    print(f"   - Subdomain: {DEFAULT_TENANT['subdomain']}")
    print(f"   - Documents migrated: {total_migrated}")
    print(f"   - Collections updated: {len(COLLECTIONS_TO_MIGRATE)}")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(run_migration())
