import { pool } from "../plugins/pg";
import { Patch } from "../utils/patch";
import { buildSet, likePattern } from "../utils/sql";

export interface IContactFields {
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  notes: string | null;
}

// "" -> null, undefined = не менять
const emptyToNull = (value: string | null | undefined) =>
  value === undefined ? undefined : value && value.trim() ? value.trim() : null;

export const postContactService = async (
  body: Pick<IContactFields, "name"> & Patch<IContactFields>,
  userId: number,
) => {
  const result = await pool.query(
    `
      insert into contacts (name, email, phone, company, notes, user_id)
      values ($1, $2, $3, $4, $5, $6)
      returning *
    `,
    [
      body.name.trim(),
      emptyToNull(body.email) ?? null,
      emptyToNull(body.phone) ?? null,
      emptyToNull(body.company) ?? null,
      emptyToNull(body.notes) ?? null,
      userId,
    ],
  );

  return result.rows[0];
};

export const getContactsService = async (userId: number, search?: string) => {
  const hasSearch = Boolean(search && search.trim());

  const result = await pool.query(
    `
      select * from contacts
      where user_id = $1
      ${
        hasSearch
          ? `and (name ilike $2 escape '\\' or company ilike $2 escape '\\' or email ilike $2 escape '\\')`
          : ""
      }
      order by created_at desc
    `,
    hasSearch ? [userId, likePattern(search!)] : [userId],
  );

  return result.rows;
};

export const getOneContactService = async (id: number, userId: number) => {
  const result = await pool.query(
    `select * from contacts where id = $1 and user_id = $2`,
    [id, userId],
  );

  return result.rows[0];
};

export const deleteContactService = async (id: number, userId: number) => {
  const result = await pool.query(
    `delete from contacts where id = $1 and user_id = $2 returning *`,
    [id, userId],
  );

  return result.rows[0];
};

export const updateContactService = async (
  id: number,
  changes: Patch<IContactFields>,
  userId: number,
) => {
  const { columns, values } = buildSet(
    {
      name: changes.name?.trim(),
      email: emptyToNull(changes.email),
      phone: emptyToNull(changes.phone),
      company: emptyToNull(changes.company),
      notes: emptyToNull(changes.notes),
    },
    1,
  );

  if (columns.length === 0) return getOneContactService(id, userId);

  const result = await pool.query(
    `
      update contacts
      set ${columns.join(", ")}, updated_at = now()
      where id = $${values.length + 1} and user_id = $${values.length + 2}
      returning *
    `,
    [...values, id, userId],
  );

  return result.rows[0];
};
