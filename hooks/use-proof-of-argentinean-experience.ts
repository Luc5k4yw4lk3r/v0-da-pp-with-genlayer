import { useState, useCallback, useEffect } from "react"
import { generatePrivateKey, privateKeyToAccount } from "genlayer-js"
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
  const [generatedAccount, setGeneratedAccount] = useState<any>(null)

  useEffect(() => {
    if (!account && !generatedAccount) {
      console.log("[v0] Generating new account for GenLayer client...")
      const privateKey = generatePrivateKey()
      const newAccount = privateKeyToAccount(privateKey)
      setGeneratedAccount(newAccount)
      console.log("[v0] Generated account:", newAccount.address)
    }
  }, [account, generatedAccount])

  const getClient = useCallback(() => {
    const clientAccount = account || generatedAccount
    if (!clientAccount) {
      throw new Error("No account available. Please wait for account generation.")
    }
    return new ProofOfArgentineanExperience(contractAddress, clientAccount, studioUrl)
  }, [account, generatedAccount])

  const evaluate = useCallback(
    async (description: string, tags: string[] | null = null): Promise<EvaluationResult> => {
      setLoading(true)
      setError(null)
      setConsensusProgress(null)

      try {
        const client = getClient()
        console.log("[v0] Using account:", client.account.address)
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
        console.log("[v0] Using account for consensus tracking:", client.account.address)
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

  return { 
    evaluate, 
    evaluateWithTracking, 
    loading, 
    error, 
    consensusProgress,
    accountAddress: (account || generatedAccount)?.address 
  }
}
