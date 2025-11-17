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
    <div className="min-h-screen bg-black">
      <header className="relative min-h-screen flex flex-col items-center justify-center px-4 py-12 overflow-hidden bg-black">
        <div className="relative z-10 text-center w-full">
          <h1 className="hero-steak-text mb-4">
            PROOF OF STEAK
          </h1>

          <p className="text-lg sm:text-xl md:text-2xl font-medium text-white/80 tracking-wider mb-8">
            DEVCONNECT 2025 · BUENOS AIRES
          </p>
        </div>

        {/* Scroll indicator */}
        <button
          onClick={() => {
            const main = document.querySelector('main');
            main?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce cursor-pointer"
          aria-label="Scroll down"
        >
          <div className="h-12 w-8 rounded-full border-2 border-white/30 flex items-start justify-center p-2">
            <div className="h-2 w-1 bg-white/50 rounded-full" />
          </div>
        </button>
      </header>

      <main className="mx-auto max-w-7xl px-3 sm:px-4 lg:px-8 py-8 sm:py-12 lg:py-16 bg-gradient-to-b from-black to-zinc-900">
        <Leaderboard refreshTrigger={leaderboardRefreshTrigger} />
      </main>

      <Button
        onClick={() => setIsEvaluateModalOpen(true)}
        className="fixed right-6 bottom-24 h-20 w-20 rounded-full shadow-2xl z-40 bg-gradient-to-br from-orange-500 via-red-600 to-pink-600 hover:from-orange-400 hover:via-red-500 hover:to-pink-500 transition-all duration-300 hover:scale-110 hover:shadow-orange-500/50"
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
