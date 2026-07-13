import { StrKey } from "@stellar/stellar-sdk";
import { stellar } from "@stellar/mpp/channel/server";
import { Mppx, Store } from "mppx/server";

import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRICE = process.env.MPP_DEMO_PRICE?.trim() ?? "0.01";

type Params = { params: Promise<{ channel: string }> };

/** Per-channel Mppx servers (merchant side for Hub-hosted demos). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const servers = new Map<string, any>();

function demoSecret(): string | null {
  const secret = process.env.MPP_DEMO_SECRET?.trim();
  return secret && secret.length >= 16 ? secret : null;
}

function getServer(
  channel: string,
  commitmentPubkeyHex: string,
  recipient: string,
  secretKey: string,
) {
  const existing = servers.get(channel);
  if (existing) return existing;

  const commitmentPublicKeyG = StrKey.encodeEd25519PublicKey(
    Buffer.from(commitmentPubkeyHex, "hex"),
  );
  const mppx = Mppx.create({
    secretKey,
    methods: [
      stellar.channel({
        channel,
        commitmentKey: commitmentPublicKeyG,
        store: Store.memory(),
        network: "stellar:testnet",
        recipient,
        currency: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
      }),
    ],
  });
  servers.set(channel, mppx);
  return mppx;
}

function disabledResponse(): Response {
  return Response.json(
    {
      error: "mpp_demo_disabled",
      message: "Set MPP_DEMO_SECRET (≥16 chars) to enable the demo merchant.",
    },
    { status: 404 },
  );
}

async function handleDemo(req: Request, channel: string): Promise<Response> {
  const secretKey = demoSecret();
  if (!secretKey) return disabledResponse();

  const session = await prisma.mppSession.findFirst({
    where: { channel, status: "open" },
  });
  if (!session) {
    return Response.json(
      {
        error: "session_not_found",
        message:
          "No open MPP session for this channel. Call mpp_open_session first.",
      },
      { status: 404 },
    );
  }
  if (!/^[0-9a-f]{64}$/i.test(session.commitmentPubkeyHex)) {
    return Response.json(
      { error: "invalid_commitment_pubkey" },
      { status: 500 },
    );
  }

  const mppx = getServer(
    channel,
    session.commitmentPubkeyHex,
    session.recipient,
    secretKey,
  );

  const result = await mppx.channel({
    amount: PRICE,
    description: "Nebula Hub MPP demo merchant",
  })(req);

  if (result.status === 402) {
    return result.challenge;
  }

  return result.withReceipt(
    Response.json({
      message: "Paid via Nebula Hub MPP demo (off-chain commitment)",
      price: PRICE,
      channel,
      timestamp: new Date().toISOString(),
    }),
  );
}

export async function GET(req: Request, { params }: Params) {
  const { channel } = await params;
  if (new URL(req.url).pathname.endsWith("/health")) {
    if (!demoSecret()) return disabledResponse();
    const session = await prisma.mppSession.findFirst({
      where: { channel, status: "open" },
    });
    return Response.json({
      ok: Boolean(session),
      channel,
      price: PRICE,
    });
  }
  return handleDemo(req, channel);
}

export async function POST(req: Request, { params }: Params) {
  const { channel } = await params;
  return handleDemo(req, channel);
}
