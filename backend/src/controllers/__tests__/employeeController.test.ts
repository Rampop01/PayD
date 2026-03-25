import request from 'supertest';
import express from 'express';

// Mock env config before importing routes
jest.mock('../../config/env', () => ({
  config: {
    DATABASE_URL: 'postgres://mock',
    PORT: 3000,
    JWT_SECRET: 'test-secret',
  },
}));

// Mock auth and rbac middleware to passthrough
jest.mock('../../middlewares/auth', () => ({
  __esModule: true,
  default: (_req: any, _res: any, next: any) => {
    _req.user = { id: 1, organizationId: 1, role: 'EMPLOYER' };
    next();
  },
}));

jest.mock('../../middlewares/rbac', () => ({
  authorizeRoles: () => (_req: any, _res: any, next: any) => next(),
  isolateOrganization: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../middleware/tenantContext', () => ({
  requireTenantContext: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../middlewares/require2faIfWalletUpdate', () => ({
  require2FAIfWalletUpdate: (_req: any, _res: any, next: any) => next(),
}));

// Mock the employee service
jest.mock('../../services/employeeService');

import employeeRoutes from '../../routes/employeeRoutes.js';
import { employeeService } from '../../services/employeeService.js';

const app = express();
app.use(express.json());
app.use('/api/employees', employeeRoutes);

describe('EmployeeController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/employees', () => {
    const validEmployeeData = {
      organization_id: 1,
      first_name: 'John',
      last_name: 'Doe',
      email: 'john.doe@example.com',
      status: 'active',
    };

    it('should create an employee successfully', async () => {
      const mockCreatedEmployee = { id: 1, ...validEmployeeData };
      (employeeService.create as jest.Mock).mockResolvedValue(mockCreatedEmployee);

      const response = await request(app)
        .post('/api/employees')
        .send(validEmployeeData)
        .expect(201);

      expect(response.body).toEqual(mockCreatedEmployee);
      expect(employeeService.create).toHaveBeenCalledWith(
        expect.objectContaining({ first_name: 'John', last_name: 'Doe' })
      );
    });

    it('should create an employee with full profile data', async () => {
      const fullData = {
        ...validEmployeeData,
        phone: '+1234567890',
        job_title: 'Software Engineer',
        hire_date: '2024-01-15',
        date_of_birth: '1990-06-20',
        address_line1: '123 Main St',
        city: 'San Francisco',
        state_province: 'CA',
        postal_code: '94102',
        country: 'US',
        emergency_contact_name: 'Jane Doe',
        emergency_contact_phone: '+0987654321',
        withdrawal_preference: 'bank',
        bank_name: 'Chase Bank',
        bank_account_number: '123456789',
        bank_routing_number: '021000021',
        notes: 'Senior hire',
      };
      const mockCreated = { id: 2, ...fullData };
      (employeeService.create as jest.Mock).mockResolvedValue(mockCreated);

      const response = await request(app)
        .post('/api/employees')
        .send(fullData)
        .expect(201);

      expect(response.body.phone).toBe('+1234567890');
      expect(response.body.job_title).toBe('Software Engineer');
      expect(response.body.bank_name).toBe('Chase Bank');
    });

    it('should return 400 for invalid data', async () => {
      const invalidData = { first_name: 'John' }; // Missing required fields

      const response = await request(app).post('/api/employees').send(invalidData).expect(400);

      expect(response.body).toHaveProperty('error', 'Validation Error');
      expect(employeeService.create).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid email format', async () => {
      const badEmail = { ...validEmployeeData, email: 'not-an-email' };

      const response = await request(app).post('/api/employees').send(badEmail).expect(400);

      expect(response.body).toHaveProperty('error', 'Validation Error');
    });

    it('should return 400 for invalid date format', async () => {
      const badDate = { ...validEmployeeData, hire_date: '01-15-2024' };

      const response = await request(app).post('/api/employees').send(badDate).expect(400);

      expect(response.body).toHaveProperty('error', 'Validation Error');
    });

    it('should return 400 for invalid withdrawal_preference', async () => {
      const badPref = { ...validEmployeeData, withdrawal_preference: 'cash' };

      const response = await request(app).post('/api/employees').send(badPref).expect(400);

      expect(response.body).toHaveProperty('error', 'Validation Error');
    });
  });

  describe('GET /api/employees', () => {
    it('should return paginated employees', async () => {
      const mockResult = {
        data: [{ id: 1, first_name: 'John' }],
        pagination: { total: 1, page: 1, limit: 10, totalPages: 1 },
      };
      (employeeService.findAll as jest.Mock).mockResolvedValue(mockResult);

      const response = await request(app).get('/api/employees?page=1&limit=10').expect(200);

      expect(response.body).toEqual(mockResult);
    });
  });

  describe('GET /api/employees/:id', () => {
    it('should return employee by ID with profile fields', async () => {
      const mockEmployee = {
        id: 1,
        first_name: 'John',
        job_title: 'Engineer',
        phone: '+1234567890',
        withdrawal_preference: 'bank',
        bank_name: 'Chase',
      };
      (employeeService.findById as jest.Mock).mockResolvedValue(mockEmployee);

      const response = await request(app).get('/api/employees/1').expect(200);

      expect(response.body).toEqual(mockEmployee);
      expect(response.body.job_title).toBe('Engineer');
      expect(response.body.withdrawal_preference).toBe('bank');
    });

    it('should return 404 if employee not found', async () => {
      (employeeService.findById as jest.Mock).mockResolvedValue(null);

      await request(app).get('/api/employees/999').expect(404);
    });

    it('should return 400 for invalid ID', async () => {
      await request(app).get('/api/employees/abc').expect(400);
    });
  });

  describe('PATCH /api/employees/:id', () => {
    it('should update employee profile fields', async () => {
      const updateData = {
        phone: '+9876543210',
        job_title: 'Senior Engineer',
        withdrawal_preference: 'mobile_money',
        mobile_money_provider: 'M-Pesa',
      };
      const mockUpdated = { id: 1, ...updateData };
      (employeeService.update as jest.Mock).mockResolvedValue(mockUpdated);

      const response = await request(app).patch('/api/employees/1').send(updateData).expect(200);

      expect(response.body).toEqual(mockUpdated);
      expect(response.body.job_title).toBe('Senior Engineer');
      expect(response.body.withdrawal_preference).toBe('mobile_money');
    });

    it('should return 404 if employee not found', async () => {
      (employeeService.update as jest.Mock).mockResolvedValue(null);

      await request(app)
        .patch('/api/employees/999')
        .send({ first_name: 'Test' })
        .expect(404);
    });
  });

  describe('DELETE /api/employees/:id', () => {
    it('should delete employee successfully', async () => {
      (employeeService.delete as jest.Mock).mockResolvedValue({ id: 1 });

      await request(app).delete('/api/employees/1').expect(204);
    });

    it('should return 404 if employee not found', async () => {
      (employeeService.delete as jest.Mock).mockResolvedValue(null);

      await request(app).delete('/api/employees/999').expect(404);
    });
  });
});
