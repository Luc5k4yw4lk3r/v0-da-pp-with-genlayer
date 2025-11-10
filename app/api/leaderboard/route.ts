import { type NextRequest, NextResponse } from "next/server"
import { addToLeaderboard, getLeaderboard, getAllLeaderboards, type LeaderboardEntry, type Track } from "@/lib/redis"

export async function POST(request: NextRequest) {
  try {
    console.log("[v0] POST /api/leaderboard called")

    const body = await request.json()
    console.log("[v0] Request body:", body)

    const { track, entry } = body as { track: Track; entry: LeaderboardEntry }

    if (!track || !entry) {
      console.log("[v0] Missing track or entry")
      return NextResponse.json({ error: "Track and entry are required" }, { status: 400 })
    }

    console.log("[v0] Adding to leaderboard:", { track, score: entry.score })

    const result = await addToLeaderboard(track, entry)

    console.log("[v0] Result:", result)

    return NextResponse.json(result)
  } catch (error: any) {
    console.error("[v0] Error adding to leaderboard:", error)
    return NextResponse.json(
      {
        error: error.message || "Failed to add to leaderboard",
        details: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500 },
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log("[v0] GET /api/leaderboard called")
    const { searchParams } = new URL(request.url)
    const track = searchParams.get("track") as Track | null

    if (track) {
      console.log("[v0] Getting leaderboard for track:", track)
      const leaderboard = await getLeaderboard(track)
      return NextResponse.json({ track, entries: leaderboard || [] })
    } else {
      console.log("[v0] Getting all leaderboards")
      const allLeaderboards = await getAllLeaderboards()
      return NextResponse.json(allLeaderboards || {})
    }
  } catch (error: any) {
    console.error("[v0] Error getting leaderboard:", error)
    return NextResponse.json(
      {
        error: "Failed to get leaderboard",
        message: error?.message || "Unknown error",
        details: process.env.NODE_ENV === "development" ? error?.stack : undefined,
      },
      { status: 500 },
    )
  }
}
