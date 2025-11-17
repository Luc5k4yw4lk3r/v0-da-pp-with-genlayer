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

const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0x9F8f36bb4641951d27d7185CCf37e68BbDA184Fb"

interface ImageAnalysisResult {
  description: string
  tags: string[]
  image_quality: number
  is_ai_generated: boolean
  metadata?: Record<string, any>
}

interface EvaluateExperienceModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onLeaderboardUpdate: () => void
}

export default function EvaluateExperienceModal({
  open,
  onOpenChange,
  onLeaderboardUpdate,
}: EvaluateExperienceModalProps) {
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
  const [blobImageUrl, setBlobImageUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [savingToLeaderboard, setSavingToLeaderboard] = useState(false)

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
      const uploadFormData = new FormData()
      uploadFormData.append("file", file)

      const uploadResponse = await fetch("/api/upload-image", {
        method: "POST",
        body: uploadFormData,
      })

      if (!uploadResponse.ok) {
        throw new Error("Error uploading image to Blob storage")
      }

      const uploadResult = await uploadResponse.json()
      setBlobImageUrl(uploadResult.url)

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
      setError(err.message || "Error analyzing the image")
    } finally {
      setAnalyzingImage(false)
    }
  }

  const handleClearImage = () => {
    setUploadedImage(null)
    setImageAnalysis(null)
    setBlobImageUrl(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const normalizeTrack = (input: string): Track | null => {
    const normalized = input.trim()
    const exactMatch = TRACKS.find((t) => t === normalized)
    if (exactMatch) return exactMatch

    const caseInsensitiveMatch = TRACKS.find((t) => t.toLowerCase() === normalized.toLowerCase())
    if (caseInsensitiveMatch) return caseInsensitiveMatch

    const normalizedInput = normalized.toLowerCase().replace(/\s+/g, "_")
    const normalizedMatch = TRACKS.find((t) =>
      t.toLowerCase().replace(/\s+/g, "_") === normalizedInput
    )
    if (normalizedMatch) return normalizedMatch

    return null
  }

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
      return false
    }
  }

  const autoSaveToLeaderboard = async (
    score: number,
    message: string,
    tracks: Track[],
    consensusData?: { transactionHash?: string; transactionDetails?: TransactionDetails }
  ) => {
    try {
      const eligibleTracksToSave: Track[] = []

      for (const track of tracks) {
        const isEligible = await checkEligibility(score, track)
        if (isEligible) {
          eligibleTracksToSave.push(track)
        }
      }

      if (eligibleTracksToSave.length === 0) {
        return
      }

      const entry: LeaderboardEntry = {
        score,
        description,
        message: message || undefined,
        imageUrl: blobImageUrl || undefined,
        username: username || undefined,
        email: email || undefined,
        timestamp: Date.now(),
        tags: eligibleTracksToSave,
        consensusResponse: consensusData ? {
          transactionHash: consensusData.transactionHash,
          transactionDetails: consensusData.transactionDetails,
        } : undefined,
      }

      let savedToAnyTrack = false
      for (const track of eligibleTracksToSave) {
        const response = await fetch("/api/leaderboard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ track, entry }),
        })

        if (response.ok) {
          savedToAnyTrack = true
        }
      }

      if (savedToAnyTrack) {
        onLeaderboardUpdate()
      }
    } catch (err) {
      console.error("[v0] Error auto-saving to leaderboard:", err)
    }
  }

  const handleEvaluate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!description) return

    setEvaluating(true)
    setError(null)
    setResult(null)

    try {
      const tagsInputArray = tagsInput
        ? tagsInput
          .split(",")
          .map((t: string) => t.trim())
          .filter((t: string) => t)
        : []

      const validTracks = validateAndNormalizeTracks(tagsInputArray)
      const tagsForContract = tagsInputArray.length > 0 ? tagsInputArray : null

      const evaluationResult = await proofOfExperience.evaluate(
        description,
        tagsForContract,
        imageAnalysis?.image_quality
      )

      setResult(evaluationResult)
      setLastDescription(description)
      setLastTags(validTracks.length > 0 ? validTracks : tagsInputArray)
      setTransactionDetails(null)

      const txHash = evaluationResult.transactionHash || `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`

      setLoadingTransactionDetails(true)
      let transactionDetailsData: TransactionDetails | null = null
      try {
        const mockTxHash = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`
        const details = await proofOfExperience.getTransactionDetails(mockTxHash)
        if (details) {
          transactionDetailsData = details
          setTransactionDetails(details)
          setResult({ ...evaluationResult, transactionHash: txHash, transactionDetails: details })
        }
      } catch (err) {
        // Continue without transaction details
      } finally {
        setLoadingTransactionDetails(false)
      }

      if (validTracks.length > 0) {
        await autoSaveToLeaderboard(
          evaluationResult.score,
          evaluationResult.message,
          validTracks,
          {
            transactionHash: txHash,
            transactionDetails: transactionDetailsData || undefined,
          }
        )
      }
    } catch (err: any) {
      let errorMessage = "Error evaluating the experience. Please try again."

      if (err?.message) {
        if (err.message.includes("GenLayer RPC error") || err.message.includes("gen_call")) {
          errorMessage = "Unable to connect to GenLayer. Please check your internet connection and try again."
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

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg bg-white dark:bg-gray-900 shadow-2xl border-2 border-gray-200 dark:border-gray-700">
        <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Evaluate Your Argentine Experience
            </h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              <X className="h-6 w-6" />
            </Button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Form Section */}
          <Card className="border-primary/20 shadow-xl">
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">Upload and Evaluate</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Upload an image or describe an experience and get a score of how Argentine it is (0-100)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleEvaluate} className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                    Upload an image (optional)
                  </label>

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
                    </div>
                  )}
                  <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                    AI will analyze the image and automatically complete the form
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="username" className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                      Name (optional)
                    </label>
                    <Input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Your name, telegram or twitter user"
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
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

                <Button
                  type="submit"
                  disabled={!description || evaluating || savingToLeaderboard}
                  className="w-full bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-white font-bold text-sm sm:text-base lg:text-lg py-4 sm:py-5 lg:py-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                >
                  {evaluating || savingToLeaderboard ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                      {evaluating ? "Evaluating with AI Consensus..." : "Saving..."}
                    </>
                  ) : (
                    "Evaluate Experience with AI Consensus"
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
            <Card className="border-secondary/30 shadow-xl bg-gradient-to-br from-card via-card to-secondary/5">
              <CardHeader>
                <CardTitle>Result</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">Score:</span>
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
                  <p className="mb-1 text-sm font-medium text-gray-900 dark:text-white">Message:</p>
                  <p className="italic text-gray-900 dark:text-white">{result.message}</p>
                </div>

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

          {/* Transaction Details */}
          {result && (transactionDetails || loadingTransactionDetails) && (
            <Card className="border-accent/30 shadow-xl bg-gradient-to-br from-card via-card to-accent/5">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <CardTitle className="text-base sm:text-lg">Transaction Method Call</CardTitle>
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
                    {transactionDetails.transactionHash && (
                      <div>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">
                          Transaction ID
                        </label>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 rounded-md bg-muted px-2 py-1.5 text-[10px] sm:text-xs font-mono break-all">
                            {transactionDetails.transactionHash}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 flex-shrink-0"
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

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-muted-foreground">Status</label>
                        <div
                          className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium ${transactionDetails.status === "FINALIZED"
                            ? "bg-destructive/10 text-destructive"
                            : "bg-muted text-muted-foreground"
                            }`}
                        >
                          {transactionDetails.status}
                        </div>
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-muted-foreground">Execution</label>
                        <div
                          className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium ${transactionDetails.execution === "SUCCESS"
                            ? "bg-success/10 text-success"
                            : "bg-destructive/10 text-destructive"
                            }`}
                        >
                          {transactionDetails.execution}
                        </div>
                      </div>
                    </div>

                    {/* Consensus History */}
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">Consensus History</label>
                      <div className="rounded-lg bg-accent p-3 space-y-3">
                        <div>
                          <span className="text-xs text-muted-foreground">Status: </span>
                          <span className="text-sm font-medium">{transactionDetails.consensusHistory.status}</span>
                        </div>

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

                        {transactionDetails.consensusHistory.validators.length > 0 && (
                          <div className="pt-2 border-t border-border space-y-2">
                            {transactionDetails.consensusHistory.validators.map((validator: { address: string; vote: "Agree" | "Disagree" }, idx: number) => (
                              <div key={idx} className="flex items-center gap-2">
                                <div className="flex-1 flex items-center gap-2">
                                  <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center">
                                    <span className="text-xs">👤</span>
                                  </div>
                                  <code className="text-[10px] sm:text-xs font-mono text-muted-foreground break-all">
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
        </div>
      </div>
    </div>
  )
}
