"use client"

import type React from "react"
import { useState, useRef } from "react"
import { useProofOfArgentineanExperience } from "@/hooks/use-proof-of-argentinean-experience"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Loader2, Upload, X, ImageIcon, Copy, Check } from 'lucide-react'
import type { LeaderboardEntry } from "@/lib/redis"
import Leaderboard from "./leaderboard"
import { useTranslations } from "@/lib/i18n"
import Image from "next/image"

interface EvaluationResult {
  score: number
  message: string
}

interface ImageAnalysisResult {
  description: string
  tags: string[]
  image_quality: number
  is_ai_generated: boolean
  metadata?: Record<string, any>
}

interface ConsensusProgress {
  step?: number
  totalSteps?: number
  message: string
  progress: number
  completed?: boolean
  status?: string
  error?: boolean
  consensusData?: ConsensusData
  txHash?: string
}

interface ValidatorVote {
  address: string
  vote: any
  llmProvider?: string
  executionResult?: string
  error?: string
}

interface ConsensusData {
  leader?: string
  validators?: ValidatorVote[]
  finalResult?: any
  executionMode?: string
  votesReceived?: number
  totalValidators?: number
  fullTxData?: any
  eqOutputs?: any
}

export default function ArgentineanExperienceScreen() {
  const [description, setDescription] = useState("")
  const [tagsInput, setTagsInput] = useState("")
  const [result, setResult] = useState<EvaluationResult | null>(null)
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

  const [componentError, setComponentError] = useState<string | null>(null)

  const [showConsensusPanel, setShowConsensusPanel] = useState(false)
  const [completedConsensus, setCompletedConsensus] = useState<ConsensusProgress | null>(null)

  const [copiedTxHash, setCopiedTxHash] = useState(false)
  const [fullTxData, setFullTxData] = useState<any>(null)
  const [transactionInput, setTransactionInput] = useState<{ description: string, tags: string[] | null } | null>(null)
  const [transactionOutput, setTransactionOutput] = useState<number | null>(null)

  const [refreshLeaderboard, setRefreshLeaderboard] = useState<(() => void) | null>(null)

  const { evaluateWithTracking, loading: evaluating, error: hookError, consensusProgress } = useProofOfArgentineanExperience()

  const t = useTranslations()

  const error = hookError || componentError

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      setComponentError(t.imageError)
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setComponentError(t.imageSizeError)
      return
    }

    setAnalyzingImage(true)
    setComponentError(null)
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
        throw new Error("Error al analizar la imagen")
      }

      const analysis: ImageAnalysisResult = await response.json()
      setImageAnalysis(analysis)

      setDescription(analysis.description)
      setTagsInput(analysis.tags.join(", "))
    } catch (err: any) {
      console.error("[v0] Error uploading image:", err)
      setComponentError(err.message || "Error al analizar la imagen")
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

    setResult(null)
    setIsEligibleForLeaderboard(false)
    setEligibleTracks([])
    setComponentError(null)
    setShowConsensusPanel(true)
    setCompletedConsensus(null)
    setFullTxData(null)

    try {
      const tags = tagsInput
        ? tagsInput
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t)
        : null

      // Store input for display
      setTransactionInput({ description, tags })
      setTransactionOutput(null)

      console.log("[v0] Starting evaluation with consensus tracking, tags:", tags)

      const evaluationResult = await evaluateWithTracking(description, tags)

      console.log("[v0] Evaluation result:", evaluationResult)
      console.log("[v0] Evaluation result score:", evaluationResult?.score)
      console.log("[v0] Evaluation result message:", evaluationResult?.message)

      // Store output for display
      setTransactionOutput(evaluationResult?.score || null)

      // Ensure we have a valid result with score and message
      if (evaluationResult && (evaluationResult.score !== undefined || evaluationResult.message !== undefined)) {
        setResult({
          score: evaluationResult.score || 0,
          message: evaluationResult.message || "",
        })
      } else {
        console.warn("[v0] Invalid evaluation result:", evaluationResult)
        setResult(null)
      }
      setLastDescription(description)
      setLastTags(tags || [])

      if (consensusProgress?.completed && consensusProgress?.consensusData?.fullTxData) {
        setFullTxData(consensusProgress.consensusData.fullTxData)
      }

      if (consensusProgress?.completed) {
        setCompletedConsensus(consensusProgress)
      }

      if (tags && tags.length > 0) {
        console.log("[v0] Auto-saving to Redis...")
        await autoSaveToLeaderboard(evaluationResult.score, tags)
      } else {
        console.log("[v0] Not auto-saving: no tags provided")
      }
    } catch (err: any) {
      console.error("[v0] Error evaluating experience:", err)
    }
  }

  const autoSaveToLeaderboard = async (score: number, tags: string[]) => {
    try {
      const eligibleTracksToSave: string[] = []

      for (const tag of tags) {
        const isEligible = await checkEligibility(score, tag)
        if (isEligible) {
          eligibleTracksToSave.push(tag)
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

      for (const tag of eligibleTracksToSave) {
        console.log("[v0] Saving to track:", tag)

        const response = await fetch("/api/leaderboard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ track: tag, entry }),
        })

        console.log("[v0] Response status for", tag, ":", response.status)

        if (!response.ok) {
          const errorText = await response.text()
          console.error("[v0] Failed to save to track:", tag, errorText)
        } else {
          const result = await response.json()
          console.log("[v0] Successfully saved to track:", tag, result)
        }
      }

      console.log("[v0] Auto-save completed successfully")

      if (refreshLeaderboard && typeof refreshLeaderboard === 'function') {
        console.log("[v0] Refreshing leaderboard...")
        refreshLeaderboard()
      }
    } catch (err) {
      console.error("[v0] Error auto-saving to leaderboard:", err)
    }
  }

  const checkEligibility = async (score: number, track: string): Promise<boolean> => {
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
    setComponentError(null)
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

  const getScoreLabel = (score: number): string => {
    if (score >= 81) return t.scoreRanges.high
    if (score >= 51) return t.scoreRanges.mediumHigh
    if (score >= 21) return t.scoreRanges.mediumLow
    return t.scoreRanges.low
  }

  const handleCopyTxHash = async (hash: string) => {
    try {
      await navigator.clipboard.writeText(hash)
      setCopiedTxHash(true)
      setTimeout(() => setCopiedTxHash(false), 2000)
    } catch (err) {
      console.error('[v0] Failed to copy:', err)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Image src="/logo.png" alt="Proof of Che Logo" width={120} height={60} className="h-16 w-auto" priority />
            <div>
              <h1 className="text-4xl font-bold text-foreground">{t.title}</h1>
              <p className="mt-1 text-muted-foreground">{t.subtitle}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t.formTitle}</CardTitle>
                <CardDescription>{t.formDescription}</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleEvaluate} className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">{t.uploadImageLabel}</label>

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
                              {t.analyzingImage}
                            </>
                          ) : (
                            <>
                              <Upload className="mr-2 h-4 w-4" />
                              {t.uploadButton}
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
                                <p className="font-medium">{t.imageAnalysisLabel}</p>
                                <p className="text-muted-foreground">{imageAnalysis.description}</p>
                                <p className="text-muted-foreground">
                                  {t.imageQuality}: {(imageAnalysis.image_quality * 100).toFixed(0)}%
                                  {imageAnalysis.is_ai_generated && ` • ${t.aiGenerated}`}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">{t.imageHelp}</p>
                  </div>

                  <div>
                    <label htmlFor="description" className="mb-2 block text-sm font-medium text-foreground">
                      {t.descriptionLabel}
                    </label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={4}
                      placeholder={t.descriptionPlaceholder}
                      required
                      readOnly={true}
                    />
                  </div>

                  <div>
                    <label htmlFor="tags" className="mb-2 block text-sm font-medium text-foreground">
                      {t.tagsLabel}
                    </label>
                    <Input
                      id="tags"
                      type="text"
                      value={tagsInput}
                      onChange={(e) => setTagsInput(e.target.value)}
                      placeholder={t.tagsPlaceholder}
                      readOnly={true}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">{t.tagsHelp}</p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="username" className="mb-2 block text-sm font-medium text-foreground">
                        {t.usernameLabel}
                      </label>
                      <Input
                        id="username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder={t.usernamePlaceholder}
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className="mb-2 block text-sm font-medium text-foreground">
                        {t.emailLabel}
                      </label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={t.emailPlaceholder}
                      />
                    </div>
                  </div>

                  <Button type="submit" disabled={!description || evaluating || savingToLeaderboard} className="w-full">
                    {evaluating || savingToLeaderboard ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {evaluating ? t.evaluating : t.saving}
                      </>
                    ) : (
                      t.evaluateButton
                    )}
                  </Button>

                  {error && (
                    <div className="rounded-md bg-destructive/10 border border-destructive p-3">
                      <p className="font-medium text-destructive">{t.errorLabel}</p>
                      <p className="text-sm text-destructive">{error}</p>
                    </div>
                  )}
                </form>
              </CardContent>
            </Card>

            {showConsensusPanel && (
              <Card className={`border-2 ${consensusProgress?.error ? "border-destructive" : "border-info"}`}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center">
                      {!(completedConsensus?.completed || consensusProgress?.completed) ? (
                        <Loader2 className="mr-2 h-5 w-5 animate-spin text-info" />
                      ) : (
                        <span className="mr-2 text-2xl">✓</span>
                      )}
                      <span>Transaction Method Call</span>
                    </div>
                    <span className="text-sm font-normal text-muted-foreground">
                      {new Date().toLocaleString()}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const currentProgress = completedConsensus || consensusProgress
                    return (
                      <div className="space-y-4">
                        {currentProgress?.txHash && (
                          <div className="rounded-lg border border-border bg-muted/30 p-4">
                            <div className="flex items-center justify-between gap-2 mb-3">
                              <p className="font-mono text-xs text-foreground break-all flex-1">
                                {currentProgress.txHash}
                              </p>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 flex-shrink-0"
                                onClick={() => handleCopyTxHash(currentProgress.txHash!)}
                              >
                                {copiedTxHash ? (
                                  <Check className="h-4 w-4 text-success" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </Button>
                            </div>

                            <div className="flex gap-2 mb-4">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-muted-foreground">Status:</span>
                                <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${currentProgress.status === 'FINALIZED'
                                  ? 'bg-destructive/10 text-destructive border border-destructive'
                                  : currentProgress.status === 'ACCEPTED'
                                    ? 'bg-success/10 text-success border border-success'
                                    : 'bg-info/10 text-info border border-info'
                                  }`}>
                                  {currentProgress.status || 'PENDING'}
                                </span>
                              </div>
                              {currentProgress.completed && (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-muted-foreground">Execution:</span>
                                  <span className="inline-flex items-center rounded-md bg-success/10 text-success border border-success px-2 py-1 text-xs font-medium">
                                    SUCCESS
                                  </span>
                                </div>
                              )}
                              {!currentProgress.completed && currentProgress.status && (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-muted-foreground">Execution:</span>
                                  <span className="inline-flex items-center rounded-md bg-muted/10 text-muted-foreground border border-border px-2 py-1 text-xs font-medium">
                                    PENDING
                                  </span>
                                </div>
                              )}
                            </div>

                            {currentProgress.consensusData?.leader && (
                              <div className="space-y-3">
                                <div className="flex items-center gap-2 border-b border-border pb-2">
                                  <span className="text-sm font-semibold text-foreground">Leader:</span>
                                </div>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                  <div>
                                    <span className="text-muted-foreground">Gas used:</span>
                                    <span className="ml-2 font-medium text-foreground">0</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Stake:</span>
                                    <span className="ml-2 font-medium text-foreground">100</span>
                                  </div>
                                  <div className="col-span-2">
                                    <span className="text-muted-foreground">LLM-0:</span>
                                  </div>
                                  <div className="col-span-2">
                                    <span className="text-muted-foreground">Model:</span>
                                    <span className="ml-2 font-medium text-foreground">gpt-4.1-nano</span>
                                  </div>
                                  <div className="col-span-2">
                                    <span className="text-muted-foreground">Provider:</span>
                                    <span className="ml-2 font-medium text-foreground">openai</span>
                                  </div>
                                </div>
                                <div className="rounded-lg bg-info/5 p-3 mt-2">
                                  <p className="font-mono text-xs text-foreground break-all">
                                    {currentProgress.consensusData.leader}
                                  </p>
                                </div>
                              </div>
                            )}

                            {transactionInput && (
                              <div className="space-y-2 border-t border-border pt-4">
                                <p className="text-sm font-semibold text-foreground">Input:</p>
                                <div className="rounded-lg border border-border bg-muted/30 p-3">
                                  <pre className="font-mono text-xs text-foreground overflow-auto">
                                    {JSON.stringify({ args: [transactionInput.description] }, null, 2)}
                                  </pre>
                                </div>
                              </div>
                            )}

                            {transactionOutput !== null && (
                              <div className="space-y-2 border-t border-border pt-4">
                                <p className="text-sm font-semibold text-foreground">Output:</p>
                                <div className="rounded-lg border border-border bg-muted/30 p-3">
                                  <p className="font-mono text-sm text-foreground">{transactionOutput}</p>
                                </div>
                              </div>
                            )}

                            {(result || currentProgress?.consensusData?.eqOutputs) && (
                              <div className="space-y-2 border-t border-border pt-4">
                                <p className="text-sm font-semibold text-foreground">Equivalence Principles Output:</p>
                                <div className="space-y-2">
                                  {currentProgress?.consensusData?.eqOutputs ? (
                                    // Show all equivalence principles from eq_outputs
                                    (() => {
                                      const eqOutputs = currentProgress.consensusData.eqOutputs
                                      const principles: Array<{ index: string, value: any }> = []

                                      // Extract principles from eq_outputs structure
                                      if (typeof eqOutputs === 'object' && !Array.isArray(eqOutputs)) {
                                        if (eqOutputs.leader && typeof eqOutputs.leader === 'object') {
                                          // Structure: { "leader": { "0": "JSON string", "1": "JSON string", ... } }
                                          Object.entries(eqOutputs.leader).forEach(([key, value]) => {
                                            let parsedValue = value
                                            if (typeof value === 'string') {
                                              try {
                                                parsedValue = JSON.parse(value)
                                              } catch (e) {
                                                // Keep as string if not valid JSON
                                              }
                                            }
                                            principles.push({ index: key, value: parsedValue })
                                          })
                                        } else {
                                          // Direct structure: { "0": "JSON string", "1": "JSON string", ... }
                                          Object.entries(eqOutputs).forEach(([key, value]) => {
                                            let parsedValue = value
                                            if (typeof value === 'string') {
                                              try {
                                                parsedValue = JSON.parse(value)
                                              } catch (e) {
                                                // Keep as string if not valid JSON
                                              }
                                            }
                                            principles.push({ index: key, value: parsedValue })
                                          })
                                        }
                                      }

                                      // If no principles found in eq_outputs, show result as principle #0
                                      if (principles.length === 0 && result) {
                                        principles.push({ index: "0", value: { message: result.message, score: result.score } })
                                      }

                                      return principles.map((principle, idx) => (
                                        <div key={idx} className="rounded-lg border border-border bg-muted/30 p-3">
                                          <p className="text-xs font-medium text-muted-foreground mb-1">
                                            Equivalence Principle #{principle.index}:
                                          </p>
                                          <pre className="font-mono text-xs text-foreground overflow-auto">
                                            {JSON.stringify(principle.value, null, 2)}
                                          </pre>
                                        </div>
                                      ))
                                    })()
                                  ) : result ? (
                                    // Fallback: show result as principle #0
                                    <div className="rounded-lg border border-border bg-muted/30 p-3">
                                      <p className="text-xs font-medium text-muted-foreground mb-1">Equivalence Principle #0:</p>
                                      <pre className="font-mono text-xs text-foreground overflow-auto">
                                        {JSON.stringify({ message: result.message, score: result.score }, null, 2)}
                                      </pre>
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        <div>
                          <div className="mb-2 flex items-center justify-between">
                            <span className={`text-sm font-medium ${currentProgress?.error ? "text-destructive" : "text-foreground"}`}>
                              {currentProgress?.message}
                            </span>
                            <span
                              className={`text-sm font-medium ${currentProgress?.error ? "text-destructive" : currentProgress?.completed ? "text-success" : "text-info"}`}
                            >
                              {currentProgress?.progress}%
                            </span>
                          </div>
                          <div className="h-3 w-full rounded-full bg-muted">
                            <div
                              className={`h-3 rounded-full transition-all duration-700 ease-out ${currentProgress?.error ? "bg-destructive" : currentProgress?.completed ? "bg-success" : "bg-info"
                                }`}
                              style={{ width: `${currentProgress?.progress}%` }}
                            />
                          </div>
                        </div>

                        {currentProgress?.consensusData?.validators && currentProgress.consensusData.validators.length > 0 && (
                          <div className="space-y-3 border-t border-border pt-4">
                            <p className="text-sm font-semibold text-foreground">Consensus History</p>

                            <div className="rounded-lg border border-border bg-muted/30 p-3">
                              <p className="text-xs text-muted-foreground mb-2">
                                {currentProgress.status === "UNDETERMINED" || !currentProgress.completed
                                  ? "Undetermined"
                                  : currentProgress.status || "Processing"}
                              </p>
                              <div className="flex gap-2 flex-wrap text-xs">
                                {["PENDING", "PROPOSING", "COMMITTING", "REVEALING", "UNDETERMINED"].map((status, idx) => (
                                  <span key={status} className={`${idx < ["PENDING", "PROPOSING", "COMMITTING", "REVEALING", "UNDETERMINED"].length - 1
                                    ? "after:content-['→'] after:mx-1"
                                    : ""
                                    }`}>
                                    {status}
                                  </span>
                                ))}
                              </div>
                            </div>

                            <div className="space-y-2">
                              {currentProgress.consensusData.validators.map((validator, index) => {
                                // Get leader's result (first validator is usually the leader)
                                const leaderValidator = currentProgress.consensusData?.validators?.[0]
                                const leaderVote = leaderValidator?.vote || currentProgress.consensusData?.finalResult
                                const validatorVote = validator.vote

                                // Check if validator has execution error
                                const hasError = validator.executionResult === "ERROR" || validator.error

                                // Normalize votes for comparison
                                const normalizeVote = (vote: any) => {
                                  if (!vote) return null
                                  // Handle string votes like "agree"
                                  if (typeof vote === 'string' && (vote === 'agree' || vote === 'disagree')) {
                                    return vote
                                  }
                                  // If it's an object with score and message, extract those
                                  if (typeof vote === 'object' && !Array.isArray(vote)) {
                                    const score = vote.score ?? vote.get?.('score')
                                    const message = vote.message ?? vote.get?.('message')
                                    if (score !== undefined || message !== undefined) {
                                      return { score, message }
                                    }
                                  }
                                  // If it's just a number (score), return it
                                  if (typeof vote === 'number') {
                                    return vote
                                  }
                                  return vote
                                }

                                const normalizedLeaderVote = normalizeVote(leaderVote)
                                const normalizedValidatorVote = normalizeVote(validatorVote)

                                // Compare votes - check if validator's vote matches leader's
                                let agrees = false
                                if (normalizedLeaderVote && normalizedValidatorVote) {
                                  // If both are strings (agree/disagree)
                                  if (typeof normalizedLeaderVote === 'string' && typeof normalizedValidatorVote === 'string') {
                                    agrees = normalizedLeaderVote === normalizedValidatorVote
                                  }
                                  // If both are objects with score, compare scores
                                  else if (typeof normalizedLeaderVote === 'object' && typeof normalizedValidatorVote === 'object') {
                                    const leaderScore = normalizedLeaderVote.score ?? normalizedLeaderVote
                                    const validatorScore = normalizedValidatorVote.score ?? normalizedValidatorVote
                                    agrees = leaderScore === validatorScore
                                  } else {
                                    // Direct comparison
                                    agrees = JSON.stringify(normalizedLeaderVote) === JSON.stringify(normalizedValidatorVote)
                                  }
                                }

                                // If this is the leader itself, always show as agree
                                if (validator.address === leaderValidator?.address) {
                                  agrees = true
                                }

                                // If vote is "agree", show as agree
                                if (validatorVote === "agree" || validatorVote === "AGREE") {
                                  agrees = true
                                }

                                return (
                                  <div key={index} className={`rounded-lg border p-3 ${hasError ? 'border-destructive/50 bg-destructive/5' : 'border-border bg-muted/30'}`}>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <svg className="h-4 w-4 flex-shrink-0 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                        <p className="font-mono text-xs text-foreground truncate" title={validator.address}>
                                          {validator.address}
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                        {hasError ? (
                                          <button className="flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive border border-destructive">
                                            <X className="h-3 w-3" />
                                            <span>Error</span>
                                          </button>
                                        ) : agrees ? (
                                          <button className="flex items-center gap-1 rounded-md bg-success/10 px-2 py-1 text-xs font-medium text-success border border-success">
                                            <Check className="h-3 w-3" />
                                            <span>Agree</span>
                                          </button>
                                        ) : (
                                          <button className="flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive border border-destructive">
                                            <X className="h-3 w-3" />
                                            <span>Disagree</span>
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                    {hasError && validator.error && (
                                      <div className="mt-2 rounded-md bg-destructive/10 p-2">
                                        <p className="text-xs font-mono text-destructive break-all">
                                          {validator.error.split('\n')[0]}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {currentProgress?.completed && fullTxData && (
                          <div className="space-y-2 border-t border-border pt-4">
                            <p className="text-sm font-semibold text-foreground">Full Transaction Data</p>
                            <div className="rounded-lg border border-border bg-muted/30 p-3">
                              <details>
                                <summary className="cursor-pointer text-xs font-mono text-muted-foreground hover:text-foreground">
                                  ▸ {"{"}...{"}"}
                                </summary>
                                <pre className="mt-2 overflow-auto text-xs font-mono text-foreground max-h-64">
                                  {JSON.stringify(fullTxData, null, 2)}
                                </pre>
                              </details>
                            </div>
                          </div>
                        )}

                        {currentProgress?.consensusData?.finalResult !== undefined && (
                          <div className="rounded-lg border-2 border-success bg-success/5 p-3">
                            <p className="text-xs font-semibold text-success mb-2">RESULTADO FINAL</p>
                            <pre className="font-mono text-xs text-foreground overflow-auto">
                              {JSON.stringify(currentProgress.consensusData.finalResult, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </CardContent>
              </Card>
            )}

            {result && (
              <Card>
                <CardHeader>
                  <CardTitle>{t.resultTitle}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">{t.scoreLabel}</span>
                      <span className={`text-2xl font-bold ${getScoreColor(result.score)}`}>{result.score}/100</span>
                    </div>
                    <div className="h-4 w-full rounded-full bg-muted">
                      <div
                        className={`h-4 rounded-full transition-all duration-500 ${getScoreBarColor(result.score)}`}
                        style={{ width: `${result.score}%` }}
                      />
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">{getScoreLabel(result.score)}</div>
                  </div>

                  <div className="rounded-lg bg-accent p-4">
                    <p className="mb-1 text-sm font-medium text-foreground">{t.messageLabel}</p>
                    <p className="italic text-foreground">{result.message}</p>
                  </div>

                  {lastDescription && (
                    <div className="mt-4 border-t border-border pt-4">
                      <p className="mb-1 text-xs text-muted-foreground">{t.evaluatedDescription}</p>
                      <p className="text-sm text-foreground">{lastDescription}</p>
                      {lastTags.length > 0 && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t.tagsLabel2} {lastTags.join(", ")}
                        </p>
                      )}
                    </div>
                  )}

                  {(uploadedImage || lastTags.length > 0) && (
                    <div className="mt-4 border-t border-border pt-4">
                      <div className="rounded-lg bg-success/10 border border-success p-3">
                        <p className="text-sm text-success">✓ {t.autoSaved}</p>
                        {lastTags.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {t.tracksLabel} {lastTags.join(", ")}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="examples" className="border-none">
                <Card>
                  <AccordionTrigger className="px-6 hover:no-underline [&[data-state=open]]:border-b">
                    <div className="text-left">
                      <h3 className="text-lg font-semibold">{t.examplesTitle}</h3>
                      <p className="text-sm text-muted-foreground">{t.examplesDescription}</p>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-6">
                    <div className="space-y-2">
                      <Button
                        onClick={() =>
                          loadExample("Tomando mate con amigos en la costanera después del partido.", [
                            "sports",
                            "food",
                          ])
                        }
                        variant="outline"
                        className="w-full justify-start text-left"
                      >
                        <span className="font-medium">{t.exampleLabel} 1:</span>
                        <span className="ml-2 text-muted-foreground">{t.example1}</span>
                      </Button>
                      <Button
                        onClick={() =>
                          loadExample(
                            "Joven con camiseta de Boca Juniors en una tribuna de La Bombonera durante un partido de fútbol.",
                            ["sports", "touristic"],
                          )
                        }
                        variant="outline"
                        className="w-full justify-start text-left"
                      >
                        <span className="font-medium">{t.exampleLabel} 2:</span>
                        <span className="ml-2 text-muted-foreground">{t.example2}</span>
                      </Button>
                      <Button
                        onClick={() => loadExample("Comiendo asado con familia en un domingo de verano.", ["food", "customs"])}
                        variant="outline"
                        className="w-full justify-start text-left"
                      >
                        <span className="font-medium">{t.exampleLabel} 3:</span>
                        <span className="ml-2 text-muted-foreground">{t.example3}</span>
                      </Button>
                      <Button
                        onClick={() => loadExample("Tomando café en un coworking de Berlín.", ["work"])}
                        variant="outline"
                        className="w-full justify-start text-left"
                      >
                        <span className="font-medium">{t.exampleLabel} 4:</span>
                        <span className="ml-2 text-muted-foreground">{t.example4}</span>
                      </Button>
                    </div>
                  </AccordionContent>
                </Card>
              </AccordionItem>
            </Accordion>
          </div>

          <div>
            <Leaderboard onRefreshReady={setRefreshLeaderboard} />
          </div>
        </div>
      </main>
    </div>
  )
}
