import { NextResponse } from "next/server";
import { getDashboardData } from "@/lib/dashboard";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const data = await getDashboardData(searchParams.get("date") ?? undefined);
  return NextResponse.json(data);
}
