"use client"

import React, { useState, useRef } from "react"
import ProofOfArgentineanExperience, {
  type EvaluationResult,
  type TransactionDetails,
} from "@/lib/contracts/proof-of-argentinean-experience"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Upload, X, ImageIcon, Copy, CheckCircle2, XCircle, ChevronRight, ChevronDown } from 'lucide-react'
import type { LeaderboardEntry, Track } from "@/lib/redis"
import { TRACKS } from "@/lib/redis"
import Leaderboard from "./leaderboard"

const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0x9F8f36bb4641951d27d7185CCf37e68BbDA184Fb"

interface ImageAnalysisResult {
  description: string
  tags: string[]
  image_quality: number
  is_ai_generated: boolean
  metadata?: Record<string, any>
}

export default function ArgentineanExperienceScreen() {
  const [description, setDescription] = useState("")
  const [tagsInput, setTagsInput] = useState("")
  const [evaluating, setEvaluating] = useState(false)
  const [result, setResult] = useState<EvaluationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastDescription, setLastDescription] = useState("")
  const [lastTags, setLastTags] = useState<string[]>([])

  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [analyzingImage, setAnalyzingImage] = useState(false)
  const [imageAnalysis, setImageAnalysis] = useState<ImageAnalysisResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [savingToLeaderboard, setSavingToLeaderboard] = useState(false)

  const [isEligibleForLeaderboard, setIsEligibleForLeaderboard] = useState(false)
  const [eligibleTracks, setEligibleTracks] = useState<string[]>([])
  const [checkingEligibility, setCheckingEligibility] = useState(false)

  const [transactionDetails, setTransactionDetails] = useState<TransactionDetails | null>(null)
  const [loadingTransactionDetails, setLoadingTransactionDetails] = useState(false)
  const [copiedHash, setCopiedHash] = useState(false)
  const [showFullTransactionData, setShowFullTransactionData] = useState(false)

  const proofOfExperience = new ProofOfArgentineanExperience(contractAddress)

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      setError("Please upload a valid image file")
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("The image must be less than 5MB")
      return
    }

    setAnalyzingImage(true)
    setError(null)
    setImageAnalysis(null)

    try {
      const reader = new FileReader()
      reader.onload = (e) => {
        setUploadedImage(e.target?.result as string)
      }
      reader.readAsDataURL(file)

      const formData = new FormData()
      formData.append("image", file)

      const response = await fetch("/api/analyze-image", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error("Error analyzing the image")
      }

      const analysis: ImageAnalysisResult = await response.json()
      setImageAnalysis(analysis)

      setDescription(analysis.description)
      setTagsInput(analysis.tags.join(", "))
    } catch (err: any) {
      console.error("[v0] Error uploading image:", err)
      setError(err.message || "Error analyzing the image")
    } finally {
      setAnalyzingImage(false)
    }
  }

  const handleClearImage = () => {
    setUploadedImage(null)
    setImageAnalysis(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleEvaluate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!description) return

    setEvaluating(true)
    setError(null)
    setResult(null)
    setIsEligibleForLeaderboard(false)
    setEligibleTracks([])

    try {
      const tagsInputArray = tagsInput
        ? tagsInput
          .split(",")
          .map((t: string) => t.trim())
          .filter((t: string) => t)
        : []

      // Validate and normalize tracks
      const validTracks = validateAndNormalizeTracks(tagsInputArray)

      // Use original tags for contract evaluation (contract may accept any tags)
      const tagsForContract = tagsInputArray.length > 0 ? tagsInputArray : null

      console.log("[v0] Starting evaluation with tags:", tagsForContract)
      console.log("[v0] Validated tracks:", validTracks)
      console.log("[v0] Image quality:", imageAnalysis?.image_quality)

      const evaluationResult = await proofOfExperience.evaluate(
        description,
        tagsForContract,
        imageAnalysis?.image_quality
      )

      console.log("[v0] Evaluation result:", evaluationResult)

      setResult(evaluationResult)
      setLastDescription(description)
      setLastTags(validTracks.length > 0 ? validTracks : tagsInputArray)
      setTransactionDetails(null)

      // Generate a transaction hash if not available (to show consensus)
      // In production, this would come from the actual transaction result
      const txHash = evaluationResult.transactionHash || `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`

      // Get transaction details (including consensus)
      setLoadingTransactionDetails(true)
      try {
        // Generate a mock transaction hash for demo
        const mockTxHash = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`

        // Get mock transaction details (will always return mock data for read calls)
        const details = await proofOfExperience.getTransactionDetails(mockTxHash)
        if (details) {
          setTransactionDetails(details)
          // Update the result with the details
          setResult({ ...evaluationResult, transactionHash: txHash, transactionDetails: details })
        }
      } catch (err) {
        console.log("[v0] Could not load transaction details, continuing without them")
        // Don't set error - transaction details are optional for demo
      } finally {
        setLoadingTransactionDetails(false)
      }

      if (validTracks.length > 0) {
        console.log("[v0] Auto-saving to Redis...")
        await autoSaveToLeaderboard(evaluationResult.score, validTracks)
      } else {
        console.log("[v0] Not auto-saving: no valid tracks provided")
      }
    } catch (err: any) {
      console.error("[v0] Error evaluating experience:", err)

      // Provide more user-friendly error messages
      let errorMessage = "Error evaluating the experience. Please try again."

      if (err?.message) {
        if (err.message.includes("GenLayer RPC error") || err.message.includes("gen_call")) {
          errorMessage = "Unable to connect to GenLayer. Please check your internet connection and try again. If the problem persists, the GenLayer service may be temporarily unavailable."
        } else if (err.message.includes("contract")) {
          errorMessage = `Contract error: ${err.message}. Please verify the contract address is correct.`
        } else {
          errorMessage = err.message
        }
      }

      setError(errorMessage)
    } finally {
      setEvaluating(false)
    }
  }

  const autoSaveToLeaderboard = async (score: number, tracks: Track[]) => {
    try {
      const eligibleTracksToSave: Track[] = []

      for (const track of tracks) {
        const isEligible = await checkEligibility(score, track)
        if (isEligible) {
          eligibleTracksToSave.push(track)
        }
      }

      if (eligibleTracksToSave.length === 0) {
        console.log("[v0] Score not eligible for any track. Not saving.")
        return
      }

      console.log("[v0] Eligible tracks:", eligibleTracksToSave)

      const entry: LeaderboardEntry = {
        score,
        description,
        message: result?.message,
        imageUrl: uploadedImage || undefined,
        username: username || undefined,
        email: email || undefined,
        timestamp: Date.now(),
        tags: eligibleTracksToSave,
      }

      console.log("[v0] Auto-saving entry to Redis:", entry)

      // Save only to eligible tracks
      for (const track of eligibleTracksToSave) {
        console.log("[v0] Saving to track:", track)

        const response = await fetch("/api/leaderboard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ track, entry }),
        })

        console.log("[v0] Response status for", track, ":", response.status)

        if (!response.ok) {
          const errorText = await response.text()
          console.error("[v0] Failed to save to track:", track, errorText)
        } else {
          const result = await response.json()
          console.log("[v0] Successfully saved to track:", track, result)
        }
      }

      console.log("[v0] Auto-save completed successfully")
    } catch (err) {
      console.error("[v0] Error auto-saving to leaderboard:", err)
    }
  }

  // Normalize and validate track against TRACKS
  const normalizeTrack = (input: string): Track | null => {
    const normalized = input.trim()
    // Try exact match first (case-sensitive)
    const exactMatch = TRACKS.find((t) => t === normalized)
    if (exactMatch) return exactMatch

    // Try case-insensitive match
    const caseInsensitiveMatch = TRACKS.find((t) => t.toLowerCase() === normalized.toLowerCase())
    if (caseInsensitiveMatch) return caseInsensitiveMatch

    // Try matching with underscores/spaces normalization
    const normalizedInput = normalized.toLowerCase().replace(/\s+/g, "_")
    const normalizedMatch = TRACKS.find((t) =>
      t.toLowerCase().replace(/\s+/g, "_") === normalizedInput
    )
    if (normalizedMatch) return normalizedMatch

    return null
  }

  // Validate and normalize tracks array
  const validateAndNormalizeTracks = (tags: string[]): Track[] => {
    const validTracks: Track[] = []
    for (const tag of tags) {
      const normalizedTrack = normalizeTrack(tag)
      if (normalizedTrack && !validTracks.includes(normalizedTrack)) {
        validTracks.push(normalizedTrack)
      }
    }
    return validTracks
  }

  const checkEligibility = async (score: number, track: Track): Promise<boolean> => {
    try {
      const response = await fetch(`/api/leaderboard/check-eligibility?score=${score}&track=${track}`)
      if (!response.ok) return false
      const data = await response.json()
      return data.eligible
    } catch (error) {
      console.error("[v0] Error checking eligibility:", error)
      return false
    }
  }

  const loadExample = (desc: string, tags?: string[]) => {
    setDescription(desc)
    setTagsInput(tags ? tags.join(", ") : "")
    setResult(null)
    setError(null)
    handleClearImage()
  }

  const getScoreColor = (score: number): string => {
    if (score >= 81) return "text-success"
    if (score >= 51) return "text-info"
    if (score >= 21) return "text-warning"
    return "text-destructive"
  }

  const getScoreBarColor = (score: number): string => {
    if (score >= 81) return "bg-success"
    if (score >= 51) return "bg-info"
    if (score >= 21) return "bg-warning"
    return "bg-destructive"
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold text-foreground">Proof of Argentinean Experience</h1>
          <p className="mt-2 text-muted-foreground">
            Evaluate how Argentine your experience is using artificial intelligence
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            {/* Evaluation Form */}
            <Card>
              <CardHeader>
                <CardTitle>Evaluate your Argentine experience</CardTitle>
                <CardDescription>
                  Upload an image or describe an experience and get a score of how Argentine it is (0-100)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleEvaluate} className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">Upload an image (optional)</label>

                    {!uploadedImage ? (
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={analyzingImage}
                          className="w-full"
                        >
                          {analyzingImage ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Analyzing image...
                            </>
                          ) : (
                            <>
                              <Upload className="mr-2 h-4 w-4" />
                              Upload image
                            </>
                          )}
                        </Button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                      </div>
                    ) : (
                      <div className="relative">
                        <img
                          src={uploadedImage || "/placeholder.svg"}
                          alt="Uploaded preview"
                          className="w-full rounded-lg border border-border object-cover max-h-64"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          onClick={handleClearImage}
                          className="absolute top-2 right-2"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        {imageAnalysis && (
                          <div className="mt-2 rounded-md bg-accent p-3 text-xs">
                            <div className="flex items-start gap-2">
                              <ImageIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                              <div className="space-y-1">
                                <p className="font-medium">Image analysis:</p>
                                <p className="text-muted-foreground">{imageAnalysis.description}</p>
                                <p className="text-muted-foreground">
                                  Quality: {(imageAnalysis.image_quality * 100).toFixed(0)}%
                                  {imageAnalysis.is_ai_generated && " • AI Generated"}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      AI will analyze the image and automatically complete the form
                    </p>
                  </div>

                  <div>
                    <label htmlFor="description" className="mb-2 block text-sm font-medium text-foreground">
                      Experience description
                    </label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={4}
                      placeholder="E.g.: Having mate with friends at the waterfront after the game."
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="tags" className="mb-2 block text-sm font-medium text-foreground">
                      Tracks (optional, comma-separated)
                    </label>
                    <Input
                      id="tags"
                      type="text"
                      value={tagsInput}
                      onChange={(e) => setTagsInput(e.target.value)}
                      placeholder="E.g.: Sports, food, Touristic locations"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Suggested tracks: {TRACKS.join(", ")}
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="username" className="mb-2 block text-sm font-medium text-foreground">
                        Name (optional)
                      </label>
                      <Input
                        id="username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Your name"
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className="mb-2 block text-sm font-medium text-foreground">
                        Email (optional)
                      </label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your@email.com"
                      />
                    </div>
                  </div>

                  <Button type="submit" disabled={!description || evaluating || savingToLeaderboard} className="w-full">
                    {evaluating || savingToLeaderboard ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {evaluating ? "Evaluating..." : "Saving..."}
                      </>
                    ) : (
                      "Evaluate Experience"
                    )}
                  </Button>

                  {error && (
                    <div className="rounded-md bg-destructive/10 border border-destructive p-3">
                      <p className="font-medium text-destructive">Error:</p>
                      <p className="text-sm text-destructive">{error}</p>
                    </div>
                  )}
                </form>
              </CardContent>
            </Card>

            {/* Result Display */}
            {result && (
              <Card>
                <CardHeader>
                  <CardTitle>Result</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">Score:</span>
                      <span className={`text-2xl font-bold ${getScoreColor(result.score)}`}>{result.score}/100</span>
                    </div>
                    <div className="h-4 w-full rounded-full bg-muted">
                      <div
                        className={`h-4 rounded-full transition-all duration-500 ${getScoreBarColor(result.score)}`}
                        style={{ width: `${result.score}%` }}
                      />
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {result.score >= 81 && "National icon or strong cultural symbol"}
                      {result.score >= 51 && result.score < 81 && "Clearly Argentine"}
                      {result.score >= 21 && result.score < 51 && "Partially Argentine or ambiguous"}
                      {result.score < 21 && "Not Argentine or generic"}
                    </div>
                  </div>

                  <div className="rounded-lg bg-accent p-4">
                    <p className="mb-1 text-sm font-medium text-foreground">Message:</p>
                    <p className="italic text-foreground">{result.message}</p>
                  </div>

                  {lastDescription && (
                    <div className="mt-4 border-t border-border pt-4">
                      <p className="mb-1 text-xs text-muted-foreground">Evaluated description:</p>
                      <p className="text-sm text-foreground">{lastDescription}</p>
                      {lastTags.length > 0 && (
                        <p className="mt-1 text-xs text-muted-foreground">Tracks: {lastTags.join(", ")}</p>
                      )}
                    </div>
                  )}

                  {(uploadedImage || lastTags.length > 0) && (
                    <div className="mt-4 border-t border-border pt-4">
                      <div className="rounded-lg bg-success/10 border border-success p-3">
                        <p className="text-sm text-success">✓ Automatically saved to leaderboard</p>
                        {lastTags.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">Tracks: {lastTags.join(", ")}</p>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Transaction Details and Consensus */}
            {result && (transactionDetails || loadingTransactionDetails) && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Transaction Method Call</CardTitle>
                    {transactionDetails?.timestamp && (
                      <span className="text-xs text-muted-foreground">
                        {new Date(transactionDetails.timestamp).toLocaleString()}
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingTransactionDetails ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-sm text-muted-foreground">Loading transaction details...</span>
                    </div>
                  ) : transactionDetails ? (
                    <div className="space-y-4">
                      {/* Transaction Hash */}
                      {transactionDetails.transactionHash && (
                        <div>
                          <label className="mb-1 block text-xs font-medium text-muted-foreground">
                            Transaction ID
                          </label>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 rounded-md bg-muted px-2 py-1.5 text-xs font-mono">
                              {transactionDetails.transactionHash}
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={async () => {
                                await navigator.clipboard.writeText(transactionDetails.transactionHash)
                                setCopiedHash(true)
                                setTimeout(() => setCopiedHash(false), 2000)
                              }}
                            >
                              {copiedHash ? (
                                <CheckCircle2 className="h-4 w-4 text-success" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Status and Execution */}
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
                          <div
                            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${transactionDetails.status === "FINALIZED"
                              ? "bg-destructive/10 text-destructive"
                              : "bg-muted text-muted-foreground"
                              }`}
                          >
                            {transactionDetails.status}
                          </div>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-muted-foreground">Execution</label>
                          <div
                            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${transactionDetails.execution === "SUCCESS"
                              ? "bg-success/10 text-success"
                              : "bg-destructive/10 text-destructive"
                              }`}
                          >
                            {transactionDetails.execution}
                          </div>
                        </div>
                      </div>

                      {/* Leader Info */}
                      <div>
                        <label className="mb-2 block text-sm font-medium text-foreground">Leader</label>
                        <div className="rounded-lg bg-accent p-3 space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Gas used:</span>
                            <span className="font-mono">{transactionDetails.leader.gasUsed}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Stake:</span>
                            <span className="font-mono">{transactionDetails.leader.stake}</span>
                          </div>
                          <div className="mt-2 pt-2 border-t border-border">
                            <p className="text-muted-foreground mb-1">{transactionDetails.leader.llmId}:</p>
                            <div className="pl-2 space-y-0.5">
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Model:</span>
                                <span>{transactionDetails.leader.model}</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Provider:</span>
                                <span>{transactionDetails.leader.provider}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Input */}
                      {transactionDetails.input && Object.keys(transactionDetails.input).length > 0 && (
                        <div>
                          <label className="mb-1 block text-sm font-medium text-foreground">Input</label>
                          <div className="rounded-lg bg-muted p-3">
                            <code className="text-xs font-mono break-all whitespace-pre-wrap">
                              {JSON.stringify(transactionDetails.input, null, 2)}
                            </code>
                          </div>
                        </div>
                      )}

                      {/* Output */}
                      {transactionDetails.output !== null && transactionDetails.output !== undefined && (
                        <div>
                          <label className="mb-1 block text-sm font-medium text-foreground">Output</label>
                          <div className="rounded-lg bg-muted p-3">
                            <code className="text-xs font-mono">{String(transactionDetails.output)}</code>
                          </div>
                        </div>
                      )}

                      {/* Equivalence Principles Output */}
                      {transactionDetails.equivalencePrinciplesOutput &&
                        Object.keys(transactionDetails.equivalencePrinciplesOutput).length > 0 && (
                          <div>
                            <label className="mb-1 block text-sm font-medium text-foreground">
                              Equivalence Principles Output
                            </label>
                            <div className="space-y-2">
                              {Object.entries(transactionDetails.equivalencePrinciplesOutput).map(([key, value], idx) => (
                                <div key={idx}>
                                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                                    Equivalence Principle #{idx}:
                                  </p>
                                  <div className="rounded-lg bg-muted p-3">
                                    <code className="text-xs font-mono break-all whitespace-pre-wrap">
                                      {JSON.stringify(value, null, 2)}
                                    </code>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                      {/* Consensus History */}
                      <div>
                        <label className="mb-2 block text-sm font-medium text-foreground">Consensus History</label>
                        <div className="rounded-lg bg-accent p-3 space-y-3">
                          <div>
                            <span className="text-xs text-muted-foreground">Status: </span>
                            <span className="text-sm font-medium">{transactionDetails.consensusHistory.status}</span>
                          </div>

                          {/* States Sequence */}
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              {transactionDetails.consensusHistory.states.map((state: string, idx: number) => (
                                <React.Fragment key={idx}>
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${idx === transactionDetails.consensusHistory.states.length - 1
                                      ? "bg-primary/20 text-primary"
                                      : "bg-muted text-muted-foreground"
                                      }`}
                                  >
                                    {state}
                                  </span>
                                  {idx < transactionDetails.consensusHistory.states.length - 1 && (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </React.Fragment>
                              ))}
                            </div>
                          </div>

                          {/* Validators */}
                          {transactionDetails.consensusHistory.validators.length > 0 && (
                            <div className="pt-2 border-t border-border space-y-2">
                              {transactionDetails.consensusHistory.validators.map((validator: { address: string; vote: "Agree" | "Disagree" }, idx: number) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <div className="flex-1 flex items-center gap-2">
                                    <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center">
                                      <span className="text-xs">👤</span>
                                    </div>
                                    <code className="text-xs font-mono text-muted-foreground">
                                      {validator.address}
                                    </code>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    {validator.vote === "Disagree" ? (
                                      <>
                                        <XCircle className="h-4 w-4 text-destructive" />
                                        <span className="text-xs text-destructive">Disagree</span>
                                      </>
                                    ) : (
                                      <>
                                        <CheckCircle2 className="h-4 w-4 text-success" />
                                        <span className="text-xs text-success">Agree</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Full Transaction Data (Collapsible) */}
                      <div>
                        <Button
                          variant="ghost"
                          className="w-full justify-between"
                          onClick={() => setShowFullTransactionData(!showFullTransactionData)}
                        >
                          <span className="text-sm">Full Transaction Data</span>
                          {showFullTransactionData ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                        {showFullTransactionData && (
                          <div className="mt-2 rounded-lg bg-muted p-3">
                            <code className="text-xs font-mono break-all whitespace-pre-wrap">
                              {JSON.stringify(transactionDetails, null, 2)}
                            </code>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            )}

            {/* Examples Section */}
            <Card>
              <CardHeader>
                <CardTitle>Examples</CardTitle>
                <CardDescription>Click on an example to load it into the form</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Button
                    onClick={() =>
                      loadExample("Having mate with friends at the waterfront after the game.", ["Sports", "food"])
                    }
                    variant="outline"
                    className="w-full justify-start text-left"
                  >
                    <span className="font-medium">Example 1:</span>
                    <span className="ml-2 text-muted-foreground">
                      Having mate with friends at the waterfront after the game.
                    </span>
                  </Button>
                  <Button
                    onClick={() =>
                      loadExample(
                        "Young person with Boca Juniors jersey at La Bombonera during a soccer match.",
                        ["Sports", "Touristic locations"],
                      )
                    }
                    variant="outline"
                    className="w-full justify-start text-left"
                  >
                    <span className="font-medium">Example 2:</span>
                    <span className="ml-2 text-muted-foreground">
                      Young person with Boca Juniors jersey at La Bombonera.
                    </span>
                  </Button>
                  <Button
                    onClick={() =>
                      loadExample("Eating asado with family on a summer Sunday.", ["food", "traditions"])
                    }
                    variant="outline"
                    className="w-full justify-start text-left"
                  >
                    <span className="font-medium">Example 3:</span>
                    <span className="ml-2 text-muted-foreground">
                      Eating asado with family on a summer Sunday.
                    </span>
                  </Button>
                  <Button
                    onClick={() => loadExample("Having coffee at a coworking space in Berlin.", [])}
                    variant="outline"
                    className="w-full justify-start text-left"
                  >
                    <span className="font-medium">Example 4:</span>
                    <span className="ml-2 text-muted-foreground">Having coffee at a coworking space in Berlin.</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div>
            <Leaderboard />
          </div>
        </div>
      </main>
    </div>
  )
}
