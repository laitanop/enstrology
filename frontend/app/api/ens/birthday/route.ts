import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const ENS_NAME_REGEX = /^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+$/;
const ENS_SUBGRAPH_ID = '5XqPmWe6gjyrJtFn9cLy237i4cWw2j9HcUJEXsP5qGtH';

type GraphResponse = {
  data?: {
    registrations?: Array<{
      registrationDate?: string;
      domain?: {
        name?: string;
      };
    }>;
  };
  errors?: Array<{ message?: string }>;
  message?: string;
};

function getSubgraphUrl(): string {
  const graphKey = process.env.THE_GRAPH_API_KEY;
  if (!graphKey) {
    return `https://api.thegraph.com/subgraphs/name/ensdomains/ens`;
  }
  return `https://gateway.thegraph.com/api/${graphKey}/subgraphs/id/${ENS_SUBGRAPH_ID}`;
}

export async function GET(request: NextRequest) {
  try {
    const nameRaw = request.nextUrl.searchParams.get('name') || '';
    const ensName = nameRaw.trim().toLowerCase();

    if (!ensName || !ENS_NAME_REGEX.test(ensName)) {
      return NextResponse.json({ error: 'Invalid ENS name format' }, { status: 400 });
    }
    if (!ensName.endsWith('.eth')) {
      return NextResponse.json(
        { error: 'Birthday auto-detection currently supports .eth names only' },
        { status: 400 }
      );
    }

    const label = ensName.split('.')[0];
    if (!label) {
      return NextResponse.json({ error: 'Invalid ENS label' }, { status: 400 });
    }

    const query = `
      query GetRegistrations($label: String!) {
        registrations(
          first: 20
          where: { labelName: $label }
          orderBy: registrationDate
          orderDirection: asc
        ) {
          registrationDate
          domain { name }
        }
      }
    `;

    const response = await fetch(getSubgraphUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query,
        variables: { label },
      }),
      cache: 'no-store',
    });

    const json = (await response.json()) as GraphResponse;
    const topLevelMessage = json.message || '';
    const graphError = json.errors?.[0]?.message || '';
    const mergedError = `${topLevelMessage} ${graphError}`.trim();

    if (!response.ok || mergedError) {
      if (mergedError.toLowerCase().includes('rate-limit')) {
        return NextResponse.json(
          {
            error:
              'ENS subgraph rate limit reached. Set THE_GRAPH_API_KEY in frontend/.env.local for reliable birthday detection.',
          },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: 'Could not fetch ENS birthday from subgraph' },
        { status: 502 }
      );
    }

    const match = (json.data?.registrations || [])
      .filter((item) => item.domain?.name?.toLowerCase() === ensName)
      .sort((a, b) => Number(a.registrationDate || '0') - Number(b.registrationDate || '0'))[0];

    if (!match?.registrationDate) {
      return NextResponse.json(
        { error: `No registration date found for ${ensName}` },
        { status: 404 }
      );
    }

    const registrationDateUnix = Number(match.registrationDate);
    if (!Number.isFinite(registrationDateUnix) || registrationDateUnix <= 0) {
      return NextResponse.json({ error: 'Invalid registration date data' }, { status: 502 });
    }

    const birthdateISO = new Date(registrationDateUnix * 1000).toISOString().slice(0, 10);
    return NextResponse.json({
      ensName,
      birthdateISO,
      registrationDateUnix,
      source: 'ens-subgraph',
    });
  } catch {
    return NextResponse.json(
      { error: 'Unexpected error while detecting ENS birthday' },
      { status: 500 }
    );
  }
}
