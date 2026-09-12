import { isAddress } from "viem";

/** Live ENStrologyPay on Sepolia. */
export const SEPOLIA_ENSTROLOGY_PAY =
  "0x7bc5d29C0384E232Aec0028Cddaae62BE51E5d92" as const;

/** Demo USDC used by ENStrologyPay on Sepolia. */
export const SEPOLIA_DEMO_USDC =
  "0x768F42455A2D082E23ceeF7d51e5787C82d67a39" as const;

/** ENSv2 resolver used for horoscope text on Sepolia. */
export const SEPOLIA_RESOLVER =
  "0x29227f1c246DDB631C913c8FDd5308700Fa154DA" as const;

const RETIRED_PAY_ADDRESSES = new Set([
  "0x116eb53bd5114b5fdf3cd6511bc0c4e8329e2e1c",
]);

function firstAddress(
  fallback: `0x${string}`,
  ...candidates: Array<string | undefined>
): `0x${string}` {
  for (const value of candidates) {
    const trimmed = value?.trim();
    if (trimmed && isAddress(trimmed)) {
      return trimmed as `0x${string}`;
    }
  }
  return fallback;
}

export function resolveEnstrologyPayAddress(
  ...candidates: Array<string | undefined>
): `0x${string}` {
  for (const value of candidates) {
    const trimmed = value?.trim();
    if (!trimmed || !isAddress(trimmed)) {
      continue;
    }
    if (RETIRED_PAY_ADDRESSES.has(trimmed.toLowerCase())) {
      continue;
    }
    return trimmed as `0x${string}`;
  }
  return SEPOLIA_ENSTROLOGY_PAY;
}

export function resolveDemoUsdcAddress(
  ...candidates: Array<string | undefined>
): `0x${string}` {
  return firstAddress(SEPOLIA_DEMO_USDC, ...candidates);
}

export function resolveResolverAddress(
  ...candidates: Array<string | undefined>
): `0x${string}` {
  return firstAddress(SEPOLIA_RESOLVER, ...candidates);
}
