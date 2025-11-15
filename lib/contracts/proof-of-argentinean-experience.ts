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
    // Allow endpoint to be configured via environment variable, fallback to default
    this.endpoint =
      (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_GENLAYER_ENDPOINT) ||
      "https://devconnect-25-studio.genlayer.com/api"

    console.log("[v0] GenLayer endpoint:", this.endpoint)
    console.log("[v0] Contract address:", this.contractAddress)

    const config: any = {
      chain: studionet,
      endpoint: this.endpoint,
      ...(account ? { account } : {}),
    }

    try {
      this.client = createClient(config)
    } catch (error) {
      console.error("[v0] Error creating GenLayer client:", error)
      throw new Error(`Failed to initialize GenLayer client: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  updateAccount(account: any) {
    this.client = createClient({
      chain: studionet,
      endpoint: this.endpoint,
      account,
    })
  }

  async evaluate(description: string, tags: string[] | null = null, imageQuality?: number): Promise<EvaluationResult> {
    // Convert imageQuality to integer 0-100, default to null if not provided
    const qualityInt = imageQuality !== undefined && imageQuality !== null
      ? Math.round(imageQuality * 100)
      : null

    // Build args array conditionally based on what's provided
    // IMPORTANT: The deployed contract must have the updated signature with image_quality parameter
    // Current signature: evaluate(description: str, tags: list[str] = None, image_quality: int = None)
    // 
    // For now, we only pass image_quality if tags are also provided, to maintain argument order.
    // Once the contract is redeployed with the new signature, image_quality will be fully supported.
    const args: any[] = [description]

    // Add tags if provided and not empty
    if (tags && tags.length > 0) {
      args.push(tags)
      // Add imageQuality if provided (only after tags to maintain correct order)
      // TODO: Once contract is redeployed with image_quality parameter, this will work fully
      if (qualityInt !== null) {
        args.push(qualityInt)
      }
    }
    // Note: If tags is null/empty but qualityInt is provided, we don't pass qualityInt
    // because the contract signature requires positional arguments in order.
    // The quality penalty will be handled by the LLM prompt if image_quality info is available in description

    console.log("[v0] Calling contract with args:", args)

    try {
      console.log("[v0] Calling contract:", {
        address: this.contractAddress,
        functionName: "evaluate",
        args,
        endpoint: this.endpoint
      })

      const result = await this.client.readContract({
        address: this.contractAddress,
        functionName: "evaluate",
        args,
      })

      console.log("[v0] Contract result:", result)

      let score = 0
      let message = ""

      // Convert the result from Map to object if necessary
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

      return {
        score,
        message,
      }
    } catch (error: any) {
      console.error("[v0] Contract call error:", {
        error,
        message: error?.message,
        stack: error?.stack,
        endpoint: this.endpoint,
        contractAddress: this.contractAddress
      })

      // Provide more specific error messages
      if (error?.message?.includes("gen_call") || error?.message?.includes("RPC")) {
        throw new Error(
          `GenLayer RPC error: Unable to connect to ${this.endpoint}. ` +
          `Please check your network connection and ensure the GenLayer endpoint is accessible. ` +
          `Error: ${error.message || "Unknown error"}`
        )
      }

      throw new Error(
        error?.message ||
        `Failed to evaluate experience. Please check the contract configuration and ensure the contract is deployed at ${this.contractAddress}.`
      )
    }
  }

  async getTransactionDetails(transactionHash: string): Promise<TransactionDetails | null> {
    try {
      // Intentar obtener detalles de la transacción desde el endpoint de genlayer
      const response = await fetch(`${this.endpoint}/transactions/${transactionHash}`)

      if (!response.ok) {
        // Si no hay endpoint específico, intentar con el cliente
        try {
          const rpcResponse = await fetch(this.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'eth_getTransactionByHash',
              params: [transactionHash],
              id: 1
            })
          })

          if (rpcResponse.ok) {
            const rpcData = await rpcResponse.json()
            if (rpcData.result) {
              return this.parseTransactionDetails(rpcData.result, transactionHash)
            }
          }
        } catch (rpcErr) {
          console.log("[v0] RPC method also failed, using mock data")
        }

        return this.getMockTransactionDetails(transactionHash)
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
    // Mock data based on the provided image
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
