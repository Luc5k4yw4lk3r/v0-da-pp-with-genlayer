"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Trophy, Medal, Award, User } from "lucide-react"
import type { LeaderboardEntry } from "@/lib/redis"
import { TRACKS } from "@/lib/redis"
import { useTranslations } from "@/lib/i18n"

interface LeaderboardProps {
  onRefreshReady?: (refreshFn: () => void) => void
}

export default function Leaderboard({ onRefreshReady }: LeaderboardProps) {
  const t = useTranslations()

  const [leaderboards, setLeaderboards] = useState<Record<string, LeaderboardEntry[]>>({})
  const [loading, setLoading] = useState(true)

  const fetchLeaderboards = async () => {
    try {
      const response = await fetch("/api/leaderboard")
      const data = await response.json()
      setLeaderboards(data)
    } catch (error) {
      console.error("[v0] Error fetching leaderboards:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLeaderboards()
    if (onRefreshReady) {
      onRefreshReady(fetchLeaderboards)
    }
  }, [])

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 0:
        return <Trophy className="h-6 w-6 text-yellow-500" />
      case 1:
        return <Medal className="h-6 w-6 text-gray-400" />
      case 2:
        return <Award className="h-6 w-6 text-amber-600" />
      default:
        return <span className="text-lg font-bold text-muted-foreground">#{rank + 1}</span>
    }
  }

  const getScoreColor = (score: number): string => {
    if (score >= 81) return "text-success"
    if (score >= 51) return "text-info"
    if (score >= 21) return "text-warning"
    return "text-destructive"
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t.leaderboardTitle}</CardTitle>
          <CardDescription>{t.loadingRankings}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-6 w-6 text-yellow-500" />
          {t.leaderboardTitle}
        </CardTitle>
        <CardDescription>{t.leaderboardDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={TRACKS[0]} className="w-full">
          <TabsList className="inline-flex h-auto w-full flex-wrap gap-2 bg-transparent p-0">
            {TRACKS.map((track) => (
              <TabsTrigger
                key={track}
                value={track}
                className="rounded-full border border-border bg-background px-4 py-2 text-sm font-medium transition-all hover:bg-accent data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                {track}
              </TabsTrigger>
            ))}
          </TabsList>

          {TRACKS.map((track) => (
            <TabsContent key={track} value={track} className="mt-6">
              {leaderboards[track]?.length > 0 ? (
                <div className="space-y-3">
                  {leaderboards[track].map((entry, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-4 rounded-lg border border-border bg-card p-4 transition-all hover:border-primary/50"
                    >
                      <div className="flex flex-col items-center justify-center min-w-[48px]">
                        {getRankIcon(index)}
                        <span className={`mt-1 text-2xl font-bold ${getScoreColor(entry.score)}`}>{entry.score}</span>
                      </div>

                      {entry.imageUrl && (
                        <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-md border border-border">
                          <img
                            src={entry.imageUrl || "/placeholder.svg"}
                            alt="Entry"
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              e.currentTarget.src = "/placeholder.svg?height=80&width=80"
                            }}
                          />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {entry.username ? (
                            <p className="font-semibold text-foreground flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {entry.username}
                            </p>
                          ) : (
                            <p className="text-sm text-muted-foreground italic">{t.anonymous}</p>
                          )}
                        </div>
                        <p className="text-sm text-foreground line-clamp-2">{entry.description}</p>
                        {entry.message && (
                          <p className="mt-2 text-xs italic text-muted-foreground border-l-2 border-accent pl-2">
                            "{entry.message}"
                          </p>
                        )}
                        {entry.tags && entry.tags.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {entry.tags.map((tag, i) => (
                              <span
                                key={i}
                                className="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(entry.timestamp).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Trophy className="h-12 w-12 text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">{t.noEntries}</p>
                  <p className="text-sm text-muted-foreground">{t.beFirst}</p>
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  )
}
