import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, isAddress } from 'viem';
import { mainnet } from 'viem/chains';

export const runtime = 'nodejs';

const MAINNET_RPC_URL = process.env.MAINNET_RPC_URL || 'https://ethereum-rpc.publicnode.com';

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(MAINNET_RPC_URL),
});

export async function GET(request: NextRequest) {
  try {
    const address = request.nextUrl.searchParams.get('address');
    if (!address || !isAddress(address)) {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    }

    const ensName = await publicClient.getEnsName({ address });
    return NextResponse.json({ ensName: ensName || null });
  } catch {
    return NextResponse.json({ ensName: null }, { status: 200 });
  }
}
