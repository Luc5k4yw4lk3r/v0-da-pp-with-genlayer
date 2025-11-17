"use client"

import { useEffect, useState, useCallback } from "react"
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
    value={track}
    className="rounded-full border border-orange-500/30 bg-black/50 px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium transition-all hover:bg-orange-500/20 data-[state=active]:border-orange-500 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-600 data-[state=active]:to-red-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-orange-500/50 data-[state=active]:scale-105"
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

  // Fetch inicial cuando se monta el componente
  useEffect(() => {
    fetchLeaderboards()
  }, [fetchLeaderboards])

  // Refrescar cuando cambie el trigger externo (después de evaluar experiencia)
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
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
      <Card className="bg-black/40 border-orange-500/20 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-white">Leaderboards</CardTitle>
          <CardDescription className="text-white/60">Loading rankings...</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <>
      <Card className="bg-black/40 border-orange-500/20 backdrop-blur">
        <CardHeader className="text-center pb-8">
          <CardTitle className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-orange-500 to-red-500 uppercase tracking-tight mb-4">
            LEADERBOARD
          </CardTitle>
          
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="h-px w-16 bg-gradient-to-r from-transparent to-orange-500/50" />
            <div className="h-1 w-1 rounded-full bg-orange-500" />
            <div className="h-px w-16 bg-gradient-to-l from-transparent to-orange-500/50" />
          </div>
          
          <CardDescription className="text-base sm:text-lg text-white/80 font-medium">
            Ranked by an AI Jury
          </CardDescription>
          <p className="text-sm text-white/60 mt-1">
            Each submission is evaluated by an intelligent contract through a consensus of LLMs
          </p>
        </CardHeader>
        <CardContent className="p-3 sm:p-6">
          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className="inline-flex h-auto w-full flex-wrap gap-1.5 sm:gap-2 bg-transparent p-0 overflow-x-auto justify-center mb-8">
              {TRACKS.map((track) => (
                <TabTriggerMemo key={track} track={track} />
              ))}
            </TabsList>

            {TRACKS.map((track) => (
              <TabsContent key={track} value={track} className="mt-6">
                {leaderboards[track]?.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    {leaderboards[track].map((entry, index) => (
                      <div
                        key={`${entry.timestamp}-${index}`}
                        className="group relative overflow-hidden rounded-xl border-2 border-orange-500/20 bg-gradient-to-b from-zinc-900 to-black transition-all hover:border-orange-500/60 hover:scale-105 cursor-pointer shadow-xl hover:shadow-2xl hover:shadow-orange-500/20"
                        onClick={() => handleEntryClick(entry, index)}
                      >
                        {/* Image as main focus */}
                        {entry.imageUrl ? (
                          <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-800">
                            <img
                              src={entry.imageUrl || "/placeholder.svg"}
                              alt="Entry"
                              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                              onError={(e) => {
                                e.currentTarget.src = "/grilled-steak.png"
                              }}
                            />
                            
                            {/* Gradient overlay for better text visibility */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                            
                            {/* Rank badge - top left */}
                            <div className="absolute top-3 left-3 flex items-center justify-center h-12 w-12 rounded-full bg-black/80 backdrop-blur border-2 border-orange-500/50 shadow-lg">
                              <span className="text-xl font-black text-white">#{index + 1}</span>
                            </div>
                            
                            {/* Score badge - top right with steak icon */}
                            <div className="absolute top-3 right-3 flex items-center gap-2 px-3 py-2 rounded-full bg-gradient-to-r from-red-600 to-orange-600 backdrop-blur border border-white/20 shadow-lg">
                              <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                              </svg>
                              <span className="text-lg font-bold text-white">{entry.score}</span>
                            </div>
                            
                            {/* Expand icon */}
                            <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="p-2 rounded-full bg-black/60 backdrop-blur">
                                <Maximize2 className="h-4 w-4 text-white" />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="relative aspect-[4/3] w-full flex items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900">
                            <Trophy className="h-16 w-16 text-orange-500/30" />
                          </div>
                        )}
                        
                        {/* Content below image */}
                        <div className="p-4 space-y-2">
                          {/* Username */}
                          {entry.username ? (
                            <p className="font-bold text-white flex items-center gap-2 truncate">
                              <User className="h-4 w-4 text-orange-500 flex-shrink-0" />
                              <span className="truncate">{entry.username}</span>
                            </p>
                          ) : (
                            <p className="text-sm text-white/60 italic">Anonymous</p>
                          )}
                          
                          {/* AI Message */}
                          {entry.message && (
                            <div className="rounded-md bg-orange-500/10 border border-orange-500/20 p-2">
                              <p className="text-xs text-orange-400/90 line-clamp-2 italic">"{entry.message}"</p>
                            </div>
                          )}
                          
                          {/* Tags */}
                          {entry.tags && entry.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {entry.tags.slice(0, 3).map((tag, i) => (
                                <span
                                  key={i}
                                  className="rounded-full bg-orange-500/20 border border-orange-500/30 px-2 py-0.5 text-xs text-orange-300 font-medium"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                          
                          {/* Date */}
                          <p className="text-xs text-white/40">
                            {new Date(entry.timestamp).toLocaleDateString("en-US")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Trophy className="h-12 w-12 text-orange-500/30 mb-3" />
                    <p className="text-white/60">No entries in this track yet</p>
                    <p className="text-sm text-white/40">Be the first to submit your experience!</p>
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={!!selectedEntry} onOpenChange={(open) => !open && setSelectedEntry(null)}>
        <DialogContent className="w-[95vw] sm:w-full max-w-5xl max-h-[90vh] overflow-y-auto bg-zinc-900 border-orange-500/30 text-white p-4 sm:p-6">
          {selectedEntry && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 sm:gap-3 mb-2">
                  <div className="flex items-center justify-center h-12 w-12 rounded-full bg-black/80 backdrop-blur border-2 border-orange-500/50">
                    <span className="text-xl font-black text-white">#{selectedRank + 1}</span>
                  </div>
                  <DialogTitle className="text-lg sm:text-2xl text-white">Leaderboard Entry Details</DialogTitle>
                </div>
                <DialogDescription className="text-xs sm:text-sm text-white/60">
                  Submitted on {new Date(selectedEntry.timestamp).toLocaleDateString("en-US", {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 sm:space-y-6 mt-4">
                {/* Score Display */}
                <div className="flex items-center justify-center py-2 sm:py-4">
                  <div className="text-center">
                    <p className="text-xs sm:text-sm font-medium text-orange-400 mb-2 uppercase tracking-wide">Score</p>
                    <p className={`text-5xl sm:text-6xl lg:text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500`}>
                      {selectedEntry.score}
                    </p>
                    <p className="text-xs text-white/60 mt-2">out of 100</p>
                  </div>
                </div>

                {/* Image - Large Display */}
                {selectedEntry.imageUrl && (
                  <div className="relative w-full min-h-[250px] sm:min-h-[350px] md:min-h-[400px] max-h-[400px] sm:max-h-[500px] md:max-h-[600px] overflow-hidden rounded-xl border-2 border-orange-500/30 bg-black flex items-center justify-center">
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
                  <div className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-orange-500/10 rounded-lg border border-orange-500/20">
                    <div className="p-1.5 sm:p-2 bg-orange-500/20 rounded-full flex-shrink-0">
                      <User className="h-4 w-4 sm:h-6 sm:w-6 text-orange-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-orange-400/80 uppercase tracking-wide">Submitted by</p>
                      <p className="text-base sm:text-lg font-semibold text-white truncate">{selectedEntry.username}</p>
                    </div>
                  </div>
                )}

                {/* Description */}
                {selectedEntry.description && (
                  <div className="p-3 sm:p-4 bg-zinc-800/50 rounded-lg border border-orange-500/20">
                    <p className="text-xs sm:text-sm font-medium text-orange-400 mb-2 uppercase tracking-wide">Description</p>
                    <p className="text-sm sm:text-base text-white/90 leading-relaxed break-words">{selectedEntry.description}</p>
                  </div>
                )}

                {/* Message */}
                {selectedEntry.message && (
                  <div className="border-l-4 border-orange-500 pl-3 sm:pl-6 py-3 sm:py-4 bg-orange-500/10 rounded-r-lg">
                    <p className="text-xs sm:text-sm font-semibold text-orange-400 mb-2 uppercase tracking-wide">AI Consensus Evaluation</p>
                    <p className="text-sm sm:text-base lg:text-lg italic text-white/90 leading-relaxed break-words">"{selectedEntry.message}"</p>
                  </div>
                )}

                {/* Tags */}
                {selectedEntry.tags && selectedEntry.tags.length > 0 && (
                  <div className="p-3 sm:p-4 bg-zinc-800/50 rounded-lg border border-orange-500/20">
                    <p className="text-xs sm:text-sm font-medium text-orange-400 mb-2 sm:mb-3 uppercase tracking-wide">Categories</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedEntry.tags.map((tag, i) => (
                        <span
                          key={i}
                          className="rounded-full bg-orange-500/20 border border-orange-500/40 px-3 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm font-semibold text-orange-300"
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
