import { AuthCredentials } from '@/auth/tokenStorage';
import { backoff } from '@/utils/time';
import { z } from 'zod';
import { getServerUrl } from './serverConfig';
import { getHappyClientId } from './apiSocket';

/**
 * DEV-08: a connector is a record of "this computer of this account is connected to this external
 * service", and nothing more. The credential lives only on the computer that authorized it, so the
 * relay has no token to hand out and the control end never asks for one.
 */
const ServiceConnectionSchema = z.object({
    vendor: z.string(),
    machineId: z.string(),
    status: z.enum(['connected', 'disconnected']),
    createdAt: z.number(),
    updatedAt: z.number(),
});

const ServiceConnectionListSchema = z.object({
    connections: z.array(ServiceConnectionSchema),
});

export type ServiceConnection = z.infer<typeof ServiceConnectionSchema>;

/** Every connector record on the account, newest first. */
export async function fetchServiceConnections(credentials: AuthCredentials): Promise<ServiceConnection[]> {
    const API_ENDPOINT = getServerUrl();

    return await backoff(async () => {
        const response = await fetch(`${API_ENDPOINT}/v1/connect`, {
            headers: {
                'Authorization': `Bearer ${credentials.token}`,
                'X-Happy-Client': getHappyClientId(),
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to list connected services: ${response.status}`);
        }

        return ServiceConnectionListSchema.parse(await response.json()).connections;
    });
}

/**
 * Forget one computer's connection to a service. The credential itself is revoked on that computer
 * by the host (HOST-11); this only removes the record the account page reads.
 */
export async function disconnectService(
    credentials: AuthCredentials,
    service: string,
    machineId: string
): Promise<void> {
    const API_ENDPOINT = getServerUrl();

    return await backoff(async () => {
        const response = await fetch(`${API_ENDPOINT}/v1/connect/${service}?machineId=${encodeURIComponent(machineId)}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${credentials.token}`,
                'X-Happy-Client': getHappyClientId(),
            }
        });

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error(`${service} is not connected on that computer`);
            }
            throw new Error(`Failed to disconnect ${service}: ${response.status}`);
        }
    });
}
