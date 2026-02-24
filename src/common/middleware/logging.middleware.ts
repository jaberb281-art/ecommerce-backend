import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
    private readonly logger = new Logger('HTTP');

    use(req: Request, res: Response, next: NextFunction) {
        const { method, originalUrl, ip } = req;
        const userAgent = req.get('user-agent') ?? 'unknown';
        const startTime = Date.now();

        // Log when the response finishes
        res.on('finish', () => {
            const { statusCode } = res;
            const responseTime = Date.now() - startTime;

            // Color code by status: 2xx = normal, 4xx = warn, 5xx = error
            if (statusCode >= 500) {
                this.logger.error(
                    `${method} ${originalUrl} ${statusCode} — ${responseTime}ms — ${ip} — ${userAgent}`,
                );
            } else if (statusCode >= 400) {
                this.logger.warn(
                    `${method} ${originalUrl} ${statusCode} — ${responseTime}ms — ${ip} — ${userAgent}`,
                );
            } else {
                this.logger.log(
                    `${method} ${originalUrl} ${statusCode} — ${responseTime}ms — ${ip} — ${userAgent}`,
                );
            }
        });

        next();
    }
}