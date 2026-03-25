import { pool } from '../config/database.js';
import {
  CreateEmployeeInput,
  UpdateEmployeeInput,
  EmployeeQueryInput,
} from '../schemas/employeeSchema.js';
import { WebhookService, WEBHOOK_EVENTS } from './webhook.service.js';

export class EmployeeService {
  async create(data: CreateEmployeeInput, dbClient?: any) {
    const executor = dbClient || pool;
    const {
      organization_id,
      first_name,
      last_name,
      email,
      wallet_address,
      position,
      department,
      status,
      base_salary,
      base_currency,
      phone,
      address_line1,
      address_line2,
      city,
      state_province,
      postal_code,
      country,
      job_title,
      hire_date,
      date_of_birth,
      emergency_contact_name,
      emergency_contact_phone,
      withdrawal_preference,
      bank_name,
      bank_account_number,
      bank_routing_number,
      mobile_money_provider,
      mobile_money_account,
      notes,
    } = data;

    const query = `
      INSERT INTO employees (
        organization_id, first_name, last_name, email, wallet_address,
        position, department, status, base_salary, base_currency,
        phone, address_line1, address_line2, city, state_province,
        postal_code, country, job_title, hire_date, date_of_birth,
        emergency_contact_name, emergency_contact_phone,
        withdrawal_preference, bank_name, bank_account_number,
        bank_routing_number, mobile_money_provider, mobile_money_account,
        notes
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26, $27, $28, $29
      )
      RETURNING *;
    `;

    const values = [
      organization_id,
      first_name,
      last_name,
      email,
      wallet_address || null,
      position || null,
      department || null,
      status || 'active',
      base_salary || 0,
      base_currency || 'USDC',
      phone || null,
      address_line1 || null,
      address_line2 || null,
      city || null,
      state_province || null,
      postal_code || null,
      country || null,
      job_title || null,
      hire_date || null,
      date_of_birth || null,
      emergency_contact_name || null,
      emergency_contact_phone || null,
      withdrawal_preference || 'bank',
      bank_name || null,
      bank_account_number || null,
      bank_routing_number || null,
      mobile_money_provider || null,
      mobile_money_account || null,
      notes || null,
    ];

    const result = await executor.query(query, values);
    const employee = result.rows[0];

    EmployeeService.dispatchWebhook(organization_id, WEBHOOK_EVENTS.EMPLOYEE_ADDED, employee).catch(
      (err: any) => console.error('Failed to dispatch employee.added webhook:', err)
    );

    return employee;
  }

  private static async dispatchWebhook(
    organization_id: number,
    eventType: string,
    payload: any
  ): Promise<void> {
    try {
      await WebhookService.dispatch(eventType, organization_id, payload);
    } catch (error) {
      console.error(`Webhook dispatch failed for ${eventType}:`, error);
    }
  }

  async findAll(organization_id: number, params: EmployeeQueryInput) {
    const { page = 1, limit = 10, search, status, department } = params;
    const offset = (page - 1) * limit;

    let query = `
      SELECT *, count(*) OVER() as total_count
      FROM employees
      WHERE deleted_at IS NULL
    `;
    const values: (string | number)[] = [];
    let paramIndex = 1;

    if (organization_id) {
      query += ` AND organization_id = $${paramIndex++}`;
      values.push(organization_id);
    }

    if (status) {
      query += ` AND status = $${paramIndex++}`;
      values.push(status);
    }

    if (department) {
      query += ` AND department = $${paramIndex++}`;
      values.push(department);
    }

    if (search) {
      query += ` AND (
        first_name ILIKE $${paramIndex} OR
        last_name ILIKE $${paramIndex} OR
        email ILIKE $${paramIndex} OR
        position ILIKE $${paramIndex} OR
        job_title ILIKE $${paramIndex} OR
        phone ILIKE $${paramIndex}
      )`;
      values.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    values.push(limit, offset);

    const result = await pool.query(query, values);

    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;
    const employees = result.rows.map((row) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { total_count, ...employee } = row;
      return employee;
    });

    return {
      data: employees,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: number, organization_id: number) {
    const query = `
      SELECT * FROM employees
      WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL
    `;
    const result = await pool.query(query, [id, organization_id]);
    return result.rows[0] || null;
  }

  async update(id: number, organization_id: number, data: UpdateEmployeeInput) {
    const fields: string[] = [];
    const values: (string | number | null)[] = [];
    let paramIndex = 1;

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = $${paramIndex++}`);
        values.push(value);
      }
    });

    if (fields.length === 0) return null;

    values.push(id, organization_id);
    const query = `
      UPDATE employees
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex++} AND organization_id = $${paramIndex} AND deleted_at IS NULL
      RETURNING *;
    `;

    const result = await pool.query(query, values);
    const employee = result.rows[0] || null;

    if (employee) {
      EmployeeService.dispatchWebhook(
        organization_id,
        WEBHOOK_EVENTS.EMPLOYEE_UPDATED,
        employee
      ).catch((err: any) => console.error('Failed to dispatch employee.updated webhook:', err));
    }

    return employee;
  }

  async delete(id: number, organization_id: number) {
    const query = `
      UPDATE employees
      SET deleted_at = NOW(), status = 'inactive'
      WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL
      RETURNING *;
    `;
    const result = await pool.query(query, [id, organization_id]);
    const employee = result.rows[0] || null;

    if (employee) {
      EmployeeService.dispatchWebhook(
        organization_id,
        WEBHOOK_EVENTS.EMPLOYEE_DELETED,
        employee
      ).catch((err: any) => console.error('Failed to dispatch employee.deleted webhook:', err));
    }

    return employee;
  }
}

export const employeeService = new EmployeeService();
