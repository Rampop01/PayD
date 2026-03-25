import { Router } from 'express';
import { employeeController } from '../controllers/employeeController.js';
import authenticateJWT from '../middlewares/auth.js';
import { authorizeRoles, isolateOrganization } from '../middlewares/rbac.js';
import { requireTenantContext } from '../middleware/tenantContext.js';
import { require2FAIfWalletUpdate } from '../middlewares/require2faIfWalletUpdate.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Employees
 *   description: Employee management
 */

// Apply authentication to all employee routes
router.use(authenticateJWT);
// Enforce tenant context for all employee routes
router.use(requireTenantContext);

/**
 * @swagger
 * /api/employees:
 *   post:
 *     summary: Create a new employee
 *     tags: [Employees]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Created
 */
router.post(
  '/',
  authorizeRoles('EMPLOYER'),
  isolateOrganization,
  employeeController.create.bind(employeeController)
);

/**
 * @swagger
 * /api/employees:
 *   get:
 *     summary: Get all employees
 *     tags: [Employees]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/',
  authorizeRoles('EMPLOYER'),
  isolateOrganization,
  employeeController.getAll.bind(employeeController)
);

/**
 * @swagger
 * /api/employees/{id}:
 *   get:
 *     summary: Get a single employee
 *     tags: [Employees]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/:id',
  authorizeRoles('EMPLOYER', 'EMPLOYEE'),
  isolateOrganization,
  employeeController.getOne.bind(employeeController)
);

/**
 * @swagger
 * /api/employees/{id}:
 *   patch:
 *     summary: Update an employee
 *     tags: [Employees]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.patch(
  '/:id',
  authorizeRoles('EMPLOYER'),
  isolateOrganization,
  require2FAIfWalletUpdate,
  employeeController.update.bind(employeeController)
);

/**
 * @swagger
 * /api/employees/{id}:
 *   delete:
 *     summary: Delete an employee
 *     tags: [Employees]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.delete(
  '/:id',
  authorizeRoles('EMPLOYER'),
  isolateOrganization,
  employeeController.delete.bind(employeeController)
);

/**
 * @swagger
 * /api/employees/bulk-import:
 *   post:
 *     summary: Bulk import employees from CSV
 *     tags: [Employees]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
import { bulkImportController } from '../controllers/bulkImportController.js';
router.post('/bulk-import', bulkImportController.import.bind(bulkImportController));

export default router;
