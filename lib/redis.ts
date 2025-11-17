import { Redis } from "@upstash/redis"
import type { TransactionDetails } from "@/lib/contracts/proof-of-argentinean-experience"

export interface LeaderboardEntry {
  score: number
  description: string
  message?: string
  imageUrl?: string
  username?: string
  email?: string
  timestamp: number
  tags: string[]
  consensusResponse?: {
    transactionHash?: string
    transactionDetails?: TransactionDetails
  }
}

const TRACKS = [
  "food",
  "Steak",
  "traditions",
  "Cultural shocks",
  "Touristic locations",
  "Sports",
  "Famous people",
  "Crypto",
  "Easter eggs",
] as const

export type Track = (typeof TRACKS)[number]

const MAX_ENTRIES_PER_TRACK = 5

function serializeError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}\nStack: ${error.stack || 'No stack trace'}`
  }
  if (typeof error === 'object' && error !== null) {
    try {
      return JSON.stringify(error, null, 2)
    } catch {
      return String(error)
    }
  }
  return String(error)
}

function getRedisClient() {
  const url = process.env.UPSTASH_KV_REST_API_URL?.replace(/^["']|["']$/g, "").trim()
  const token = process.env.UPSTASH_KV_REST_API_TOKEN?.replace(/^["']|["']$/g, "").trim()

  console.log("[v0] Redis URL:", url ? "✓ Found" : "✗ Missing")
  console.log("[v0] Redis Token:", token ? "✓ Found" : "✗ Missing")

  if (!url || !token) {
    throw new Error(
      "Missing Upstash Redis environment variables. Please check UPSTASH_KV_REST_API_URL and UPSTASH_KV_REST_API_TOKEN",
    )
  }

  return new Redis({
    url,
    token,
  })
}

export async function addToLeaderboard(
  track: Track,
  entry: LeaderboardEntry,
): Promise<{ added: boolean; rank?: number }> {
  try {
    const redis = getRedisClient()
    const key = `leaderboard:${track.toLowerCase().replace(/\s+/g, "_")}`

    console.log("[v0] Adding to leaderboard:", { track, key, score: entry.score })

    await redis.zadd(key, {
      score: entry.score,
      member: JSON.stringify(entry),
    })

    const count = await redis.zcard(key)
    if (count > MAX_ENTRIES_PER_TRACK) {
      await redis.zremrangebyrank(key, 0, count - MAX_ENTRIES_PER_TRACK - 1)
    }

    const rank = await redis.zrevrank(key, JSON.stringify(entry))

    console.log("[v0] Added successfully:", { rank, count })

    return {
      added: rank !== null && rank < MAX_ENTRIES_PER_TRACK,
      rank: rank !== null ? rank + 1 : undefined,
    }
  } catch (error) {
    console.error("[v0] Error in addToLeaderboard:", serializeError(error))
    throw error
  }
}

export async function getLeaderboard(track: Track): Promise<LeaderboardEntry[]> {
  try {
    const redis = getRedisClient()
    const key = `leaderboard:${track.toLowerCase().replace(/\s+/g, "_")}`

    console.log("[v0] Getting leaderboard for:", { track, key })

    try {
      const exists = await redis.exists(key)
      console.log("[v0] Key exists check:", { key, exists })

      if (exists === 0) {
        console.log("[v0] Key does not exist yet, returning empty array:", key)
        return []
      }

      // Get count first to calculate the correct range for highest scores
      const count = await redis.zcard(key)
      if (count === 0) {
        console.log("[v0] Leaderboard is empty")
        return []
      }

      // Calculate range: we want the last MAX_ENTRIES_PER_TRACK elements
      // Since zrange returns in ascending order, we need the last N elements
      const start = Math.max(0, count - MAX_ENTRIES_PER_TRACK)
      const end = count - 1

      // Use zrange to get entries (in ascending order by score)
      // Then we'll reverse to get descending order (highest score first)
      // Upstash Redis doesn't support rev option or zrevrange, so we reverse manually
      let entries: any
      try {
        // Get entries from the end of the sorted set (highest scores)
        entries = await redis.zrange(key, start, end)

        // Reverse to get descending order (highest to lowest score)
        if (Array.isArray(entries) && entries.length > 0) {
          entries = entries.reverse()
        }
      } catch (zrangeError) {
        console.error("[v0] zrange error:", serializeError(zrangeError))
        return []
      }

      console.log("[v0] zrange result type:", typeof entries, "isArray:", Array.isArray(entries))

      // Handle null, undefined, or non-array responses
      if (entries == null) {
        console.log("[v0] zrange returned null/undefined, returning empty")
        return []
      }

      // Ensure entries is an array
      if (!Array.isArray(entries)) {
        console.log("[v0] zrange returned non-array, converting:", typeof entries, entries)
        // Try to convert to array if it's iterable
        if (entries && typeof entries === 'object' && 'length' in entries) {
          entries = Array.from(entries)
        } else {
          return []
        }
      }

      if (entries.length === 0) {
        console.log("[v0] zrange returned empty array")
        return []
      }

      console.log("[v0] Retrieved entries:", entries.length)

      const parsedEntries = entries
        .map((entry: any) => {
          try {
            if (typeof entry === "object" && entry !== null) {
              return entry as LeaderboardEntry
            }
            if (typeof entry === "string") {
              return JSON.parse(entry) as LeaderboardEntry
            }
            console.warn("[v0] Unexpected entry type:", typeof entry, entry)
            return null
          } catch (parseError) {
            console.error("[v0] Error parsing entry:", {
              entry: typeof entry === 'object' ? JSON.stringify(entry) : entry,
              error: serializeError(parseError)
            })
            return null
          }
        })
        .filter((entry): entry is LeaderboardEntry => entry !== null)

      return parsedEntries
    } catch (redisError) {
      const errorMessage = redisError instanceof Error
        ? redisError.message
        : String(redisError)
      const errorStack = redisError instanceof Error
        ? redisError.stack
        : undefined

      console.error("[v0] Redis operation error:", {
        track,
        key,
        errorMessage,
        errorStack,
        errorType: typeof redisError,
        errorString: serializeError(redisError)
      })
      return []
    }
  } catch (error) {
    console.error("[v0] Error in getLeaderboard:", {
      track,
      error: serializeError(error)
    })
    return []
  }
}

export async function getAllLeaderboards(): Promise<Record<Track, LeaderboardEntry[]>> {
  try {
    console.log("[v0] Getting all leaderboards for tracks:", TRACKS)

    const result: Record<string, LeaderboardEntry[]> = {}

    const promises = TRACKS.map(async (track) => {
      try {
        const entries = await getLeaderboard(track)
        return { track, entries, success: true }
      } catch (error) {
        console.error(`[v0] Error getting leaderboard for ${track}:`, serializeError(error))
        return { track, entries: [], success: false }
      }
    })

    const results = await Promise.allSettled(promises)

    results.forEach((promiseResult) => {
      if (promiseResult.status === "fulfilled") {
        const { track, entries } = promiseResult.value
        result[track] = entries
      }
    })

    console.log("[v0] All leaderboards retrieved successfully")

    return result as Record<Track, LeaderboardEntry[]>
  } catch (error) {
    console.error("[v0] Error in getAllLeaderboards:", serializeError(error))
    const emptyResult: Record<string, LeaderboardEntry[]> = {}
    TRACKS.forEach((track) => {
      emptyResult[track] = []
    })
    return emptyResult as Record<Track, LeaderboardEntry[]>
  }
}

export async function isEligibleForTrack(track: Track, score: number): Promise<boolean> {
  try {
    const redis = getRedisClient()
    const key = `leaderboard:${track.toLowerCase().replace(/\s+/g, "_")}`

    const exists = await redis.exists(key)
    if (exists === 0) {
      return true // Empty leaderboard, always eligible
    }

    const count = await redis.zcard(key)

    if (count < MAX_ENTRIES_PER_TRACK) {
      return true
    }

    const lowestEntry = await redis.zrange(key, 0, 0)
    if (!lowestEntry || lowestEntry.length === 0) {
      return true
    }

    const entry = typeof lowestEntry[0] === "object" ? lowestEntry[0] : JSON.parse(lowestEntry[0] as string)
    const lowestScore = (entry as LeaderboardEntry).score

    return score > lowestScore
  } catch (error) {
    console.error("[v0] Error checking eligibility:", serializeError(error))
    return false
  }
}

export { TRACKS }
