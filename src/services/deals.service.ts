import { pool } from "../plugins/pg";
import { Patch } from "../utils/patch";
import { apiErrors } from "../utils/apiErrors";
import { buildSet } from "../utils/sql";

export type DealStage = "new" | "in_progress" | "won" | "lost";

export interface IDealFields {
  title: string;
  contact_id: number;
  amount: number | null;
  stage: DealStage;
  notes: string | null;
}

// сделку можно привязать только к своему контакту
const assertOwnContact = async (contactId: number, userId: number) => {
  const result = await pool.query(
    `select 1 from contacts where id = $1 and user_id = $2`,
    [contactId, userId],
  );

  if (!result.rows[0]) throw apiErrors.badRequest("Contact not found");
};

export const postDealService = async (
  body: Pick<IDealFields, "title" | "contact_id"> & Patch<IDealFields>,
  userId: number,
) => {
  await assertOwnContact(body.contact_id, userId);

  const result = await pool.query(
    `
      insert into deals (title, contact_id, amount, stage, notes, user_id)
      values ($1, $2, $3, coalesce($4, 'new'), $5, $6)
      returning *
    `,
    [
      body.title,
      body.contact_id,
      body.amount ?? null,
      body.stage ?? null,
      body.notes || null,
      userId,
    ],
  );

  return result.rows[0];
};

export const getDealsService = async (userId: number) => {
  const result = await pool.query(
    `select * from deals where user_id = $1 order by created_at desc`,
    [userId],
  );

  return result.rows;
};

export const getOneDealService = async (id: number, userId: number) => {
  const result = await pool.query(
    `select * from deals where id = $1 and user_id = $2`,
    [id, userId],
  );

  return result.rows[0];
};

export const deleteDealService = async (id: number, userId: number) => {
  const result = await pool.query(
    `delete from deals where id = $1 and user_id = $2 returning *`,
    [id, userId],
  );

  return result.rows[0];
};

// раньше пропущенное поле amount затирало сумму — теперь undefined = "не трогать"
export const updateDealService = async (
  id: number,
  changes: Patch<IDealFields>,
  userId: number,
) => {
  if (changes.contact_id !== undefined) {
    await assertOwnContact(changes.contact_id, userId);
  }

  const { columns, values } = buildSet(
    {
      title: changes.title,
      contact_id: changes.contact_id,
      amount: changes.amount,
      stage: changes.stage,
      notes: changes.notes === undefined ? undefined : changes.notes || null,
    },
    1,
  );

  if (columns.length === 0) return getOneDealService(id, userId);

  const result = await pool.query(
    `
      update deals
      set ${columns.join(", ")}, updated_at = now()
      where id = $${values.length + 1} and user_id = $${values.length + 2}
      returning *
    `,
    [...values, id, userId],
  );

  return result.rows[0];
};

export const updateDealStageService = async (
  id: number,
  stage: DealStage,
  userId: number,
) => {
  const result = await pool.query(
    `
      update deals
      set stage = $1, updated_at = now()
      where id = $2 and user_id = $3
      returning *
    `,
    [stage, id, userId],
  );

  return result.rows[0];
};
