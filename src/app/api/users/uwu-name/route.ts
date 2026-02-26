import { NextRequest, NextResponse } from "next/server"

/**
 * .uwu name registration is not available on opBNB.
 * Return 410 Gone so clients know the feature is disabled.
 */
export async function POST(_request: NextRequest) {
    return NextResponse.json(
        { error: "Name registration is not available" },
        { status: 410 }
    )
}

export async function GET(request: NextRequest) {
    const nameParam = request.nextUrl.searchParams.get("name")
    if (!nameParam) {
        return NextResponse.json({ error: "Missing name" }, { status: 400 })
    }
    return NextResponse.json({ available: false, error: "Not available" })
}
