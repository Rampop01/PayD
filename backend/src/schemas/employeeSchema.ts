import { z } from 'zod';

const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
  .optional();

export const createEmployeeSchema = z.object({
  organization_id: z.number().int().positive(),
  first_name: z.string().min(1, 'First name is required').max(100),
  last_name: z.string().min(1, 'Last name is required').max(100),
  email: z.string().email('Invalid email address'),
  wallet_address: z.string().max(56).optional(),
  position: z.string().max(100).optional(),
  department: z.string().max(100).optional(),
  status: z.enum(['active', 'inactive', 'pending']).optional().default('active'),
  base_salary: z.number().nonnegative().optional().default(0),
  base_currency: z.string().max(12).optional().default('USDC'),

  // Profile: contact information
  phone: z.string().max(20).optional(),
  address_line1: z.string().max(255).optional(),
  address_line2: z.string().max(255).optional(),
  city: z.string().max(100).optional(),
  state_province: z.string().max(100).optional(),
  postal_code: z.string().max(20).optional(),
  country: z.string().max(100).optional(),

  // Profile: employment details
  job_title: z.string().max(100).optional(),
  hire_date: dateStringSchema,
  date_of_birth: dateStringSchema,

  // Profile: emergency contact
  emergency_contact_name: z.string().max(200).optional(),
  emergency_contact_phone: z.string().max(20).optional(),

  // Profile: withdrawal preferences (anchor integration)
  withdrawal_preference: z
    .enum(['bank', 'mobile_money', 'crypto'])
    .optional()
    .default('bank'),
  bank_name: z.string().max(100).optional(),
  bank_account_number: z.string().max(50).optional(),
  bank_routing_number: z.string().max(50).optional(),
  mobile_money_provider: z.string().max(50).optional(),
  mobile_money_account: z.string().max(50).optional(),

  // Profile: notes
  notes: z.string().optional(),
});

export const updateEmployeeSchema = createEmployeeSchema.partial().omit({ organization_id: true });

export const employeeQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional().default('1' as any),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default('10' as any),
  search: z.string().optional(),
  status: z.enum(['active', 'inactive', 'pending']).optional(),
  department: z.string().optional(),
  organization_id: z.string().regex(/^\d+$/).transform(Number).optional(),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type EmployeeQueryInput = z.infer<typeof employeeQuerySchema>;
