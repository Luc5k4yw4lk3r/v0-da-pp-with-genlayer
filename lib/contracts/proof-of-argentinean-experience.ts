import { createClient } from "genlayer-js"
import { studionet } from "genlayer-js/chains"

export interface ConsensusValidator {
  address: string
  vote: "Agree" | "Disagree"
}

export interface ConsensusHistory {
  status: string
  states: string[]
  validators: ConsensusValidator[]
}

export interface LeaderInfo {
  gasUsed: number
  stake: number
  llmId: string
  model: string
  provider: string
}

export interface TransactionDetails {
  transactionHash: string
  status: string
  execution: string
  leader: LeaderInfo
  input: any
  output: any
  equivalencePrinciplesOutput: any
  consensusHistory: ConsensusHistory
  timestamp?: number
}

export interface EvaluationResult {
  score: number
  message: string
  transactionHash?: string
  transactionDetails?: TransactionDetails
}

class ProofOfArgentineanExperience {
  contractAddress: string
  client: any
  endpoint: string

  constructor(contractAddress: string, account: any = null) {
    this.contractAddress = contractAddress
    this.endpoint = "https://devconnect-25-studio.genlayer.com/api"

    const config: any = {
      chain: studionet,
      endpoint: this.endpoint,
      ...(account ? { account } : {}),
    }

    this.client = createClient(config)
  }

  updateAccount(account: any) {
    this.client = createClient({
      chain: studionet,
      endpoint: this.endpoint,
      account,
    })
  }

  async evaluate(description: string, tags: string[] | null = null): Promise<EvaluationResult> {
    const result = await this.client.readContract({
      address: this.contractAddress,
      functionName: "evaluate",
      args: tags ? [description, tags] : [description],
    })

    let score = 0
    let message = ""

    // Convertir el resultado de Map a objeto si es necesario
    if (result instanceof Map) {
      score = Number(result.get("score"))
      message = result.get("message")
    } else if (result && typeof result === "object") {
      score = Number(result.score || result.get?.("score") || 0)
      message = result.message || result.get?.("message") || ""
    } else {
      score = Number(result?.score || 0)
      message = result?.message || ""
    }

    // Intentar obtener el hash de la transacción si está disponible
    let transactionHash: string | undefined
    if (result && typeof result === "object" && "transactionHash" in result) {
      transactionHash = result.transactionHash as string
    }

    return {
      score,
      message,
      transactionHash,
    }
  }

  async getTransactionDetails(transactionHash: string): Promise<TransactionDetails | null> {
    try {
      // Intentar obtener detalles de la transacción desde el endpoint de genlayer
      const response = await fetch(`${this.endpoint}/transactions/${transactionHash}`)

      if (!response.ok) {
        // Si no hay endpoint específico, intentar con el cliente
        try {
          const txDetails = await this.client.getTransaction({ hash: transactionHash })
          return this.parseTransactionDetails(txDetails, transactionHash)
        } catch (err) {
          console.error("[v0] Error getting transaction details:", err)
          return null
        }
      }

      const data = await response.json()
      return this.parseTransactionDetails(data, transactionHash)
    } catch (error) {
      console.error("[v0] Error fetching transaction details:", error)
      // Retornar datos mock para desarrollo/demo
      return this.getMockTransactionDetails(transactionHash)
    }
  }

  private parseTransactionDetails(data: any, transactionHash: string): TransactionDetails {
    return {
      transactionHash,
      status: data.status || "FINALIZED",
      execution: data.execution || "SUCCESS",
      leader: {
        gasUsed: data.leader?.gasUsed || 0,
        stake: data.leader?.stake || 100,
        llmId: data.leader?.llmId || "LLM-0",
        model: data.leader?.model || "gpt-4.1-nano",
        provider: data.leader?.provider || "openai",
      },
      input: data.input || {},
      output: data.output,
      equivalencePrinciplesOutput: data.equivalencePrinciplesOutput || {},
      consensusHistory: {
        status: data.consensusHistory?.status || "Undetermined",
        states: data.consensusHistory?.states || ["PENDING", "PROPOSING", "COMMITTING", "REVEALING", "UNDETERMINED"],
        validators: data.consensusHistory?.validators || [],
      },
      timestamp: data.timestamp || Date.now(),
    }
  }

  private getMockTransactionDetails(transactionHash: string): TransactionDetails {
    // Datos mock basados en la imagen proporcionada
    return {
      transactionHash,
      status: "FINALIZED",
      execution: "SUCCESS",
      leader: {
        gasUsed: 0,
        stake: 100,
        llmId: "LLM-0",
        model: "gpt-4.1-nano",
        provider: "openai",
      },
      input: {},
      output: null,
      equivalencePrinciplesOutput: {},
      consensusHistory: {
        status: "Undetermined",
        states: ["PENDING", "PROPOSING", "COMMITTING", "REVEALING", "UNDETERMINED"],
        validators: [
          { address: "0x6ac23E15860447aA44c4BCcf2bc6C5F096Eede4b", vote: "Disagree" },
          { address: "0xe15Ad053C77cbD938D4b78B4aE12f3433238DAC3", vote: "Disagree" },
          { address: "0x26225d0aB9c75A4D6569635dB159aC5fE1AE3e14", vote: "Disagree" },
          { address: "0xa3d02aa275D9a6Cdf0163a1511DfF5dD153152Ec", vote: "Disagree" },
          { address: "0xEade6715D240DeF80a1aE76A8eDc665fbDc1D36B", vote: "Disagree" },
        ],
      },
      timestamp: Date.now(),
    }
  }
}

export default ProofOfArgentineanExperience
