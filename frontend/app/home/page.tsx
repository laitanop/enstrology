import { revalidatePath } from "next/cache";
import { namehash } from "viem";
import { invalidateFeedCache } from "@/lib/feed";
import {
  ORACLE_ADDRESS,
  revokeOracleTextRoles,
  writePurchasedReading,
  writeTextRecord,
} from "@/lib/oracle";
import { Suspense } from "react";
import CreateReadingForm, {
  type CreateReadingState,
  type PermissionProofResult,
} from "../create-reading-form";
import HomeFeed from "../home-feed";
import SiteNav from "../site-nav";

export const maxDuration = 60;

const READING_NAMEHASH_REGEX = /^0x[a-fA-F0-9]{64}$/;
const ENS_NAME_REGEX = /^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+$/;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "Unknown error";
}

function normalizeEnsName(value: string): string {
  return value.trim().toLowerCase();
}

function getCreateReadingErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  return "Unexpected server error while creating reading.";
}

async function createReadingAction(
  _prevState: CreateReadingState,
  formData: FormData,
): Promise<CreateReadingState> {
  "use server";

  const sourceEnsName = String(formData.get("sourceEnsName") || "")
    .trim()
    .toLowerCase();
  const birthdate = String(formData.get("birthdate") || "").trim();
  const readingNamehash = String(formData.get("readingNamehash") || "").trim();
  const visibility = String(formData.get("visibility") || "public").trim();

  if (!sourceEnsName || !birthdate || !readingNamehash) {
    return { status: "error", message: "Missing required fields." };
  }
  if (!ENS_NAME_REGEX.test(sourceEnsName)) {
    return { status: "error", message: "Invalid ENS name format." };
  }
  if (!READING_NAMEHASH_REGEX.test(readingNamehash)) {
    return { status: "error", message: "Invalid readingNamehash format." };
  }
  if (Number.isNaN(Date.parse(birthdate))) {
    return { status: "error", message: "Invalid birthdate." };
  }
  if (visibility !== "private" && visibility !== "public") {
    return { status: "error", message: "Invalid visibility option." };
  }

  try {
    const result = await writePurchasedReading({
      readingNamehash: readingNamehash as `0x${string}`,
      sourceEnsName,
      birthdate,
    });

    const visibilityMessage =
      visibility === "public"
        ? " Reading published to the Cosmic Feed."
        : " Reading created.";

    invalidateFeedCache();
    revalidatePath("/home");

    return {
      status: "success",
      message: `Success.${visibilityMessage}`,
      result: {
        sourceEnsName,
        birthdate,
        readingNamehash,
        readingEnsName: result.readingEnsName || "",
        visibility,
        horoscope: result.horoscope,
        transactions: result.transactions,
      },
    };
  } catch (error) {
    return {
      status: "error",
      message: getCreateReadingErrorMessage(error),
    };
  }
}

