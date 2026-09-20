import { pool } from "../plugins/pg";
import { Patch } from "../utils/patch";
import { buildSet, likePattern } from "../utils/sql";

interface INoteBody {
  title: string;
  content: string;
}

export const postNoteService = async (body: INoteBody, userId: number) => {
  const result = await pool.query(
    `
      insert into notes (title, content, user_id)
      values ($1, $2, $3)
      returning *
    `,
    [body.title, body.content, userId],
  );

  return result.rows[0];
};

export const getNotesService = async (userId: number, search?: string) => {
  const hasSearch = Boolean(search && search.trim());

  const result = await pool.query(
    `
      select * from notes
      where user_id = $1
      ${hasSearch ? `and (title ilike $2 escape '\\' or content ilike $2 escape '\\')` : ""}
      order by created_at desc
    `,
    hasSearch ? [userId, likePattern(search!)] : [userId],
  );

  return result.rows;
};

export const getOneNoteService = async (id: number, userId: number) => {
  const result = await pool.query(
    `select * from notes where id = $1 and user_id = $2`,
    [id, userId],
  );

  return result.rows[0];
};

export const deleteNoteService = async (id: number, userId: number) => {
  const result = await pool.query(
    `delete from notes where id = $1 and user_id = $2 returning *`,
    [id, userId],
  );

  return result.rows[0];
};

// частичное обновление: не присланные поля не трогаем
export const updateNoteService = async (
  id: number,
  changes: Patch<INoteBody>,
  userId: number,
) => {
  const { columns, values } = buildSet({ title: changes.title, content: changes.content }, 1);
  if (columns.length === 0) return getOneNoteService(id, userId);

  const result = await pool.query(
    `
      update notes
      set ${columns.join(", ")}, updated_at = now()
      where id = $${values.length + 1} and user_id = $${values.length + 2}
      returning *
    `,
    [...values, id, userId],
  );

  return result.rows[0];
};

// "избранное" не меняет дату редактирования заметки
export const toggleFavoriteService = async (id: number, userId: number) => {
  const result = await pool.query(
    `
      update notes
      set is_favorite = not is_favorite
      where id = $1 and user_id = $2
      returning *
    `,
    [id, userId],
  );

  return result.rows[0];
};
