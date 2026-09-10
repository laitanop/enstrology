import { headers } from 'next/headers';
import { namehash } from 'viem';
import {
  ORACLE_ADDRESS,
  revokeOracleTextRoles,
  writeTextRecord,
} from '@/lib/oracle';
import CreateReadingForm, {
  type CreateReadingState,
  type PermissionProofResult,
} from './create-reading-form';
import SiteNav from './site-nav';

const READING_NAMEHASH_REGEX = /^0x[a-fA-F0-9]{64}$/;
const ENS_NAME_REGEX = /^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+$/;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error';
}

function normalizeEnsName(value: string): string {
  return value.trim().toLowerCase();
}

function getCreateReadingErrorMessage(error: unknown): string {
  if (
    error instanceof Error &&
    (error.message.includes('not deployed at') ||
      error.message.includes('Missing ') ||
      error.message.includes('does not match') ||
      error.message.includes('revert'))
  ) {
    return error.message;
  }
  return 'Unexpected server error while creating reading.';
}

async function createReadingAction(
  _prevState: CreateReadingState,
  formData: FormData
): Promise<CreateReadingState> {
  'use server';

  const sourceEnsName = String(formData.get('sourceEnsName') || '')
    .trim()
    .toLowerCase();
  const birthdate = String(formData.get('birthdate') || '').trim();
  const readingNamehash = String(formData.get('readingNamehash') || '').trim();
  const visibility = String(formData.get('visibility') || 'public').trim();

  if (!sourceEnsName || !birthdate || !readingNamehash) {
    return { status: 'error', message: 'Missing required fields.' };
  }
  if (!ENS_NAME_REGEX.test(sourceEnsName)) {
    return { status: 'error', message: 'Invalid ENS name format.' };
  }
  if (!READING_NAMEHASH_REGEX.test(readingNamehash)) {
    return { status: 'error', message: 'Invalid readingNamehash format.' };
  }
  if (Number.isNaN(Date.parse(birthdate))) {
    return { status: 'error', message: 'Invalid birthdate.' };
  }
  if (visibility !== 'private' && visibility !== 'public') {
    return { status: 'error', message: 'Invalid visibility option.' };
  }

  const oracleWriteApiKey = process.env.ORACLE_WRITE_API_KEY;
  if (!oracleWriteApiKey) {
    return { status: 'error', message: 'Server missing ORACLE_WRITE_API_KEY.' };
  }

  try {
    const requestHeaders = await headers();
    const host = requestHeaders.get('x-forwarded-host') || requestHeaders.get('host');
    const protocol = requestHeaders.get('x-forwarded-proto') || 'http';
    if (!host) {
      return { status: 'error', message: 'Could not resolve request host.' };
    }

    const response = await fetch(`${protocol}://${host}/api/oracle/write`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${oracleWriteApiKey}`,
      },
      body: JSON.stringify({
        readingNamehash,
        sourceEnsName,
        birthdate,
      }),
      cache: 'no-store',
    });

    const responseJson = (await response.json()) as {
      success?: boolean;
      error?: string;
      horoscope?: {
        sign: string;
        title: string;
        reading: string;
        luckyColor: string;
        luckyNumber: string;
      };
      readingEnsName?: string;
      transactions?: Record<string, string>;
    };

    if (!response.ok || !responseJson.success || !responseJson.horoscope || !responseJson.transactions) {
      return {
        status: 'error',
        message: responseJson.error || 'Failed to create reading.',
      };
    }

    const visibilityMessage =
      visibility === 'public'
        ? ' Reading created and marked public in the payment contract.'
        : ' Reading created as private.';

    return {
      status: 'success',
      message: `Success.${visibilityMessage}`,
      result: {
        sourceEnsName,
        birthdate,
        readingNamehash,
        readingEnsName: responseJson.readingEnsName || '',
        visibility,
        horoscope: responseJson.horoscope,
        transactions: responseJson.transactions,
      },
    };
  } catch (error) {
    return {
      status: 'error',
      message: getCreateReadingErrorMessage(error),
    };
  }
}

async function forbiddenWriteAction(input: {
  targetEnsName: string;
}): Promise<PermissionProofResult> {
  'use server';

  const targetEnsName = normalizeEnsName(input.targetEnsName || '');
  if (!ENS_NAME_REGEX.test(targetEnsName)) {
    return {
      status: 'error',
      message: 'Invalid ENS name for forbidden-write test.',
      targetEnsName,
      oracleAddress: ORACLE_ADDRESS,
    };
  }

  try {
    const txHash = await writeTextRecord(
      namehash(targetEnsName),
      'source.name',
      `forbidden-proof-${Date.now()}`
    );
    return {
      status: 'unexpected_success',
      message:
        'Forbidden write unexpectedly succeeded. Permission boundary is not enforced on this node.',
      txHash,
      targetEnsName,
      oracleAddress: ORACLE_ADDRESS,
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    const reverted =
      errorMessage.toLowerCase().includes('revert') ||
      errorMessage.toLowerCase().includes('unauthorized');
    return {
      status: reverted ? 'expected_revert' : 'error',
      message: reverted
        ? 'Forbidden write reverted onchain (expected).'
        : `Forbidden write failed with non-revert error: ${errorMessage}`,
      targetEnsName,
      oracleAddress: ORACLE_ADDRESS,
    };
  }
}

async function revokeOracleAction(input: {
  permissionEnsName: string;
}): Promise<PermissionProofResult> {
  'use server';

  const permissionEnsName = normalizeEnsName(input.permissionEnsName || '');
  if (!ENS_NAME_REGEX.test(permissionEnsName)) {
    return {
      status: 'error',
      message: 'Invalid ENS name for revoke test.',
      targetEnsName: permissionEnsName,
      oracleAddress: ORACLE_ADDRESS,
    };
  }

  try {
    const txHash = await revokeOracleTextRoles(namehash(permissionEnsName));
    return {
      status: 'success',
      message: 'Oracle text roles revoked successfully onchain.',
      txHash,
      targetEnsName: permissionEnsName,
      oracleAddress: ORACLE_ADDRESS,
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    return {
      status: 'error',
      message: `Revoke failed: ${errorMessage}`,
      targetEnsName: permissionEnsName,
      oracleAddress: ORACLE_ADDRESS,
    };
  }
}

async function retryOracleWriteAction(input: {
  targetEnsName: string;
}): Promise<PermissionProofResult> {
  'use server';

  const targetEnsName = normalizeEnsName(input.targetEnsName || '');
  if (!ENS_NAME_REGEX.test(targetEnsName)) {
    return {
      status: 'error',
      message: 'Invalid ENS name for retry-write test.',
      targetEnsName,
      oracleAddress: ORACLE_ADDRESS,
    };
  }

  try {
    const txHash = await writeTextRecord(
      namehash(targetEnsName),
      'horoscope.revokeTest',
      `revoke-proof-${Date.now()}`
    );
    return {
      status: 'unexpected_success',
      message:
        'Post-revoke write unexpectedly succeeded. Oracle still has permission on this node.',
      txHash,
      targetEnsName,
      oracleAddress: ORACLE_ADDRESS,
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    const reverted =
      errorMessage.toLowerCase().includes('revert') ||
      errorMessage.toLowerCase().includes('unauthorized');
    return {
      status: reverted ? 'expected_revert' : 'error',
      message: reverted
        ? 'Post-revoke write reverted onchain (expected).'
        : `Post-revoke write failed with non-revert error: ${errorMessage}`,
      targetEnsName,
      oracleAddress: ORACLE_ADDRESS,
    };
  }
}

export default function Home() {
  return (
    <div className="min-h-dvh px-4 py-8 text-zinc-100">
      <div className="mx-auto w-full max-w-5xl">
        <SiteNav current="create" />
      </div>
      <main className="mx-auto mt-10 flex w-full max-w-xl flex-col sm:mt-14">
        <header className="text-center">
          <h1 className="font-display text-4xl font-medium tracking-tight text-white sm:text-5xl">
            Every name has a birthday
          </h1>
          <p className="mx-auto mt-4 max-w-md text-base leading-7 text-zinc-400">
            The day your ENS name was born onchain decides its sign. Verify your
            name and let the Oracle read its stars.
          </p>
        </header>
        <div className="mt-8">
          <CreateReadingForm
            action={createReadingAction}
            forbiddenWriteAction={forbiddenWriteAction}
            revokeOracleAction={revokeOracleAction}
            retryOracleWriteAction={retryOracleWriteAction}
          />
        </div>
      </main>
    </div>
  );
}
