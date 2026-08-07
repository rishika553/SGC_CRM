-- =============================================================================
-- Enterprise Consulting CRM Platform - Supabase Row Level Security (RLS) Policies
-- =============================================================================

-- Enable Row Level Security on all core tables
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 1. ROLES TABLE POLICIES
-- -----------------------------------------------------------------------------
-- All authenticated users can view system roles
CREATE POLICY "Allow authenticated users to view roles"
ON roles FOR SELECT
TO authenticated
USING (is_deleted = false);

-- Only Super Admin can modify system roles
CREATE POLICY "Allow super admin to manage roles"
ON roles FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = auth.uid() AND r.name = 'super_admin'
  )
);

-- -----------------------------------------------------------------------------
-- 2. ORGANIZATIONS TABLE POLICIES
-- -----------------------------------------------------------------------------
-- Users can view their own organization details
CREATE POLICY "Allow users to view their organization"
ON organizations FOR SELECT
TO authenticated
USING (
  is_deleted = false AND (
    id IN (SELECT organization_id FROM users WHERE id = auth.uid()) OR
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid() AND r.name IN ('super_admin', 'firm_admin')
    )
  )
);

-- -----------------------------------------------------------------------------
-- 3. USERS TABLE POLICIES
-- -----------------------------------------------------------------------------
-- Users can view their own record and colleagues within their organization
CREATE POLICY "Allow users to view self and organization colleagues"
ON users FOR SELECT
TO authenticated
USING (
  is_deleted = false AND (
    id = auth.uid() OR
    organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()) OR
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid() AND r.name IN ('super_admin', 'firm_admin')
    )
  )
);

-- Users can update their own non-role profile fields
CREATE POLICY "Allow users to update their own profile"
ON users FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Administrators can insert, update, and soft-delete user records
CREATE POLICY "Allow admins full management of users"
ON users FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = auth.uid() AND r.name IN ('super_admin', 'firm_admin')
  )
);

-- -----------------------------------------------------------------------------
-- 4. AUDIT LOGS TABLE POLICIES
-- -----------------------------------------------------------------------------
-- Admins can view audit logs for compliance
CREATE POLICY "Allow admins to view system audit logs"
ON audit_logs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = auth.uid() AND r.name IN ('super_admin', 'firm_admin')
  )
);
