import { createClient, privateKeyToAccount, generatePrivateKey } from "genlayer-js"
import { studionet } from "genlayer-js/chains"

interface ConsensusProgress {
  step?: number
  totalSteps?: number
  message: string
  progress: number
  completed?: boolean
  status?: string
  error?: boolean
}

class ProofOfArgentineanExperience {
  contractAddress: string
  client: any
  account: any

  constructor(contractAddress: string, account: any = null, studioUrl: string | null = null) {
    this.contractAddress = contractAddress

    if (!account) {
      const privateKey = generatePrivateKey()
      account = privateKeyToAccount(privateKey)
    }
    
    this.account = account

    const config: any = {
      chain: studionet,
      account,
      ...(studioUrl ? { endpoint: studioUrl } : {}),
    }

    this.client = createClient(config)
  }

  updateAccount(account: any) {
    this.account = account
    this.client = createClient({
      chain: studionet,
      account,
    })
  }

  _getProgressFromStatus(status: string): number {
    const progressMap: Record<string, number> = {
      PENDING: 10,
      PROPOSING: 30,
      COMMITTING: 50,
      REVEALING: 70,
      ACCEPTED: 90,
      FINALIZED: 100,
    }
    return progressMap[status] || 0
  }

  _getStatusMessage(status: string): string {
    const statusMessages: Record<string, string> = {
      PENDING: "Transacción pendiente...",
      PROPOSING: "Líder proponiendo resultado...",
      COMMITTING: "Validadores comprometiendo votos...",
      REVEALING: "Validadores revelando votos...",
      ACCEPTED: "Consenso aceptado, esperando finalización...",
      FINALIZED: "Consenso finalizado ✓",
    }
    return statusMessages[status] || `Estado: ${status}`
  }

  async evaluate(
    description: string,
    tags: string[] | null = null,
    onConsensusProgress?: (progress: ConsensusProgress) => void
  ) {
    // Pasos simulados del consenso
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
    }, 1500) // Actualizar cada 1.5 segundos

    try {
      const result = await this.client.readContract({
        address: this.contractAddress,
        functionName: "evaluate",
        args: tags ? [description, tags] : [description],
      })

      clearInterval(progressInterval)

      // Notificar finalización
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

  async evaluateWithConsensusTracking(
    description: string,
    tags: string[] | null = null,
    onConsensusProgress?: (progress: ConsensusProgress) => void
  ) {
    try {
      // Notificar inicio
      if (onConsensusProgress) {
        onConsensusProgress({
          status: "PENDING",
          message: this._getStatusMessage("PENDING"),
          progress: this._getProgressFromStatus("PENDING"),
        })
      }

      // Enviar transacción write
      const txHash = await this.client.writeContract({
        address: this.contractAddress,
        functionName: "evaluate_with_consensus_tracking",
        args: tags ? [description, tags] : [description],
      })

      // Monitorear el estado de la transacción
      const receipt = await this.client.waitForTransactionReceipt({
        hash: txHash,
        status: "FINALIZED",
        interval: 2000, // Verificar cada 2 segundos
        retries: 60, // Máximo 2 minutos
        onStatusChange: (status: string) => {
          // Notificar cambios de estado
          if (onConsensusProgress) {
            onConsensusProgress({
              status: status,
              message: this._getStatusMessage(status),
              progress: this._getProgressFromStatus(status),
            })
          }
        },
      })

      // Extraer el resultado de la transacción
      let result = null

      if (receipt.result) {
        result = receipt.result
      } else if (receipt.data && receipt.data.result) {
        result = receipt.data.result
      } else if (receipt.data) {
        result = receipt.data
      } else {
        // Si no hay resultado en el receipt, leer del contrato
        result = await this.client.readContract({
          address: this.contractAddress,
          functionName: "evaluate",
          args: tags ? [description, tags] : [description],
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
    } catch (error: any) {
      if (onConsensusProgress) {
        onConsensusProgress({
          status: "ERROR",
          message: `Error: ${error.message}`,
          progress: 0,
          error: true,
        })
      }
      throw error
    }
  }
}

export default ProofOfArgentineanExperience
