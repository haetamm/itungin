
import dotenv from 'dotenv';
import App from './application/app';
import { logger } from './application/logging';
dotenv.config();



const port: number = 8000;
const app = new App().app;

app.listen(port, () => {
    logger.info(`App use port ${port}`);
});

export default app;
