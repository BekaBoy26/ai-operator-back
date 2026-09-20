import { pool } from "../plugins/pg";
import { Patch } from "../utils/patch";
import { buildSet } from "../utils/sql";

export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high";

export interface ITaskFields {
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
}

// "" -> null: пустая дата/описание значат "очистить"
const emptyToNull = (value: string | null | undefined) =>
  value === undefined ? undefined : value && value.trim() ? value : null;

export const postTaskService = async (
  body: Pick<ITaskFields, "title"> & Patch<ITaskFields>,
  userId: number,
) => {
  const result = await pool.query(
    `
      insert into tasks (title, description, status, priority, due_date, user_id)
      values ($1, $2, coalesce($3, 'todo'), coalesce($4, 'medium'), $5, $6)
      returning *
    `,
    [
      body.title,
      emptyToNull(body.description) ?? null,
      body.status ?? null,
      body.priority ?? null,
      emptyToNull(body.due_date) ?? null,
      userId,
    ],
  );

  return result.rows[0];
};

export const getTasksService = async (userId: number, status?: string) => {
  const hasStatus = Boolean(status && status.trim());

  const result = await pool.query(
    `
      select * from tasks
      where user_id = $1 ${hasStatus ? "and status = $2" : ""}
      order by created_at desc
    `,
    hasStatus ? [userId, status!.trim()] : [userId],
  );

  return result.rows;
};

export const getOneTaskService = async (id: number, userId: number) => {
  const result = await pool.query(
    `select * from tasks where id = $1 and user_id = $2`,
    [id, userId],
  );

  return result.rows[0];
};

export const deleteTaskService = async (id: number, userId: number) => {
  const result = await pool.query(
    `delete from tasks where id = $1 and user_id = $2 returning *`,
    [id, userId],
  );

  return result.rows[0];
};

// раньше пропущенные description и due_date затирались — теперь меняем только присланное
export const updateTaskService = async (
  id: number,
  changes: Patch<ITaskFields>,
  userId: number,
) => {
  const { columns, values } = buildSet(
    {
      title: changes.title,
      description: emptyToNull(changes.description),
      status: changes.status,
      priority: changes.priority,
      due_date: emptyToNull(changes.due_date),
    },
    1,
  );

  if (columns.length === 0) return getOneTaskService(id, userId);

  const result = await pool.query(
    `
      update tasks
      set ${columns.join(", ")}, updated_at = now()
      where id = $${values.length + 1} and user_id = $${values.length + 2}
      returning *
    `,
    [...values, id, userId],
  );

  return result.rows[0];
};

export const updateTaskStatusService = async (
  id: number,
  status: TaskStatus,
  userId: number,
) => {
  const result = await pool.query(
    `
      update tasks
      set status = $1, updated_at = now()
      where id = $2 and user_id = $3
      returning *
    `,
    [status, id, userId],
  );

  return result.rows[0];
};
