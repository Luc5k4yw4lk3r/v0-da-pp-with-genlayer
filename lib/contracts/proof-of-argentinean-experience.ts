import { createClient, createAccount } from "genlayer-js"
import { studionet } from "genlayer-js/chains"

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
}

class ProofOfArgentineanExperience {
  contractAddress: string
  client: any
  account: any

  constructor(contractAddress: string, account: any = null, studioUrl: string | null = null) {
    this.contractAddress = contractAddress

    if (!account) {
      account = createAccount()
      console.log("[v0] Generated account address:", account.address)
    }

    this.account = account

    const endpoint = studioUrl || process.env.NEXT_PUBLIC_STUDIO_URL

    const config: any = {
      chain: studionet,
      account,
      ...(endpoint ? { endpoint } : {}),
    }

    console.log("[v0] Creating client with config:", {
      chain: 'studionet',
      accountAddress: account.address,
      endpoint: endpoint || 'default'
    })

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

  async _fetchConsensusDetails(txHash: string): Promise<ConsensusData | null> {
    try {
      const endpoint = process.env.NEXT_PUBLIC_STUDIO_URL || "https://devconnect-25-studio.genlayer.com/api"

      console.log("[v0] Fetching consensus details for tx:", txHash)

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_getTransactionByHash",
          params: [txHash],
          id: 1,
        }),
      })

      if (!response.ok) {
        console.error("[v0] Failed to fetch consensus details:", response.status)
        return null
      }

      const rpcResponse = await response.json()

      if (rpcResponse.error) {
        console.error("[v0] RPC error:", rpcResponse.error)
        return null
      }

      const txData = rpcResponse.result
      console.log("[v0] Full transaction data:", JSON.stringify(txData, null, 2))

      if (!txData) {
        console.log("[v0] No transaction data found")
        return null
      }

      // Extract final result - could be in result, data.result, or receipt.result
      let finalResult = txData.result || txData.data?.result || txData.receipt?.result

      // If result is just a number (like 6), convert it to an object with score
      if (typeof finalResult === 'number') {
        finalResult = { score: finalResult, message: "" }
      }

      // If result is a Map-like structure, convert it
      if (finalResult && typeof finalResult === 'object' && !Array.isArray(finalResult)) {
        // Try to extract score and message
        if (finalResult.score !== undefined || finalResult.get) {
          finalResult = {
            score: finalResult.score || finalResult.get?.('score'),
            message: finalResult.message || finalResult.get?.('message') || ""
          }
        }
      }

      const consensusData: ConsensusData = {
        finalResult: finalResult,
        validators: [],
        fullTxData: txData,
      }

      // Extract leader information - leader_receipt can be an array
      let leaderVote = null
      let leaderAddress = null
      let leaderReceipt = null

      if (txData.leader_receipt) {
        // Handle both array and object formats
        if (Array.isArray(txData.leader_receipt)) {
          leaderReceipt = txData.leader_receipt.find((r: any) => r.mode === "leader") || txData.leader_receipt[0]
        } else {
          leaderReceipt = txData.leader_receipt
        }

        if (leaderReceipt) {
          leaderVote = leaderReceipt.vote
          leaderAddress = leaderReceipt.node_config?.address || leaderReceipt.address || txData.activator
          consensusData.leader = leaderAddress
        }
      } else if (txData.activator) {
        leaderAddress = txData.activator
        consensusData.leader = leaderAddress
      }

      // Get leader's result for comparison
      const leaderResult = leaderVote || finalResult

      // Obtener datos del consensus_data si existe
      if (txData.consensus_data) {
        consensusData.executionMode = txData.consensus_data.mode || txData.consensus_data.execution_mode

        // Los votes pueden venir como objeto o array
        if (txData.consensus_data.votes) {
          const votesData = Array.isArray(txData.consensus_data.votes)
            ? txData.consensus_data.votes
            : Object.values(txData.consensus_data.votes || {})

          consensusData.votesReceived = votesData.length
          consensusData.totalValidators = votesData.length
        }
      }

      // Agregar información del leader como primer validador
      if (leaderAddress) {
        consensusData.validators?.push({
          address: leaderAddress,
          vote: leaderResult,
          llmProvider: leaderReceipt?.node_config?.primary_model?.provider || "openai",
        })
      }

      // Agregar validadores del consensus_data.validators (array)
      if (txData.consensus_data?.validators && Array.isArray(txData.consensus_data.validators)) {
        for (const validator of txData.consensus_data.validators) {
          const validatorAddress = validator.node_config?.address || validator.address
          if (validatorAddress && validatorAddress !== leaderAddress) {
            // Check if already added
            const alreadyAdded = consensusData.validators?.some(v => v.address === validatorAddress)
            if (!alreadyAdded) {
              // Try to decode base64 result if present
              let vote = validator.vote
              if (validator.result && typeof validator.result === 'string' && validator.result.startsWith('A')) {
                // This might be base64 encoded, but for now just use the vote
                vote = validator.vote || "agree"
              }

              // Extract error information if present
              let error = null
              if (validator.genvm_result?.stderr) {
                error = validator.genvm_result.stderr
              }

              consensusData.validators?.push({
                address: validatorAddress,
                vote: vote,
                llmProvider: validator.node_config?.primary_model?.provider || "openai",
                executionResult: validator.execution_result,
                error: error,
              })
            }
          }
        }
      }

      // Agregar votos de validadores del consensus_data.votes (objeto)
      if (txData.consensus_data?.votes && !Array.isArray(txData.consensus_data.votes)) {
        const votesData = Object.entries(txData.consensus_data.votes || {})

        for (const [address, vote] of votesData) {
          if (address && address !== leaderAddress) {
            // Check if already added
            const alreadyAdded = consensusData.validators?.some(v => v.address === address)
            if (!alreadyAdded) {
              consensusData.validators?.push({
                address: address,
                vote: vote,
                llmProvider: "openai",
              })
            }
          }
        }
      }

      // Also check for validators in other possible locations
      if (txData.validators && Array.isArray(txData.validators)) {
        for (const validator of txData.validators) {
          const validatorAddress = validator.node_config?.address || validator.address || validator.vote_address
          if (validatorAddress && validatorAddress !== leaderAddress) {
            // Check if already added
            const alreadyAdded = consensusData.validators?.some(v => v.address === validatorAddress)
            if (!alreadyAdded) {
              consensusData.validators?.push({
                address: validatorAddress,
                vote: validator.vote || validator.result,
                llmProvider: validator.node_config?.primary_model?.provider || "openai",
              })
            }
          }
        }
      }

      console.log("[v0] Parsed consensus data:", consensusData)
      return consensusData
    } catch (error) {
      console.error("[v0] Error fetching consensus details:", error)
      return null
    }
  }

  async evaluateWithConsensusTracking(
    description: string,
    tags: string[] | null = null,
    onConsensusProgress?: (progress: ConsensusProgress) => void
  ) {
    try {
      console.log("[v0] Starting evaluateWithConsensusTracking...")
      console.log("[v0] Contract address:", this.contractAddress)
      console.log("[v0] Description:", description)
      console.log("[v0] Tags:", tags)

      // Notificar inicio
      if (onConsensusProgress) {
        onConsensusProgress({
          status: "PENDING",
          message: this._getStatusMessage("PENDING"),
          progress: this._getProgressFromStatus("PENDING"),
        })
      }

      console.log("[v0] Sending writeContract transaction...")

      const txHash = await this.client.writeContract({
        address: this.contractAddress,
        functionName: "evaluate_with_consensus_tracking",
        args: tags ? [description, tags] : [description],
      })

      console.log("[v0] Transaction hash received:", txHash)

      console.log("[v0] Starting to wait for transaction receipt...")

      const receipt = await this.client.waitForTransactionReceipt({
        hash: txHash,
        status: "FINALIZED",
        interval: 2000,
        retries: 60,
        onStatusChange: (status: string) => {
          console.log("[v0] Transaction status changed to:", status)

          if (onConsensusProgress) {
            onConsensusProgress({
              status: status,
              message: this._getStatusMessage(status),
              progress: this._getProgressFromStatus(status),
              txHash: txHash,
            })
          }
        },
      })

      console.log("[v0] Transaction receipt received")

      const consensusData = await this._fetchConsensusDetails(txHash)
      console.log("[v0] Consensus data retrieved")

      // Notificar finalización con datos del consenso
      if (onConsensusProgress) {
        onConsensusProgress({
          status: "FINALIZED",
          message: "Consenso finalizado ✓",
          progress: 100,
          completed: true,
          txHash: txHash,
          consensusData: consensusData || undefined,
        })
      }

      // Extraer el resultado de la transacción
      let result = null

      if (receipt.result) {
        result = receipt.result
      } else if (receipt.data && receipt.data.result) {
        result = receipt.data.result
      } else if (receipt.data) {
        result = receipt.data
      }

      console.log("[v0] Final result:", result)

      // Si el resultado es solo un número, convertirlo a objeto
      if (typeof result === "number") {
        return {
          score: result,
          message: "",
        }
      }

      // Convertir el resultado de Map a objeto si es necesario
      if (result instanceof Map) {
        return {
          score: Number(result.get("score") || 0),
          message: result.get("message") || "",
        }
      }

      // Si es un objeto directo
      if (result && typeof result === "object") {
        return {
          score: Number(result.score || result.get?.("score") || 0),
          message: result.message || result.get?.("message") || "",
        }
      }

      // Si no hay resultado en el receipt, intentar obtenerlo del consensusData
      if (consensusData?.finalResult) {
        const final = consensusData.finalResult
        if (typeof final === "number") {
          return {
            score: final,
            message: "",
          }
        }
        if (typeof final === "object") {
          return {
            score: Number(final.score || 0),
            message: final.message || "",
          }
        }
      }

      return {
        score: Number(result?.score || 0),
        message: result?.message || "",
      }
    } catch (error: any) {
      console.error("[v0] Error in evaluateWithConsensusTracking:", error)

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
