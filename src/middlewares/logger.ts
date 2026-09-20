import { NextFunction, Request, Response } from "express";

// одна строка на запрос; query-строку не пишем (там бывают code/state от OAuth)
export const logger = (req: Request, res: Response, next: NextFunction) => {
  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - startedAt) / 1e6;
    console.log(`${req.method} ${req.path} ${res.statusCode} ${ms.toFixed(0)}ms`);
  });

  next();
};