async function forbiddenWriteAction(input: {
  targetEnsName: string;
}): Promise<PermissionProofResult> {
  "use server";

  const targetEnsName = normalizeEnsName(input.targetEnsName || "");
  if (!ENS_NAME_REGEX.test(targetEnsName)) {
    return {
      status: "error",
      message: "Invalid ENS name for forbidden-write test.",
      targetEnsName,
      oracleAddress: ORACLE_ADDRESS,
    };
  }

  try {
    const txHash = await writeTextRecord(
      namehash(targetEnsName),
      "source.name",
      `forbidden-proof-${Date.now()}`,
    );
    return {
      status: "unexpected_success",
      message:
        "Fail. That forbidden write went through, so this node is not enforcing the Oracle boundary.",
      txHash,
      targetEnsName,
      oracleAddress: ORACLE_ADDRESS,
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    const reverted =
      errorMessage.toLowerCase().includes("revert") ||
      errorMessage.toLowerCase().includes("unauthorized");
    return {
      status: reverted ? "expected_revert" : "error",
      message: reverted
        ? "Pass. The Oracle tried to write source.name and the chain blocked it."
        : `Forbidden write failed with non-revert error: ${errorMessage}`,
      targetEnsName,
      oracleAddress: ORACLE_ADDRESS,
    };
  }
}

async function revokeOracleAction(input: {
  permissionEnsName: string;
}): Promise<PermissionProofResult> {
  "use server";

  const permissionEnsName = normalizeEnsName(input.permissionEnsName || "");
  if (!ENS_NAME_REGEX.test(permissionEnsName)) {
    return {
      status: "error",
      message: "Invalid ENS name for revoke test.",
      targetEnsName: permissionEnsName,
      oracleAddress: ORACLE_ADDRESS,
    };
  }

  try {
    const txHash = await revokeOracleTextRoles(namehash(permissionEnsName));
    return {
      status: "success",
      message: "Pass. Oracle write roles were revoked onchain.",
      txHash,
      targetEnsName: permissionEnsName,
      oracleAddress: ORACLE_ADDRESS,
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    return {
      status: "error",
      message: `Revoke failed: ${errorMessage}`,
      targetEnsName: permissionEnsName,
      oracleAddress: ORACLE_ADDRESS,
    };
  }
}

async function retryOracleWriteAction(input: {
  targetEnsName: string;
}): Promise<PermissionProofResult> {
  "use server";

  const targetEnsName = normalizeEnsName(input.targetEnsName || "");
  if (!ENS_NAME_REGEX.test(targetEnsName)) {
    return {
      status: "error",
      message: "Invalid ENS name for retry-write test.",
      targetEnsName,
      oracleAddress: ORACLE_ADDRESS,
    };
  }

  try {
    const txHash = await writeTextRecord(
      namehash(targetEnsName),
      "horoscope.revokeTest",
      `revoke-proof-${Date.now()}`,
    );
    return {
      status: "unexpected_success",
      message:
        "Fail. The Oracle still wrote after revoke, so it still has permission.",
      txHash,
      targetEnsName,
      oracleAddress: ORACLE_ADDRESS,
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    const reverted =
      errorMessage.toLowerCase().includes("revert") ||
      errorMessage.toLowerCase().includes("unauthorized");
    return {
      status: reverted ? "expected_revert" : "error",
      message: reverted
        ? "Pass. After revoke, the Oracle could not write anymore."
        : `Post-revoke write failed with non-revert error: ${errorMessage}`,
      targetEnsName,
      oracleAddress: ORACLE_ADDRESS,
    };
  }
}

export default function Home() {
  return (
    <div className="min-h-dvh px-4 py-6 text-zinc-100">
      <div className="mx-auto w-full max-w-6xl">
        <SiteNav />
        <main className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,28rem)] lg:items-start">
          <section
            id="feed"
            className="order-2 flex min-h-0 flex-col lg:order-1"
          >
            <h2 className="text-xl font-semibold tracking-tight text-white">
              Cosmic Feed
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Public readings. Scroll this column — tap a card for the full
              horoscope.
            </p>
            <div className="mt-4 min-h-0 max-h-[60vh] overflow-y-auto pr-1 lg:max-h-[calc(100dvh-9rem)]">
              <Suspense
                fallback={
                  <p className="text-sm text-zinc-500">Loading readings...</p>
                }
              >
                <HomeFeed />
              </Suspense>
            </div>
          </section>

          <section className="order-1 lg:sticky lg:top-6 lg:order-2 lg:max-h-[calc(100dvh-6.5rem)] lg:overflow-y-auto">
            <header className="mb-5">
              <h1 className="font-display text-3xl font-medium tracking-tight text-white sm:text-4xl">
                Every name has a birthday
              </h1>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Connect your wallet and let the Oracle read your ENS stars.
              </p>
            </header>
            <CreateReadingForm
              action={createReadingAction}
              forbiddenWriteAction={forbiddenWriteAction}
              revokeOracleAction={revokeOracleAction}
              retryOracleWriteAction={retryOracleWriteAction}
            />
          </section>
        </main>
      </div>
    </div>
  );
}
