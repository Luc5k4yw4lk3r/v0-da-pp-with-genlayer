import { createClient } from "genlayer-js"
import { studionet } from "genlayer-js/chains"

interface ConsensusProgress {
  step: number
  totalSteps: number
  message: string
  progress: number
  completed?: boolean
}

class ProofOfArgentineanExperience {
  contractAddress: string
  client: any

  constructor(contractAddress: string, account: any = null) {
    this.contractAddress = contractAddress

    const config: any = {
      chain: studionet,
      endpoint: "https://devconnect-25-studio.genlayer.com/api",
      ...(account ? { account } : {}),
    }

    this.client = createClient(config)
  }

  updateAccount(account: any) {
    this.client = createClient({
      chain: studionet,
      endpoint: "https://devconnect-25-studio.genlayer.com/api",
      account,
    })
  }

  async evaluate(
    description: string,
    tags: string[] | null = null,
    onConsensusProgress?: (progress: ConsensusProgress) => void
  ) {
    const consensusSteps = [
      "Iniciando evaluación...",
      "Ejecutando primera evaluación con LLM...",
      "Ejecutando segunda evaluación para consenso...",
      "Comparando resultados...",
      "Ejecutando tercera evaluación (si es necesario)...",
      "Validando consenso...",
      "Consenso alcanzado ✓",
    ]

    let stepIndex = 0
    const progressInterval = setInterval(() => {
      if (onConsensusProgress && stepIndex < consensusSteps.length) {
        onConsensusProgress({
          step: stepIndex + 1,
          totalSteps: consensusSteps.length,
          message: consensusSteps[stepIndex],
          progress: Math.round(((stepIndex + 1) / consensusSteps.length) * 100),
        })
        stepIndex++
      }
    }, 1500) // Update every 1.5 seconds

    try {
      const result = await this.client.readContract({
        address: this.contractAddress,
        functionName: "evaluate",
        args: tags ? [description, tags] : [description],
      })

      clearInterval(progressInterval)

      if (onConsensusProgress) {
        onConsensusProgress({
          step: consensusSteps.length,
          totalSteps: consensusSteps.length,
          message: "Consenso alcanzado ✓",
          progress: 100,
          completed: true,
        })
      }

      // Convertir el resultado de Map a objeto si es necesario
      if (result instanceof Map) {
        return {
          score: Number(result.get("score")),
          message: result.get("message"),
        }
      }

      // Si es un objeto directo
      if (result && typeof result === "object") {
        return {
          score: Number(result.score || result.get?.("score") || 0),
          message: result.message || result.get?.("message") || "",
        }
      }

      return {
        score: Number(result?.score || 0),
        message: result?.message || "",
      }
    } catch (error) {
      clearInterval(progressInterval)
      throw error
    }
  }
}

export default ProofOfArgentineanExperience
