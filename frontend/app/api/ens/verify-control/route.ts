import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, isAddress } from 'viem';
import { sepolia } from 'viem/chains';

export const runtime = 'nodejs';

const ENS_NAME_REGEX = /^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+$/;
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(SEPOLIA_RPC_URL),
});

export async function GET(request: NextRequest) {
  try {
    const sourceRaw = request.nextUrl.searchParams.get('source') || '';
    const walletRaw = request.nextUrl.searchParams.get('wallet') || '';
    const source = sourceRaw.trim().toLowerCase();
    const wallet = walletRaw.trim().toLowerCase();

    if (!isAddress(wallet)) {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    }

    if (isAddress(source)) {
      const verified = source.toLowerCase() === wallet.toLowerCase();
      return NextResponse.json({
        verified,
        sourceType: 'address',
        source,
        wallet,
        reason: verified ? 'Source address matches connected wallet' : 'Source address does not match wallet',
      });
    }

    if (!ENS_NAME_REGEX.test(source)) {
      return NextResponse.json({ error: 'Invalid ENS name format' }, { status: 400 });
    }

    const resolvedAddress = await publicClient.getEnsAddress({ name: source });
    if (!resolvedAddress) {
      return NextResponse.json({
        verified: false,
        sourceType: 'ens',
        source,
        wallet,
        resolvedAddress: null,
        reason:
          'This ENS name has no address record on Sepolia. Set an address record first, or use your wallet address as source.',
      });
    }

    const verified = resolvedAddress.toLowerCase() === wallet;
    return NextResponse.json({
      verified,
      sourceType: 'ens',
      source,
      wallet,
      resolvedAddress,
      reason: verified
        ? 'ENS resolves to the connected wallet on Sepolia'
        : 'ENS resolves to a different address on Sepolia',
    });
  } catch {
    return NextResponse.json(
      { error: 'Unexpected error while verifying ENS control' },
      { status: 500 }
    );
  }
}
