import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function route<Ctx>(handler: (req: NextRequest, ctx: Ctx) => Promise<Response>) {
  return async (req: NextRequest, ctx: Ctx): Promise<Response> => {
    try {
      return await handler(req, ctx);
    } catch (error) {
      if (error instanceof HttpError) return NextResponse.json({ error: error.message }, { status: error.status });
      if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
      console.error(error);
      return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
    }
  };
}

export async function readJson<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  const body = await req.json().catch(() => {
    throw new HttpError(400, "Request body must be valid JSON");
  });
  return schema.parse(body);
}
