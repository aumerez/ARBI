/**
 * Mock PostgreSQL Service for testing database operations
 * Simulates Prisma-like interface with RLS context enforcement
 */

export class MockPostgresService {
  private tenants: Map<number, any[]> = new Map();
  private currentTenantId: number | null = null;

  constructor() {
    // Initialize with test data
    this.seed();
  }

  private seed(): void {
    const testUsers = [
      { id: 1, tenant_id: 1, email: 'user1@tenant1.com', created_at: new Date().toISOString() },
      { id: 2, tenant_id: 1, email: 'user2@tenant1.com', created_at: new Date().toISOString() },
      { id: 3, tenant_id: 2, email: 'user1@tenant2.com', created_at: new Date().toISOString() },
    ];
    this.tenants.set(1, testUsers.filter(u => u.tenant_id === 1));
    this.tenants.set(2, testUsers.filter(u => u.tenant_id === 2));
  }

  /**
   * Set the current tenant context (simulates SET app.current_tenant)
   * This enforces RLS-like behavior in tests
   */
  setTenantContext(tenantId: number): void {
    this.currentTenantId = tenantId;
    console.log(`MockPostgres: Set tenant context to ${tenantId}`);
  }

  /**
   * Clear tenant context (simulates end of request)
   */
  clearTenantContext(): void {
    this.currentTenantId = null;
    console.log(`MockPostgres: Cleared tenant context`);
  }

  /**
   * Simulate a database query with automatic RLS filtering
   * Throws error if tenant context not set (mimics RLS policy violation)
   */
  async query(table: string, filters?: any): Promise<any[]> {
    if (!this.currentTenantId) {
      throw new Error('Tenant context not set - RLS violation would occur in production');
    }

    let data = this.tenants.get(this.currentTenantId) || [];

    // For tables other than users, return empty for now (expand as tests need)
    if (table !== 'users') {
      data = [];
    }

    // Apply additional filters if provided
    if (filters) {
      data = data.filter(row => {
        return Object.entries(filters).every(([key, value]) => row[key] === value);
      });
    }

    return data;
  }

  /**
   * Insert a record with automatic tenant_id enforcement
   */
  async insert(table: string, record: any): Promise<any> {
    if (!this.currentTenantId) {
      throw new Error('Tenant context not set');
    }

    record.tenant_id = this.currentTenantId;
    record.id = Math.floor(Math.random() * 10000);
    record.created_at = new Date().toISOString();
    record.updated_at = new Date().toISOString();

    const existing = this.tenants.get(this.currentTenantId) || [];
    existing.push(record);
    this.tenants.set(this.currentTenantId, existing);

    console.log(`MockPostgres: Inserted into ${table} with id ${record.id}`);
    return record;
  }

  /**
   * Update a record (ensures tenant isolation)
   */
  async update(table: string, id: number, updates: any): Promise<any | null> {
    if (!this.currentTenantId) {
      throw new Error('Tenant context not set');
    }

    const data = this.tenants.get(this.currentTenantId) || [];
    const index = data.findIndex(row => row.id === id);

    if (index === -1) {
      return null;
    }

    data[index] = { ...data[index], ...updates, updated_at: new Date().toISOString() };
    this.tenants.set(this.currentTenantId, data);

    console.log(`MockPostgres: Updated ${table} id ${id}`);
    return data[index];
  }

  /**
   * Delete a record (soft delete pattern)
   */
  async delete(table: string, id: number): Promise<boolean> {
    if (!this.currentTenantId) {
      throw new Error('Tenant context not set');
    }

    const data = this.tenants.get(this.currentTenantId) || [];
    const index = data.findIndex(row => row.id === id);

    if (index === -1) {
      return false;
    }

    // Soft delete: mark as deleted but keep record
    data[index].deleted_at = new Date().toISOString();
    this.tenants.set(this.currentTenantId, data);

    console.log(`MockPostgres: Soft deleted ${table} id ${id}`);
    return true;
  }

  /**
   * Verify tenant isolation - ensures RLS is working correctly
   * Tests that switching tenant context prevents cross-tenant data access
   */
  async verifyIsolation(
    tenantIdA: number,
    tenantIdB: number
  ): Promise<{ aSeesOnlyOwn: boolean; bSeesOnlyOwn: boolean }> {
    // Check tenant A's data visibility
    this.setTenantContext(tenantIdA);
    const aData = await this.query('users', { tenant_id: tenantIdA });

    // Switch to tenant B and verify tenant A's data is not visible
    this.setTenantContext(tenantIdB);
    const bData = await this.query('users', { tenant_id: tenantIdB });

    const aSeesOnlyOwn = aData.every(u => u.tenant_id === tenantIdA);
    const bSeesOnlyOwn = bData.every(u => u.tenant_id === tenantIdB);

    // Restore tenant A context
    this.setTenantContext(tenantIdA);

    return { aSeesOnlyOwn, bSeesOnlyOwn };
  }

  /**
   * Add test data for a tenant (helper for tests)
   */
  addTestData(tenantId: number, records: any[]): void {
    if (!this.tenants.has(tenantId)) {
      this.tenants.set(tenantId, []);
    }
    const existing = this.tenants.get(tenantId)!;
    records.forEach(record => {
      record.tenant_id = tenantId;
      existing.push(record);
    });
    console.log(`MockPostgres: Added ${records.length} test records to tenant ${tenantId}`);
  }
}
