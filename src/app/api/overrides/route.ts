import { NextResponse } from "next/server";
import { readOverrides, writeOverrides, type Overrides } from "@/lib/overrides";

export async function GET() {
  const data = await readOverrides();
  return NextResponse.json(data);
}

export async function PUT(req: Request) {
  const body = (await req.json()) as Overrides;
  await writeOverrides(body);
  return NextResponse.json({ ok: true });
}
