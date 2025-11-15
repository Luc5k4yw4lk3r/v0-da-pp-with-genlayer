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

      const consensusData: ConsensusData = {
        finalResult: txData.result,
        validators: [],
        fullTxData: txData,
      }

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

      // Agregar información del leader si existe
      if (txData.leader_receipt) {
        const leaderVote = txData.leader_receipt.vote
        consensusData.leader = leaderVote?.vote_address || txData.leader_receipt.leader_address || "Leader"
        
        if (leaderVote) {
          consensusData.validators?.push({
            address: leaderVote.vote_address || "Leader",
            vote: leaderVote.vote,
            llmProvider: leaderVote.llm_provider,
          })
        }
      }

      // Agregar votos de validadores del consensus_data
      if (txData.consensus_data?.votes) {
        const votesData = Array.isArray(txData.consensus_data.votes) 
          ? txData.consensus_data.votes 
          : Object.values(txData.consensus_data.votes || {})
        
        for (const vote of votesData) {
          // Evitar duplicar el leader
          if (vote.vote_address !== consensusData.leader) {
            consensusData.validators?.push({
              address: vote.vote_address || "Validator",
              vote: vote.vote,
              llmProvider: vote.llm_provider,
            })
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
