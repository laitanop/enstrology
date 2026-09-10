export function formatFlowError(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  return friendlyFlowError(raw);
}

export function friendlyFlowError(raw: string): string {
  const text = raw.trim();
  if (!text) {
    return "Something went wrong. Close this and try again.";
  }

  const lower = text.toLowerCase();
  if (
    lower.includes("user rejected") ||
    lower.includes("user denied") ||
    lower.includes("rejected the request") ||
    lower.includes("request rejected")
  ) {
    return "You cancelled the wallet request.";
  }
  if (
    lower.includes("insufficient funds") ||
    lower.includes("exceeds the balance") ||
    lower.includes("insufficient balance")
  ) {
    return "This wallet needs more Sepolia ETH for gas.";
  }
  if (
    lower.includes("transfer amount exceeds") ||
    lower.includes("erc20: transfer") ||
    lower.includes("insufficient allowance")
  ) {
    return "Not enough demo USDC, or the approval did not go through.";
  }
  if (
    lower.includes("user rejected the chain") ||
    lower.includes("switch chain") ||
    lower.includes("unrecognized chain")
  ) {
    return "Switch your wallet to Sepolia and try again.";
  }
  if (lower.includes("connector") && lower.includes("not connected")) {
    return "Connect a wallet first, then try Reveal again.";
  }

  const firstLine = text
    .split(/Request Arguments:|Contract Call:|Details:|Version:|\n/)[0]
    .trim()
    .replace(/\s+/g, " ");

  if (firstLine && firstLine.length <= 120) {
    return firstLine;
  }
  if (firstLine) {
    return `${firstLine.slice(0, 117).trim()}…`;
  }
  return "The wallet could not complete this step.";
}
