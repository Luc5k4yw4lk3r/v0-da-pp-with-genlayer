"use client"

import { useEffect, useState, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Trophy, Medal, Award, User, Maximize2, Share2 } from 'lucide-react'
import type { LeaderboardEntry, Track } from "@/lib/redis"
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
  const router = useRouter()
  const searchParams = useSearchParams()
  const [leaderboards, setLeaderboards] = useState<Record<string, LeaderboardEntry[]>>({})
  const [loading, setLoading] = useState(true)

  // Get active tab from URL or default to "Steak"
  const getInitialTab = useCallback((): Track => {
    const trackParam = searchParams.get('track')
    if (trackParam) {
      // Find matching track (case-insensitive)
      const matchingTrack = TRACKS.find(
        (t) => t.toLowerCase() === trackParam.toLowerCase()
      ) as Track | undefined
      if (matchingTrack) {
        return matchingTrack
      }
    }
    // Default to "Steak"
    return 'Steak' as Track
  }, [searchParams])

  const [activeTab, setActiveTab] = useState<Track>(getInitialTab)
  const [selectedEntry, setSelectedEntry] = useState<LeaderboardEntry | null>(null)
  const [selectedRank, setSelectedRank] = useState<number>(0)

  // Update URL when tab changes
  const handleTabChange = useCallback((value: string) => {
    const track = value as Track
    setActiveTab(track)
    // Update URL without page reload
    const params = new URLSearchParams(searchParams.toString())
    params.set('track', track)
    router.push(`?${params.toString()}`, { scroll: false })
  }, [router, searchParams])

  // Sync with URL changes (e.g., browser back/forward)
  useEffect(() => {
    const trackParam = searchParams.get('track')
    if (trackParam) {
      const matchingTrack = TRACKS.find(
        (t) => t.toLowerCase() === trackParam.toLowerCase()
      ) as Track | undefined
      if (matchingTrack && matchingTrack !== activeTab) {
        setActiveTab(matchingTrack)
      }
    } else if (activeTab !== 'Steak') {
      // If no track param and not already on Steak, set to Steak
      setActiveTab('Steak')
    }
  }, [searchParams, activeTab])

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

  const shareToSocialMedia = useCallback((platform: 'twitter' | 'facebook' | 'telegram' | 'instagram', entry: LeaderboardEntry, rank: number) => {
    // Build URL with track parameter for better viralization
    const baseUrl = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : ''
    const pageUrl = `${baseUrl}?track=${encodeURIComponent(activeTab)}`
    const rankText = rank === 0 ? '🥇 1st' : rank === 1 ? '🥈 2nd' : rank === 2 ? '🥉 3rd' : `#${rank + 1}`
    const text = `${rankText} place on Proof of Steak leaderboard (${activeTab} track)! Score: ${entry.score}/100 🥩\n\n${entry.description ? entry.description.substring(0, 100) + '...' : 'Check out my authentic Argentine steak experience!'}`
    const imageUrl = entry.imageUrl || ''

    let shareUrl = ''

    switch (platform) {
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(pageUrl)}`
        break
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}&quote=${encodeURIComponent(text)}`
        break
      case 'telegram':
        shareUrl = `https://t.me/share/url?url=${encodeURIComponent(pageUrl)}&text=${encodeURIComponent(text)}`
        break
      case 'instagram':
        // Instagram doesn't support direct web sharing, so we'll download the image
        if (imageUrl) {
          // Create a temporary link to download the image
          const link = document.createElement('a')
          link.href = imageUrl
          link.download = `proof-of-steak-${rank + 1}-${entry.score}.jpg`
          link.target = '_blank'
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)

          // Show a helpful message
          setTimeout(() => {
            alert('Image downloaded! You can now upload it to Instagram from your device.')
          }, 500)
          return
        } else {
          alert('No image available to share.')
          return
        }
    }

    if (shareUrl) {
      window.open(shareUrl, '_blank', 'width=600,height=400')
    }
  }, [activeTab])

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
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
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
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

                            {/* Rank badge - top left */}
                            <div className="absolute top-3 left-3 flex items-center justify-center h-12 w-12 rounded-full bg-black/80 backdrop-blur border-2 border-orange-500/50 shadow-lg">
                              <span className="text-xl font-black text-white">#{index + 1}</span>
                            </div>

                            {/* Score badge - top right with steak icon */}
                            <div className="absolute top-3 right-3 flex items-center gap-2 px-3 py-2 rounded-full bg-gradient-to-r from-red-600 to-orange-600 backdrop-blur border border-white/20 shadow-lg">
                              <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
                              </svg>
                              <span className="text-lg font-bold text-white">{entry.score}</span>
                            </div>

                            {/* Expand icon */}
                            <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="p-2 rounded-full bg-black/60 backdrop-blur">
                                <Maximize2 className="h-4 w-4 text-white" />
                              </div>
                            </div>

                            <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2">
                              {/* Username */}
                              {entry.username ? (
                                <p className="font-bold text-white flex items-center gap-2 truncate drop-shadow-lg">
                                  <User className="h-4 w-4 text-orange-500 flex-shrink-0" />
                                  <span className="truncate">{entry.username}</span>
                                </p>
                              ) : (
                                <p className="text-sm text-white/60 italic drop-shadow-lg">Anonymous</p>
                              )}

                              {/* AI Message */}
                              {entry.message && (
                                <div className="rounded-md bg-black/60 backdrop-blur border border-orange-500/30 p-2">
                                  <p className="text-xs text-orange-300 line-clamp-2 italic">"{entry.message}"</p>
                                </div>
                              )}

                              {/* Tags and Date in same row */}
                              <div className="flex items-center justify-between gap-2">
                                {/* Tags */}
                                {entry.tags && entry.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {entry.tags.slice(0, 2).map((tag, i) => (
                                      <span
                                        key={i}
                                        className="rounded-full bg-orange-500/30 backdrop-blur border border-orange-500/40 px-2 py-0.5 text-xs text-orange-200 font-medium"
                                      >
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {/* Date */}
                                <p className="text-xs text-white/60 drop-shadow-lg whitespace-nowrap">
                                  {new Date(entry.timestamp).toLocaleDateString("en-US")}
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="relative aspect-[4/3] w-full flex items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900">
                            <Trophy className="h-16 w-16 text-orange-500/30" />
                          </div>
                        )}
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

                {/* Share Section */}
                <div className="p-3 sm:p-4 bg-zinc-800/50 rounded-lg border border-orange-500/20">
                  <p className="text-xs sm:text-sm font-medium text-orange-400 mb-3 sm:mb-4 uppercase tracking-wide flex items-center gap-2">
                    <Share2 className="h-4 w-4" />
                    Share on Social Media
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                    {/* Twitter/X */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        shareToSocialMedia('twitter', selectedEntry, selectedRank)
                      }}
                      className="flex flex-col items-center justify-center gap-2 p-3 sm:p-4 rounded-lg bg-black/50 border border-orange-500/30 hover:border-orange-500/60 hover:bg-orange-500/10 transition-all group"
                    >
                      <svg className="h-6 w-6 sm:h-7 sm:w-7 text-white group-hover:text-orange-400 transition-colors" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                      </svg>
                      <span className="text-xs sm:text-sm font-medium text-white/80 group-hover:text-orange-400 transition-colors">Twitter/X</span>
                    </button>

                    {/* Facebook */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        shareToSocialMedia('facebook', selectedEntry, selectedRank)
                      }}
                      className="flex flex-col items-center justify-center gap-2 p-3 sm:p-4 rounded-lg bg-black/50 border border-orange-500/30 hover:border-orange-500/60 hover:bg-orange-500/10 transition-all group"
                    >
                      <svg className="h-6 w-6 sm:h-7 sm:w-7 text-white group-hover:text-orange-400 transition-colors" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                      </svg>
                      <span className="text-xs sm:text-sm font-medium text-white/80 group-hover:text-orange-400 transition-colors">Facebook</span>
                    </button>

                    {/* Telegram */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        shareToSocialMedia('telegram', selectedEntry, selectedRank)
                      }}
                      className="flex flex-col items-center justify-center gap-2 p-3 sm:p-4 rounded-lg bg-black/50 border border-orange-500/30 hover:border-orange-500/60 hover:bg-orange-500/10 transition-all group"
                    >
                      <svg className="h-6 w-6 sm:h-7 sm:w-7 text-white group-hover:text-orange-400 transition-colors" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                      </svg>
                      <span className="text-xs sm:text-sm font-medium text-white/80 group-hover:text-orange-400 transition-colors">Telegram</span>
                    </button>

                    {/* Instagram */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        shareToSocialMedia('instagram', selectedEntry, selectedRank)
                      }}
                      className="flex flex-col items-center justify-center gap-2 p-3 sm:p-4 rounded-lg bg-black/50 border border-orange-500/30 hover:border-orange-500/60 hover:bg-orange-500/10 transition-all group"
                    >
                      <svg className="h-6 w-6 sm:h-7 sm:w-7 text-white group-hover:text-orange-400 transition-colors" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                      </svg>
                      <span className="text-xs sm:text-sm font-medium text-white/80 group-hover:text-orange-400 transition-colors">Instagram</span>
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
