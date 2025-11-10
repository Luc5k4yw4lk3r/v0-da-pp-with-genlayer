import { type NextRequest, NextResponse } from "next/server"
import { isEligibleForTrack, TRACKS } from "@/lib/redis"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const score = Number.parseInt(searchParams.get("score") || "0")
    const track = searchParams.get("track") || ""

    console.log("[v0] Checking eligibility for score:", score, "track:", track)

    if (!track) {
      return NextResponse.json(
        {
          error: "Track parameter is required",
        },
        { status: 400 },
      )
    }

    // Find matching track (case-insensitive)
    const matchingTrack = TRACKS.find((t) => t.toLowerCase() === track.toLowerCase())

    if (!matchingTrack) {
      return NextResponse.json(
        {
          error: "Invalid track",
        },
        { status: 400 },
      )
    }

    // Check if score is eligible for this track
    const eligible = await isEligibleForTrack(matchingTrack, score)

    console.log("[v0] Eligibility result:", { track: matchingTrack, score, eligible })

    return NextResponse.json({
      eligible,
      track: matchingTrack,
    })
  } catch (error: any) {
    console.error("[v0] Error checking eligibility:", error)
    return NextResponse.json(
      {
        error: error.message || "Failed to check eligibility",
        details: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500 },
    )
  }
}
