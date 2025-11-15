import { useState, useCallback, useEffect } from "react"
import ProofOfArgentineanExperience from "@/lib/contracts/proof-of-argentinean-experience"

const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0xA3E6713d0E67002d3C707e64D8E41530385F6CFB"
const studioUrl = process.env.NEXT_PUBLIC_STUDIO_URL || null

interface EvaluationResult {
  score: number
  message: string
}

interface ConsensusProgress {
  step?: number
  totalSteps?: number
  message: string
  progress: number
  completed?: boolean
  status?: string
  error?: boolean
  consensusData?: any
  txHash?: string
}

export function useProofOfArgentineanExperience(account: any = null) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [consensusProgress, setConsensusProgress] = useState<ConsensusProgress | null>(null)
  const [client, setClient] = useState<ProofOfArgentineanExperience | null>(null)

  useEffect(() => {
    console.log("[v0] Creating GenLayer client...")
    const newClient = new ProofOfArgentineanExperience(contractAddress, account, studioUrl)
    setClient(newClient)
    console.log("[v0] Client created with account:", newClient.account.address)
  }, [account])

  const evaluateWithTracking = useCallback(
    async (description: string, tags: string[] | null = null): Promise<EvaluationResult> => {
      if (!client) {
        throw new Error("Client not initialized")
      }

      setLoading(true)
      setError(null)
      setConsensusProgress(null)

      try {
        console.log("[v0] Using account for consensus tracking:", client.account.address)
        const result = await client.evaluateWithConsensusTracking(description, tags, (progress) => {
          console.log("[v0] Consensus progress:", progress)
          setConsensusProgress(progress)
        })
        return result
      } catch (err: any) {
        const errorMessage = err.message || "Error al evaluar la experiencia"
        setError(errorMessage)
        setConsensusProgress({
          message: errorMessage,
          progress: 0,
          error: true,
        })
        throw err
      } finally {
        setLoading(false)
      }
    },
    [client]
  )

  return { 
    evaluateWithTracking, 
    loading, 
    error, 
    consensusProgress,
    accountAddress: client?.account?.address 
  }
}
