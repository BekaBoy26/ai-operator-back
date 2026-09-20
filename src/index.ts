import "dotenv/config";
import createApi from "./createApi";
import { checkCloudinaryConfig } from "./config/cloudinary";

// сразу видно в логах, если переменные Cloudinary не заданы
checkCloudinaryConfig();

const app = createApi();
const port = process.env.PORT ? Number(process.env.PORT) : 5000;

const server = app.listen(port, () => {
  console.log(`Server is on port ${port}`);
});

server.on("error", (error) => {
  console.error("[server] failed to start:", error);
  process.exit(1);
});

// необработанная ошибка в одном запросе не должна молча ронять процесс
process.on("unhandledRejection", (reason) => {
  console.error("[server] unhandled rejection:", reason);
});
