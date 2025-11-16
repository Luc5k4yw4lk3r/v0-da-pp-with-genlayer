"use client"

import { useEffect, useState, useRef, useMemo, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Trophy, Medal, Award, User, Maximize2 } from 'lucide-react'
import type { LeaderboardEntry } from "@/lib/redis"
import { TRACKS } from "@/lib/redis"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

const TabTriggerMemo = ({ track }: { track: string }) => (
  <TabsTrigger
    key={track}
    value={track}
    className="rounded-full border border-border bg-background px-4 py-2 text-sm font-medium transition-all hover:bg-accent data-[state=active]:border-primary data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-primary/50 data-[state=active]:scale-105"
  >
    {track}
  </TabsTrigger>
)

export default function Leaderboard({ refreshTrigger }: { refreshTrigger?: number }) {
  const [leaderboards, setLeaderboards] = useState<Record<string, LeaderboardEntry[]>>({})
  const [loading, setLoading] = useState(true)
  const [defaultTab] = useState(() => TRACKS[Math.floor(Math.random() * TRACKS.length)])
  const [selectedEntry, setSelectedEntry] = useState<LeaderboardEntry | null>(null)
  const [selectedRank, setSelectedRank] = useState<number>(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const fetchLeaderboards = useCallback(async () => {
    try {
      const response = await fetch("/api/leaderboard")
      const data = await response.json()
      setLeaderboards(data)
    } catch (error) {
      console.error("[v0] Error fetching leaderboards:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLeaderboards()

    // Polling cada 5 segundos para actualizaciones automáticas
    intervalRef.current = setInterval(() => {
      fetchLeaderboards()
    }, 5000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [fetchLeaderboards])

  // Refrescar cuando cambie el trigger externo
  useEffect(() => {
    if (refreshTrigger !== undefined) {
      fetchLeaderboards()
    }
  }, [refreshTrigger, fetchLeaderboards])

  const getRankIcon = useCallback((rank: number) => {
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
  }, [])

  const getScoreColor = useCallback((score: number): string => {
    if (score >= 81) return "text-success"
    if (score >= 51) return "text-info"
    if (score >= 21) return "text-warning"
    return "text-destructive"
  }, [])

  const handleEntryClick = useCallback((entry: LeaderboardEntry, index: number) => {
    setSelectedEntry(entry)
    setSelectedRank(index)
  }, [])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Leaderboards</CardTitle>
          <CardDescription>Loading rankings...</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-6 w-6 text-yellow-500" />
            Leaderboards - Top 5
          </CardTitle>
          <CardDescription>Top scores by category</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className="inline-flex h-auto w-full flex-wrap gap-2 bg-transparent p-0">
              {TRACKS.map((track) => (
                <TabTriggerMemo key={track} track={track} />
              ))}
            </TabsList>

            {TRACKS.map((track) => (
              <TabsContent key={track} value={track} className="mt-6">
                {leaderboards[track]?.length > 0 ? (
                  <div className="space-y-3">
                    {leaderboards[track].map((entry, index) => (
                      <div
                        key={`${entry.timestamp}-${index}`}
                        className="flex items-start gap-4 rounded-lg border border-border bg-card p-4 transition-all hover:border-primary/50 cursor-pointer group relative"
                        onClick={() => handleEntryClick(entry, index)}
                      >
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Maximize2 className="h-4 w-4 text-muted-foreground" />
                        </div>

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
                              <p className="text-sm text-muted-foreground italic">Anonymous</p>
                            )}
                          </div>
                          {entry.message && (
                            <div className="mt-2 rounded-md bg-primary/5 border-l-2 border-primary pl-3 py-1.5">
                              <p className="text-xs font-medium text-primary/80 mb-0.5">AI Consensus:</p>
                              <p className="text-xs italic text-foreground">"{entry.message}"</p>
                            </div>
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
                            {new Date(entry.timestamp).toLocaleDateString("en-US")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Trophy className="h-12 w-12 text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground">No entries in this track yet</p>
                    <p className="text-sm text-muted-foreground">Be the first to submit your experience!</p>
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={!!selectedEntry} onOpenChange={(open) => !open && setSelectedEntry(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto !bg-white">
          {selectedEntry && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3 mb-2">
                  {getRankIcon(selectedRank)}
                  <DialogTitle className="text-2xl">Leaderboard Entry Details</DialogTitle>
                </div>
                <DialogDescription>
                  Submitted on {new Date(selectedEntry.timestamp).toLocaleDateString("en-US", {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                {/* Score Display */}
                <div className="flex items-center justify-center py-4">
                  <div className="text-center">
                    <p className="text-sm font-medium text-muted-foreground mb-2 uppercase tracking-wide">Score</p>
                    <p className={`text-7xl font-bold ${getScoreColor(selectedEntry.score)}`}>
                      {selectedEntry.score}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">out of 100</p>
                  </div>
                </div>

                {/* Image - Large Display */}
                {selectedEntry.imageUrl && (
                  <div className="relative w-full min-h-[400px] max-h-[600px] overflow-hidden rounded-xl border-2 border-border bg-muted flex items-center justify-center">
                    <img
                      src={selectedEntry.imageUrl || "/placeholder.svg"}
                      alt="Entry"
                      className="max-w-full max-h-full object-contain"
                      onError={(e) => {
                        e.currentTarget.src = "/placeholder.svg?height=400&width=600"
                      }}
                    />
                  </div>
                )}

                {/* User Info */}
                {selectedEntry.username && (
                  <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg border border-border">
                    <div className="p-2 bg-primary/10 rounded-full">
                      <User className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Submitted by</p>
                      <p className="text-lg font-semibold text-foreground">{selectedEntry.username}</p>
                    </div>
                  </div>
                )}

                {/* Description */}
                {selectedEntry.description && (
                  <div className="p-4 bg-accent/30 rounded-lg border border-border">
                    <p className="text-sm font-medium text-muted-foreground mb-2 uppercase tracking-wide">Description</p>
                    <p className="text-base text-foreground leading-relaxed">{selectedEntry.description}</p>
                  </div>
                )}

                {/* Message */}
                {selectedEntry.message && (
                  <div className="border-l-4 border-primary pl-6 py-4 bg-primary/5 rounded-r-lg">
                    <p className="text-sm font-semibold text-primary mb-2 uppercase tracking-wide">AI Consensus Evaluation</p>
                    <p className="text-lg italic text-foreground leading-relaxed">"{selectedEntry.message}"</p>
                  </div>
                )}

                {/* Tags */}
                {selectedEntry.tags && selectedEntry.tags.length > 0 && (
                  <div className="p-4 bg-muted/30 rounded-lg border border-border">
                    <p className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">Categories</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedEntry.tags.map((tag, i) => (
                        <span
                          key={i}
                          className="rounded-full bg-primary/10 border border-primary/30 px-4 py-2 text-sm font-semibold text-primary"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
