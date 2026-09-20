import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { pool } from "../plugins/pg";
import { normalizeEmail } from "../utils/email";
import { readLinkState } from "../utils/googleState";

// Два сценария:
//  1) вход через Google (без state) — по google_id; существующий аккаунт с паролем
//     НЕ склеиваем автоматически (иначе можно захватить чужой email, зарегистрировав
//     его заранее со своим паролем);
//  2) подключение Google к уже вошедшему пользователю (state с его id) — просто
//     сохраняем токены в его аккаунт.
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: process.env.GOOGLE_CALLBACK_URL!,
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        const { displayName: name, id: googleId, emails, photos } = profile;
        const email = emails?.[0]?.value ? normalizeEmail(emails[0].value) : null;
        const avatar = photos?.[0]?.value ?? null;
        const link = readLinkState(req.query.state);

        if (link) {
          const taken = await pool.query(
            `select 1 from users where google_id = $1 and id <> $2`,
            [googleId, link.userId],
          );
          if (taken.rows[0]) return done(null, false, { message: "google_in_use" });

          const linked = await pool.query(
            `
              update users
              set google_id = $1,
                  google_access = $2,
                  google_refresh = coalesce($3, google_refresh),
                  avatar = coalesce(nullif(avatar, ''), $4)
              where id = $5
              returning *
            `,
            [googleId, accessToken, refreshToken ?? null, avatar, link.userId],
          );

          if (!linked.rows[0]) return done(null, false, { message: "denied" });
          return done(null, { ...linked.rows[0], linked: true, returnTo: link.returnTo } as any);
        }

        const byGoogle = await pool.query(`select id from users where google_id = $1`, [googleId]);

        if (byGoogle.rows[0]) {
          const updated = await pool.query(
            `
              update users
              set google_access = $1, google_refresh = coalesce($2, google_refresh)
              where google_id = $3
              returning *
            `,
            [accessToken, refreshToken ?? null, googleId],
          );
          return done(null, updated.rows[0]);
        }

        if (email) {
          const byEmail = await pool.query(`select 1 from users where lower(email) = $1`, [email]);
          if (byEmail.rows[0]) return done(null, false, { message: "account_exists" });
        }

        const created = await pool.query(
          `
            insert into users (name, email, avatar, google_id, google_access, google_refresh)
            values ($1, $2, $3, $4, $5, $6)
            returning *
          `,
          [name, email, avatar, googleId, accessToken, refreshToken ?? null],
        );

        return done(null, created.rows[0]);
      } catch (error) {
        done(error as Error, false);
      }
    },
  ),
);
