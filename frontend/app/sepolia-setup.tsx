"use client";

import { useEffect, useId, useRef, useState } from "react";
import { sepolia } from "viem/chains";
import { useAccount, useWalletClient } from "wagmi";
import { resolveDemoUsdcAddress } from "@/lib/contracts";
import { useWalletNetwork } from "@/lib/wallet-network";

export const SEPOLIA_ETH_FAUCET =
  "https://cloud.google.com/application/web3/faucet/ethereum/sepolia";
export const SEPOLIA_ETH_FAUCET_ALT =
  "https://www.alchemy.com/faucets/ethereum-sepolia";
export const ENS_V2_EXPLORER = "https://explorer.ens.dev/";

const DEMO_USDC_ADDRESS = resolveDemoUsdcAddress(
  process.env.NEXT_PUBLIC_DEMO_USDC_ADDRESS,
);
const SEEN_KEY = "enstrology:oracle-setup-seen";

const MINT_ABI = [
  {
    name: "mint",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

const ONE_USDC = BigInt(1_000_000);

function StepLink({
  n,
  title,
  href,
  extra,
}: {
  n: string;
  title: string;
  href: string;
  extra?: { href: string; label: string };
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0c0a18]/80 px-3 py-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#C4B5FD]/15 text-sm font-semibold text-[#C4B5FD]">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="block text-sm font-medium text-white underline-offset-2 hover:underline"
        >
          {title}
        </a>
        {extra ? (
          <a
            href={extra.href}
            target="_blank"
            rel="noreferrer"
            className="mt-0.5 block text-xs text-zinc-400 underline-offset-2 hover:underline"
          >
            {extra.label}
          </a>
        ) : null}
      </div>
    </div>
  );
}

function SepoliaSetupBody() {
  const { address, isConnected } = useAccount();
  const { chainId } = useWalletNetwork();
  const { data: walletClient } = useWalletClient();
  const [minting, setMinting] = useState(false);
  const [mintMessage, setMintMessage] = useState("");
  const onSepolia = chainId === sepolia.id;

  const mintDemoUsdc = async () => {
    if (!walletClient || !address) {
      setMintMessage("Connect on Sepolia first.");
      return;
    }
    setMinting(true);
    setMintMessage("");
    try {
      const hash = await walletClient.writeContract({
        account: address,
        address: DEMO_USDC_ADDRESS,
        abi: MINT_ABI,
        functionName: "mint",
        args: [address, ONE_USDC],
        chain: sepolia,
      });
      setMintMessage(`Minted 1 demo USDC. ${hash.slice(0, 10)}…`);
    } catch (error) {
      const raw = error instanceof Error ? error.message : String(error);
      if (/user rejected|user denied|rejected the request/i.test(raw)) {
        setMintMessage("Mint cancelled.");
      } else if (/insufficient funds|exceeds the balance/i.test(raw)) {
        setMintMessage("Get Sepolia ETH first — you need it for gas.");
      } else {
        setMintMessage("Mint failed. Try Etherscan instead.");
      }
    } finally {
      setMinting(false);
    }
  };

  return (
    <div className="mt-5 w-full space-y-2">
      <StepLink
        n="1"
        title="Sepolia ETH for gas"
        href={SEPOLIA_ETH_FAUCET}
        extra={{ href: SEPOLIA_ETH_FAUCET_ALT, label: "Or use Alchemy" }}
      />
      <StepLink
        n="2"
        title="A Sepolia ENS name"
        href={ENS_V2_EXPLORER}
      />
      <StepLink
        n="3"
        title="Demo USDC to pay 0.01"
        href={`https://sepolia.etherscan.io/address/${DEMO_USDC_ADDRESS}#writeContract`}
      />
      {isConnected && onSepolia ? (
        <button
          type="button"
          onClick={() => void mintDemoUsdc()}
          disabled={minting}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-white/15 px-4 text-sm font-semibold text-zinc-100 transition hover:bg-white/5 disabled:opacity-60"
        >
          {minting ? "Minting…" : "Mint 1 demo USDC here"}
        </button>
      ) : null}
      {mintMessage ? (
        <p className="text-xs leading-5 text-zinc-400">{mintMessage}</p>
      ) : null}
    </div>
  );
}

export function SepoliaSetupCard() {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [unseen, setUnseen] = useState(true);

  useEffect(() => {
    setUnseen(sessionStorage.getItem(SEEN_KEY) !== "1");
  }, []);

  const openTip = () => {
    setOpen(true);
    sessionStorage.setItem(SEEN_KEY, "1");
    setUnseen(false);
  };

  const closeTip = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeTip();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <div className="pointer-events-none fixed right-4 bottom-4 z-40 flex items-end gap-2 sm:right-6 sm:bottom-6">
        {!open ? (
          <p className="pointer-events-none mb-2 max-w-[11.5rem] rounded-2xl rounded-br-md border border-[#E8C56A]/30 bg-[#141022] px-3 py-2 text-xs leading-5 text-[#F4E4B8] shadow-[0_12px_40px_rgba(0,0,0,0.4)]">
            {unseen
              ? "You need this before you reveal your horoscope"
              : "Need help?"}
          </p>
        ) : null}
        <button
          type="button"
          onClick={openTip}
          className="pointer-events-auto relative flex size-14 items-center justify-center rounded-full border border-[#E8C56A]/35 bg-[#141022] shadow-[0_12px_40px_rgba(0,0,0,0.45)] ring-2 ring-[#E8C56A]/15"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label="You need this before you reveal your horoscope"
        >
          <img
            src="/images/logo.svg"
            alt=""
            width={40}
            height={28}
            className="h-8 w-auto"
          />
          {unseen ? (
            <span className="absolute top-1 right-1 size-2.5 rounded-full bg-[#E8C56A] ring-2 ring-[#141022]" />
          ) : null}
        </button>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            aria-label="Close Oracle tip"
            onClick={closeTip}
          />
          <div className="relative w-full max-w-sm rounded-[28px] border border-white/10 bg-[#141022] px-5 pt-8 pb-5 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
            <button
              type="button"
              onClick={closeTip}
              className="absolute top-3 right-3 flex size-10 items-center justify-center rounded-full text-zinc-400 transition hover:bg-white/5 hover:text-white"
              aria-label="Close"
            >
              <span aria-hidden className="text-lg leading-none">
                ×
              </span>
            </button>
            <div className="flex flex-col items-center text-center">
              <div className="flex size-16 items-center justify-center rounded-full bg-[#1a1630] ring-1 ring-white/10">
                <img
                  src="/images/logo.svg"
                  alt=""
                  width={56}
                  height={38}
                  className="h-10 w-auto"
                />
              </div>
              <h2
                id={titleId}
                className="font-display mt-4 text-2xl text-white"
              >
                What this demo needs
              </h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                ENStrology runs on Sepolia. You need test ETH for gas, a
                Sepolia ENS name, and demo USDC to pay 0.01 for a reading.
              </p>
              <SepoliaSetupBody />
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={closeTip}
              className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-[#C4B5FD] px-6 text-sm font-semibold text-[#1B1233] transition hover:bg-[#d4c8ff]"
            >
              Got it
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
