import { google } from "googleapis";
import { withGoogle } from "./google.service";

export const getDriveFiles = (userId: number) =>
  withGoogle(userId, async (auth) => {
    const drive = google.drive({ version: "v3", auth });

    const result = await drive.files.list({
      pageSize: 50,
      orderBy: "modifiedTime desc",
      // файлы из корзины раньше показывались как обычные
      q: "trashed = false",
      fields: "files(id, name, mimeType, iconLink, webViewLink, modifiedTime, size)",
    });

    return result.data.files ?? [];
  });

export const createDriveFolder = (userId: number, name: string) =>
  withGoogle(userId, async (auth) => {
    const drive = google.drive({ version: "v3", auth });

    const result = await drive.files.create({
      requestBody: {
        name,
        mimeType: "application/vnd.google-apps.folder",
      },
      fields: "id, name, mimeType, webViewLink",
    });

    return result.data;
  });
