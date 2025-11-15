import { useState, useCallback } from "react"
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
}

export function useProofOfArgentineanExperience(account: any = null) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [consensusProgress, setConsensusProgress] = useState<ConsensusProgress | null>(null)

  const getClient = useCallback(() => {
    return new ProofOfArgentineanExperience(contractAddress, account, studioUrl)
  }, [account])

  const evaluate = useCallback(
    async (description: string, tags: string[] | null = null): Promise<EvaluationResult> => {
      setLoading(true)
      setError(null)
      setConsensusProgress(null)

      try {
        const client = getClient()
        const result = await client.evaluate(description, tags, (progress) => {
          setConsensusProgress(progress)
        })
        return result
      } catch (err: any) {
        const errorMessage = err.message || "Error al evaluar la experiencia"
        setError(errorMessage)
        setConsensusProgress(null)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [getClient]
  )

  const evaluateWithTracking = useCallback(
    async (description: string, tags: string[] | null = null): Promise<EvaluationResult> => {
      setLoading(true)
      setError(null)
      setConsensusProgress(null)

      try {
        const client = getClient()
        const result = await client.evaluateWithConsensusTracking(description, tags, (progress) => {
          setConsensusProgress(progress)
        })
        return result
      } catch (err: any) {
        const errorMessage = err.message || "Error al evaluar la experiencia"
        setError(errorMessage)
        setConsensusProgress(null)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [getClient]
  )

  return { evaluate, evaluateWithTracking, loading, error, consensusProgress }
}
