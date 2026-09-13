import { z } from "zod";
import { type Fastify } from "../types";
import { debug } from "@/utils/log";
import { db } from "@/storage/db";

export function connectRoutes(app: Fastify) {

    // Tolerate an empty JSON body on requests that carry a content type but no payload —
    // Fastify 5 rejects those before the handler runs.
    app.addContentTypeParser(
        'application/json',
        { parseAs: 'string' },
        function (req, body, done) {
            try {
                const bodyStr = body as string;

                // Handle empty body case - common for DELETE, GET requests
                if (!bodyStr || bodyStr.trim() === '') {
                    // For DELETE and GET methods, empty body is expected
                    if (req.method === 'DELETE' || req.method === 'GET') {
                        done(null, undefined);
                        return;
                    }
                    // For other methods, return empty object
                    done(null, {});
                    return;
                }

                done(null, JSON.parse(bodyStr));
            } catch (err: any) {
                const path = req.url.split('?')[0] || '<unknown>';
                debug({ module: 'content-parser' }, `http:invalid-json method=${req.method} path=${path} message=${err.message}`);
                err.statusCode = 400;
                done(err, undefined);
            }
        }
    );

    //
    // Connector records (DEV-08). A connector is a record of "this machine of this account is
    // connected to this external service" and nothing else: the credential stays on the machine
    // that authorized it (P-09), so no route here accepts, stores or returns one.
    //

    const VendorParams = z.object({
        vendor: z.string().min(1).max(64).regex(/^[a-z0-9][a-z0-9_-]*$/)
    });
    const ConnectionStatus = z.enum(['connected', 'disconnected']);
    const ConnectionRecord = z.object({
        vendor: z.string(),
        machineId: z.string(),
        status: ConnectionStatus,
        createdAt: z.number(),
        updatedAt: z.number()
    });

    app.post('/v1/connect/:vendor/register', {
        preHandler: app.authenticate,
        schema: {
            params: VendorParams,
            // strict(): a client that still sends a credential field gets 400 instead of having it
            // silently dropped, so a token can never reach the relay unnoticed.
            body: z.object({
                machineId: z.string().min(1),
                status: ConnectionStatus.default('connected')
            }).strict(),
            response: {
                200: z.object({ connection: ConnectionRecord }),
                404: z.object({ error: z.string() })
            }
        }
    }, async (request, reply) => {
        const userId = request.userId;
        const { machineId, status } = request.body;

        const machine = await db.machine.findFirst({
            where: { id: machineId, accountId: userId },
            select: { id: true }
        });
        if (!machine) {
            return reply.code(404).send({ error: 'Machine not found' });
        }

        const connection = await db.serviceConnection.upsert({
            where: { accountId_machineId_vendor: { accountId: userId, machineId, vendor: request.params.vendor } },
            update: { status, updatedAt: new Date() },
            create: { accountId: userId, machineId, vendor: request.params.vendor, status }
        });
        return reply.send({
            connection: {
                vendor: connection.vendor,
                machineId: connection.machineId,
                status: connection.status as z.infer<typeof ConnectionStatus>,
                createdAt: connection.createdAt.getTime(),
                updatedAt: connection.updatedAt.getTime()
            }
        });
    });

    app.get('/v1/connect', {
        preHandler: app.authenticate,
        schema: {
            response: {
                200: z.object({ connections: z.array(ConnectionRecord) })
            }
        }
    }, async (request, reply) => {
        const connections = await db.serviceConnection.findMany({
            where: { accountId: request.userId },
            orderBy: { updatedAt: 'desc' }
        });
        return reply.send({
            connections: connections.map((c) => ({
                vendor: c.vendor,
                machineId: c.machineId,
                status: c.status as z.infer<typeof ConnectionStatus>,
                createdAt: c.createdAt.getTime(),
                updatedAt: c.updatedAt.getTime()
            }))
        });
    });

    app.delete('/v1/connect/:vendor', {
        preHandler: app.authenticate,
        schema: {
            params: VendorParams,
            querystring: z.object({ machineId: z.string().min(1) }),
            response: {
                200: z.object({ success: z.literal(true) }),
                404: z.object({ error: z.string() })
            }
        }
    }, async (request, reply) => {
        const { count } = await db.serviceConnection.deleteMany({
            where: {
                accountId: request.userId,
                machineId: request.query.machineId,
                vendor: request.params.vendor
            }
        });
        if (count === 0) {
            return reply.code(404).send({ error: 'Connection not found' });
        }
        return reply.send({ success: true });
    });

}
