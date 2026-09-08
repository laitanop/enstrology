import { headers } from 'next/headers';
import CreateReadingForm, { type CreateReadingState } from './create-reading-form';

const READING_NAMEHASH_REGEX = /^0x[a-fA-F0-9]{64}$/;
const ENS_NAME_REGEX = /^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+$/;

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
  const visibility = String(formData.get('visibility') || 'private').trim();

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
        visibility,
        horoscope: responseJson.horoscope,
        transactions: responseJson.transactions,
      },
    };
  } catch (error) {
    // Keep generic errors by default, but surface config issues for faster setup fixes.
    const safeMessage =
      error instanceof Error &&
      (error.message.includes('not deployed at') || error.message.includes('Missing ENSTROLOGYP_PAY_ADDRESS'))
        ? error.message
        : 'Unexpected server error while creating reading.';
    return {
      status: 'error',
      message: safeMessage,
    };
  }
}

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-10 text-zinc-900 dark:bg-black dark:text-zinc-100">
      <main className="mx-auto flex w-full max-w-2xl flex-col items-center">
        <CreateReadingForm action={createReadingAction} />
      </main>
    </div>
  );
}
