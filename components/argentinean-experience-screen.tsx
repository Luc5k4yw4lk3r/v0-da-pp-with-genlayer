"use client"

import React, { useState } from "react"
import ProofOfArgentineanExperience, {
  type EvaluationResult,
  type TransactionDetails,
} from "@/lib/contracts/proof-of-argentinean-experience"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Upload, X, ImageIcon, Copy, CheckCircle2, XCircle, ChevronRight, ChevronDown, HelpCircle, Camera } from 'lucide-react'
import type { LeaderboardEntry, Track } from "@/lib/redis"
import { TRACKS } from "@/lib/redis"
import Leaderboard from "./leaderboard"
import AboutProjectModal from "./about-project-modal"
import EvaluateExperienceModal from "./evaluate-experience-modal"

const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0x9F8f36bb4641951d27d7185CCf37e68BbDA184Fb"

interface ImageAnalysisResult {
  description: string
  tags: string[]
  image_quality: number
  is_ai_generated: boolean
  metadata?: Record<string, any>
}

export default function ArgentineanExperienceScreen() {
  const [leaderboardRefreshTrigger, setLeaderboardRefreshTrigger] = useState(0)
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false)
  const [isEvaluateModalOpen, setIsEvaluateModalOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-lg sticky top-0 z-50 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold heading-pixel">
            Proof of Steak
          </h1>
          <p className="mt-2 text-sm sm:text-base text-muted-foreground">
            <strong>A decentralized AI-powered game that scores how authentically Argentine your steak experience is — compete, rank, and win real asado rewards.</strong>
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
        <Leaderboard refreshTrigger={leaderboardRefreshTrigger} />
      </main>

      <Button
        onClick={() => setIsEvaluateModalOpen(true)}
        className="fixed right-6 bottom-24 h-20 w-20 rounded-full shadow-2xl z-40 bg-gradient-to-br from-blue-500 via-purple-600 to-pink-600 hover:from-blue-400 hover:via-purple-500 hover:to-pink-500 transition-all duration-300 hover:scale-110 hover:shadow-purple-500/50"
        size="icon"
      >
        <Camera className="h-10 w-10 text-white" />
        <span className="sr-only">Evaluate your experience</span>
      </Button>

      <Button
        onClick={() => setIsAboutModalOpen(true)}
        className="fixed right-6 bottom-6 h-16 w-16 rounded-full shadow-2xl z-40 bg-gradient-to-br from-cyan-500 via-blue-600 to-blue-700 hover:from-cyan-400 hover:via-blue-500 hover:to-blue-600 transition-all duration-300 hover:scale-110 hover:shadow-cyan-500/50"
        size="icon"
      >
        <HelpCircle className="h-8 w-8 text-white" />
        <span className="sr-only">About this project</span>
      </Button>

      <AboutProjectModal open={isAboutModalOpen} onOpenChange={setIsAboutModalOpen} />
      <EvaluateExperienceModal
        open={isEvaluateModalOpen}
        onOpenChange={setIsEvaluateModalOpen}
        onLeaderboardUpdate={() => setLeaderboardRefreshTrigger((prev) => prev + 1)}
      />

      <footer className="border-t border-border/50 bg-gradient-to-r from-primary/5 via-secondary/5 to-accent/5 mt-12">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              Powered by{" "}
              <a
                href="https://www.genlayer.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-secondary font-medium transition-colors"
              >
                GenLayer
              </a>
            </span>
            <span className="hidden sm:inline">•</span>
            <span className="flex items-center gap-1">
              Powered by{" "}
              <a
                href="https://v0.app"
                target="_blank"
                rel="noopener noreferrer"
                className="text-secondary hover:text-accent font-medium transition-colors"
              >
                v0
              </a>
            </span>
            <span className="hidden sm:inline">•</span>
            <span className="flex items-center gap-1">
              Powered by{" "}
              <a
                href="https://proofoftravel.xyz"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:text-primary font-medium transition-colors"
              >
                ProofOfTravel.xyz
              </a>
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}
