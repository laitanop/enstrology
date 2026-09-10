'use server';

import { namehash } from 'viem';
import { revokeOracleTextRoles } from '@/lib/oracle';

const ENS_NAME_REGEX = /^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+$/;

export async function revokeReadingOracleAction(readingEnsName: string): Promise<{
  status: 'success' | 'error';
  message: string;
  txHash?: `0x${string}`;
}> {
  const normalized = readingEnsName.trim().toLowerCase();
  if (!ENS_NAME_REGEX.test(normalized)) {
    return { status: 'error', message: 'Missing reading ENS name.' };
  }

  try {
    const txHash = await revokeOracleTextRoles(namehash(normalized));
    return {
      status: 'success',
      message: 'Oracle write roles were revoked on this reading.',
      txHash,
    };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Revoke failed.',
    };
  }
}
