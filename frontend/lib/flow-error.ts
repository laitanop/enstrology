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
    lower.includes("already purchased") ||
    lower.includes("alreadypurchased")
  ) {
    return "This reading is already paid. Close and tap Reveal again to finish the Oracle write.";
  }
  if (
    lower.includes("insufficient funds") ||
    lower.includes("exceeds the balance") ||
    lower.includes("insufficient balance")
  ) {
    return "This connected account needs Sepolia ETH for gas, or MetaMask could not simulate the transaction.";
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
  if (
    lower.includes("revokeroles") ||
    lower.includes("authorizename") ||
    lower.includes("authorizetext") ||
    lower.includes("revokeroot") ||
    lower.includes("eaccannotrevoke") ||
    lower.includes("eacunauthorized")
  ) {
    return "Could not change Oracle write roles. They may already be gone, or this admin wallet cannot change them.";
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
