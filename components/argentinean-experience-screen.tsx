"use client"

import type React from "react"

import { useState, useRef } from "react"
import ProofOfArgentineanExperience from "@/lib/contracts/proof-of-argentinean-experience"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Loader2, Upload, X, ImageIcon } from "lucide-react"
import type { LeaderboardEntry } from "@/lib/redis"
import Leaderboard from "./leaderboard"
import { useTranslations } from "@/lib/i18n"
import Image from "next/image"

const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0xA3E6713d0E67002d3C707e64D8E41530385F6CFB"

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

  const proofOfExperience = new ProofOfArgentineanExperience(contractAddress)

  const t = useTranslations()

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      setError(t.imageError)
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setError(t.imageSizeError)
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
        throw new Error("Error al analizar la imagen")
      }

      const analysis: ImageAnalysisResult = await response.json()
      setImageAnalysis(analysis)

      setDescription(analysis.description)
      setTagsInput(analysis.tags.join(", "))
    } catch (err: any) {
      console.error("[v0] Error uploading image:", err)
      setError(err.message || "Error al analizar la imagen")
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
      const tags = tagsInput
        ? tagsInput
            .split(",")
            .map((t) => t.trim())
            .filter((t) => t)
        : null

      console.log("[v0] Starting evaluation with tags:", tags)

      const evaluationResult = await proofOfExperience.evaluate(description, tags)

      console.log("[v0] Evaluation result:", evaluationResult)

      setResult(evaluationResult)
      setLastDescription(description)
      setLastTags(tags || [])

      if (tags && tags.length > 0) {
        console.log("[v0] Auto-saving to Redis...")
        await autoSaveToLeaderboard(evaluationResult.score, tags)
      } else {
        console.log("[v0] Not auto-saving: no tags provided")
      }
    } catch (err: any) {
      console.error("[v0] Error evaluating experience:", err)
      setError(err.message || "Error al evaluar la experiencia. Por favor, intenta nuevamente.")
    } finally {
      setEvaluating(false)
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

      // Save only to eligible tracks
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

      if (refreshLeaderboard) {
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

  const getScoreLabel = (score: number): string => {
    if (score >= 81) return t.scoreRanges.high
    if (score >= 51) return t.scoreRanges.mediumHigh
    if (score >= 21) return t.scoreRanges.mediumLow
    return t.scoreRanges.low
  }

  const [refreshLeaderboard, setRefreshLeaderboard] = useState<(() => void) | null>(null)

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
            {/* Evaluation Form */}
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

            {/* Result Display */}
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

            {/* Examples Section */}
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
                        onClick={() =>
                          loadExample("Comiendo asado con familia en un domingo de verano.", ["food", "customs"])
                        }
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
