import { isAddress } from "viem";

/** Live ENStrologyPay on Sepolia. */
export const SEPOLIA_ENSTROLOGY_PAY =
  "0x7bc5d29C0384E232Aec0028Cddaae62BE51E5d92" as const;

const RETIRED_PAY_ADDRESSES = new Set([
  "0x116eb53bd5114b5fdf3cd6511bc0c4e8329e2e1c",
]);

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
