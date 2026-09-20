// частичное обновление: в SET попадают только поля, которые реально переданы
// (undefined = "не трогать", null = "очистить"). Имена колонок задаёт код, не клиент.
export const buildSet = (fields: Record<string, unknown>, firstParamIndex: number) => {
  const columns: string[] = [];
  const values: unknown[] = [];

  for (const [column, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    values.push(value);
    columns.push(`${column} = $${firstParamIndex + values.length - 1}`);
  }

  return { columns, values };
};

// экранируем % и _ в поисковой строке, иначе "_" находит всё подряд
export const likePattern = (search: string) =>
  `%${search.trim().replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
