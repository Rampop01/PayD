import { Router } from 'express';
import searchController from '../controllers/searchController';
import { authenticateJWT } from '../middlewares/auth';
import { isolateOrganization } from '../middlewares/rbac';
import { requireTenantContext } from '../middleware/tenantContext';

const router = Router();

// Apply global authentication and isolation to all search routes
router.use(authenticateJWT);
router.use(isolateOrganization);

/**
 * @route GET /api/search/organizations/:organizationId/employees
 * @desc Search and filter employees
 */
router.get(
  '/organizations/:organizationId/employees',
  requireTenantContext,
  searchController.searchEmployees.bind(searchController)
);

/**
 * @route GET /api/search/organizations/:organizationId/transactions
 * @desc Search and filter transactions
 */
router.get(
  '/organizations/:organizationId/transactions',
  requireTenantContext,
  searchController.searchTransactions.bind(searchController)
);

export default router;
